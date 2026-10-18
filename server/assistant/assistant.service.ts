/*
 * ERP assistant (D-036, D-037). The user types what happened or what they
 * want to see ("New order for Ali Traders: 5000 #5 sliders at Rs 12",
 * "show this month's deliveries"). The AI model answers with read-only lookups,
 * report tables from the database, and proposals. It never writes: every
 * proposal waits for the user's Confirm, which posts it to the normal API
 * route with the user's session (see tools.ts).
 */

import { AppError } from "../core/errors/app-error";
import { chat, grokSettings, type ChatMessage } from "./grok";
import { executeTool, toolsFor, type Proposal, type ReportTable, type User } from "./tools";

export { executeTool, toolsFor } from "./tools";

const MAX_TOOL_ROUNDS = 16;
const MAX_HISTORY_MESSAGES = 80;

const SYSTEM_PROMPT = `You are the assistant inside Apparel Fastener ERP, used by a zipper and fastener manufacturer in Pakistan. Staff tell you what happened or what they want to know, and you prepare ERP entries for them to confirm or show them reports.

How you work:
- Look records up with the find_/list_ tools and use only ids those tools returned. Never invent an id, price, quantity, date, name or figure.
- For any question about business figures (orders, deliveries, production, stock, quality, receivables, payroll), call show_report and answer from what it returns. The user sees the table; do not repeat it row by row, give the key numbers in a sentence.
- A request can need several entries or steps (for example several orders, or a requisition for everything MRP found short): do all of them, one propose_ call per entry, then summarise.
- When the request is ambiguous (several matching customers or items, a missing quantity or price), ask one short question instead of guessing.
- Every distinct item specification is its own SKU (a #5 Brass Y-Cut tooth and a #5 Aluminium Plain tooth are different items); match the exact one.
- A proposal is not saved: the user reviews it on a card and presses Confirm. Never say an entry was saved, posted or approved.
- If a propose_ tool reports a problem, fix the input and try again, or tell the user what is missing.
- You can prepare: customers, suppliers, items, draft sales orders, draft purchase requisitions, draft purchase orders, expenses/income/transfers, and leave requests. For anything else (approving, posting stock, invoices, payroll runs), say which ERP screen to use. You cannot create or change database tables or settings.
- Amounts are Pakistani rupees unless the user says otherwise. Dates are YYYY-MM-DD.
- Always reply in English, in short sentences, even when the user writes in Urdu or Roman Urdu. Switch language only if the user explicitly asks you to.`;

export type AssistantTurn = { messages: ChatMessage[]; reply: string; proposals: Proposal[]; tables: ReportTable[] };

function parseArguments(raw: string) {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export async function runAssistant(user: User, history: ChatMessage[], userText: string, today: string): Promise<AssistantTurn> {
  if (!grokSettings().enabled) {
    throw new AppError("The AI assistant is switched off. An administrator can turn it on by adding GROQ_API_KEY and removing AI_ASSISTANT_ENABLED=false.", { code: "ASSISTANT_DISABLED", status: 503 });
  }
  const tools = toolsFor(user);
  if (!tools.some((tool) => tool.name.startsWith("propose_") || tool.name === "show_report")) {
    throw new AppError("Your role cannot use any of the assistant's entries or reports.", { code: "FORBIDDEN", status: 403 });
  }
  const conversation: ChatMessage[] = [...history.filter((message) => message.role !== "system").slice(-MAX_HISTORY_MESSAGES), { role: "user", content: userText }];
  const system: ChatMessage = { role: "system", content: `${SYSTEM_PROMPT}\n\nToday is ${today}. The user is ${user.name ?? user.email ?? "a staff member"}.` };
  const proposals: Proposal[] = [];
  const tables: ReportTable[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const { message } = await chat([system, ...conversation], tools);
    conversation.push(message);

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      const reply = (message.content ?? "").trim();
      return { messages: conversation, reply: reply || (proposals.length ? "Please review and confirm." : tables.length ? "Here is the report." : ""), proposals, tables };
    }

    for (const call of calls) {
      const input = parseArguments(call.function.arguments);
      let content: string;
      if (!input) {
        content = "Error: the arguments were not valid JSON. Send them again.";
      } else {
        const outcome = await executeTool(call.function.name, input, user);
        if (outcome.proposal) proposals.push(outcome.proposal);
        if (outcome.table) tables.push(outcome.table);
        content = outcome.error
          ? `Error: ${outcome.error}`
          : outcome.proposal
            ? `Prepared "${outcome.proposal.title}". It is NOT saved: the user must review it and press Confirm.`
            : JSON.stringify(outcome.result);
      }
      conversation.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
  return { messages: conversation, reply: "That took too many steps. Please split it into smaller requests.", proposals, tables };
}
