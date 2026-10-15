import { NextResponse } from "next/server";

import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { handleApiError } from "@/server/core/errors/error-handler";
import { resolveRequestId } from "@/server/core/utils/request-id";
import { archiveDocument, getDocumentContent } from "@/server/products/catalogue.service";

/* Downloads the stored file with its recorded type; never rendered inline as HTML. */
export async function GET(request, { params }) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    await authorizeRequest(request, "products:view");
    const { id } = await params;
    const document = await getDocumentContent(id);
    const inline = new URL(request.url).searchParams.get("inline") === "1" && document.mimeType !== "text/csv";
    return new NextResponse(document.content, {
      status: 200,
      headers: {
        "content-type": document.mimeType,
        "content-length": String(document.sizeBytes),
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${document.fileName.replace(/"/g, "")}"`,
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "cache-control": "private, no-store",
        "x-sha256": document.sha256,
      },
    });
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}

/* DELETE archives (the file is kept for the record). */
export function DELETE(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "products:update");
    const { id } = await params;
    return { data: await archiveDocument(id, user.id) };
  });
}
