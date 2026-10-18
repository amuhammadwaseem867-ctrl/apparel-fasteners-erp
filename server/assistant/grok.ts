/*
 * Minimal client for an OpenAI-compatible Chat Completions API: Groq or
 * xAI (Grok). The assistant is on as soon as an API key is set;
 * AI_ASSISTANT_ENABLED=false switches it off.
 *   Groq: GROQ_API_KEY, optional GROQ_MODEL (default llama-3.3-70b-versatile).
 *   xAI:  XAI_API_KEY, optional XAI_MODEL (default grok-4.3) and XAI_BASE_URL.
 * When both keys are set, Groq is used. Failures become AppErrors that say
 * what to fix; a model name the account does not have is answered with the
 * list of models it does have.
 */

import { AppError } from "../core/errors/app-error";
import type { ToolDefinition } from "./tools";

export const DEFAULT_MODEL = "grok-4.3";
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
/* Tool-calling models tried in order when the chosen one is not on the account. */
const GROQ_FALLBACK_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "qwen/qwen3-32b", "moonshotai/kimi-k2-instruct"];
let groqFallbackModel: string | null = null;
const CALL_TIMEOUT_MS = 55_000;

export type ChatToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ChatResult = { message: Extract<ChatMessage, { role: "assistant" }>; finishReason: string };

export function grokSettings() {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  // On when an AI key is set, unless AI_ASSISTANT_ENABLED=false; AI_ASSISTANT_ENABLED=true forces it on.
  const flag = process.env.AI_ASSISTANT_ENABLED?.trim().toLowerCase();
  const enabled = flag === "true" || (flag !== "false" && Boolean(groqKey || process.env.XAI_API_KEY?.trim()));
  if (groqKey) {
    return {
      enabled,
      configured: true,
      provider: "Groq",
      keyName: "GROQ_API_KEY",
      modelName: "GROQ_MODEL",
      apiKey: groqKey,
      model: process.env.GROQ_MODEL?.trim() || groqFallbackModel || GROQ_DEFAULT_MODEL,
      modelFixed: Boolean(process.env.GROQ_MODEL?.trim()),
      baseUrl: (process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
    };
  }
  const apiKey = process.env.XAI_API_KEY?.trim();
  return {
    enabled,
    configured: Boolean(apiKey),
    provider: "xAI",
    keyName: "XAI_API_KEY",
    modelName: "XAI_MODEL",
    apiKey,
    model: process.env.XAI_MODEL?.trim() || DEFAULT_MODEL,
    modelFixed: true,
    baseUrl: (process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1").replace(/\/+$/, ""),
  };
}

async function availableModels(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/models`, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) });
    const payload = await response.json();
    return (payload?.data ?? []).map((model: { id?: string }) => model.id).filter(Boolean);
  } catch {
    return [];
  }
}

/*
 * Groq retires models often. When the default model is not on the account
 * (and no GROQ_MODEL was set), the first tool-calling model it does have
 * is used instead, and remembered for later calls.
 */
export async function chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ChatResult> {
  const settings = grokSettings();
  if (!settings.apiKey) {
    throw new AppError("The AI assistant is not set up yet. An administrator must add GROQ_API_KEY (or XAI_API_KEY) to the server environment.", { code: "ASSISTANT_NOT_CONFIGURED", status: 503 });
  }
  try {
    return await chatWith(settings.model, messages, tools);
  } catch (error) {
    if (settings.modelFixed || settings.provider !== "Groq" || (error as AppError).code !== "ASSISTANT_MODEL_UNAVAILABLE") throw error;
    const available = ((error as AppError).details as { available?: string[] } | undefined)?.available ?? [];
    const next = GROQ_FALLBACK_MODELS.find((candidate) => candidate !== settings.model && available.includes(candidate));
    if (!next) throw error;
    groqFallbackModel = next;
    return chatWith(next, messages, tools);
  }
}

async function chatWith(model: string, messages: ChatMessage[], tools: ToolDefinition[]): Promise<ChatResult> {
  const { apiKey, baseUrl, provider, keyName, modelName } = grokSettings() as { apiKey: string; baseUrl: string; provider: string; keyName: string; modelName: string };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        tools: tools.map((tool) => ({ type: "function", function: tool })),
        tool_choice: "auto",
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new AppError(timedOut ? "The AI service took too long to answer. Try a shorter request." : "The server could not reach the AI service. Try again shortly.", { code: timedOut ? "ASSISTANT_TIMEOUT" : "ASSISTANT_UNREACHABLE", status: 503, cause });
  }

  const raw = await response.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Not JSON: reported below with the status code.
  }

  if (!response.ok) {
    const detail = String((payload?.error as { message?: string } | undefined)?.message ?? payload?.error ?? raw.slice(0, 300)).trim();
    if (response.status === 401 || response.status === 403) {
      throw new AppError(`The AI service rejected the API key (${detail}). An administrator must check ${keyName} and the ${provider} account.`, { code: "ASSISTANT_KEY_INVALID", status: 502 });
    }
    if (response.status === 429) {
      throw new AppError(`The AI service is busy or the account's usage limit or credit was reached. Try again in a minute, or check the ${provider} account.`, { code: "ASSISTANT_RATE_LIMITED", status: 503 });
    }
    if ((response.status === 404 || response.status === 400) && /model/i.test(detail)) {
      const models = await availableModels(baseUrl, apiKey);
      throw new AppError(`The AI model "${model}" is not available for this ${provider} account (${detail}).${models.length ? ` Available: ${models.join(", ")}.` : ""} An administrator can set ${modelName} to one of them.`, { code: "ASSISTANT_MODEL_UNAVAILABLE", status: 502, details: { available: models } });
    }
    throw new AppError(`The AI service returned an error (${response.status}): ${detail}`, { code: "ASSISTANT_SERVICE_ERROR", status: 502 });
  }

  const choice = (payload?.choices as Array<{ message?: ChatResult["message"]; finish_reason?: string }> | undefined)?.[0];
  if (!choice?.message) {
    throw new AppError("The AI service returned an empty answer. Try again.", { code: "ASSISTANT_SERVICE_ERROR", status: 502 });
  }
  const { content = null, tool_calls: toolCalls } = choice.message;
  return {
    message: { role: "assistant", content: content ?? null, ...(toolCalls?.length ? { tool_calls: toolCalls } : {}) },
    finishReason: choice.finish_reason ?? "stop",
  };
}
