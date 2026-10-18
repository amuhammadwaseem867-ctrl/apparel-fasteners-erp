import { z } from "zod";

import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { addOrderNote, NOTE_STEPS } from "@/server/sales/order-trace.service";

const noteSchema = z.object({
  step: z.enum(NOTE_STEPS),
  note: z.string().trim().min(2).max(1000),
});

/* Adds a note to the order at a process step (D-041); returns the updated Order Profile. */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:view");
    const { id } = await params;
    const input = await parseRequestBody(request, noteSchema);
    return { data: await addOrderNote(id, input, user.id) };
  });
}
