import { z } from "zod";

import { runAssistant, toolsFor } from "@/server/assistant/assistant.service";
import { grokSettings } from "@/server/assistant/grok";
import { getCurrentUser } from "@/server/auth/auth.service";
import { extractSessionTokenFromRequest } from "@/server/auth/session.service";
import { parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";

/* A turn can take several model calls; allow up to two minutes on serverless hosts. */
export const maxDuration = 120;

/* The conversation lives in the browser and comes back on every turn; it is size-capped and shape-checked. */
const MAX_BODY_CHARS = 600_000;
const turnSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.union([
    z.object({ role: z.literal("user"), content: z.string().max(8000) }),
    z.object({
      role: z.literal("assistant"),
      content: z.string().nullable(),
      tool_calls: z.array(z.object({ id: z.string().max(200), type: z.literal("function"), function: z.object({ name: z.string().max(80), arguments: z.string().max(60000) }) })).max(40).optional(),
    }),
    z.object({ role: z.literal("tool"), tool_call_id: z.string().max(200), content: z.string().max(200000) }),
  ])).max(300).default([]),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function signedInUser(request) {
  const user = await getCurrentUser(extractSessionTokenFromRequest(request));
  if (!user) throw new AppError("Authentication is required.", { code: "AUTH_REQUIRED", status: 401 });
  return user;
}

/* Which entries this user's role lets the assistant prepare. */
export function GET(request) {
  return runRoute(request, async () => {
    const user = await signedInUser(request);
    return {
      data: {
        configured: grokSettings().configured,
        tools: toolsFor(user).map((tool) => tool.name),
      },
    };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await signedInUser(request);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_CHARS) {
      throw new AppError("This conversation is too long. Start a new one.", { code: "ASSISTANT_TOO_LONG", status: 413 });
    }
    const input = await parseRequestBody(request, turnSchema);
    return { data: await runAssistant(user, input.history, input.message, input.today) };
  });
}
