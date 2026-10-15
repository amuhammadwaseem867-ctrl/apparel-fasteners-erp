import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { listDocuments, MAX_DOCUMENT_BYTES, uploadDocument } from "@/server/products/catalogue.service";
import { catalogueQuerySchema } from "@/server/products/catalogue.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "products:view");
    return { data: await listDocuments(parseQuery(request, catalogueQuerySchema)) };
  });
}

/* multipart/form-data: productId, title, documentType, file (5 MB max). */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "products:update");
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_DOCUMENT_BYTES + 64 * 1024) throw new AppError("Files can be at most 5 MB.", { code: "DOCUMENT_TOO_LARGE", status: 413 });
    let form;
    try {
      form = await request.formData();
    } catch (cause) {
      throw new AppError("Send the file as multipart form data.", { code: "INVALID_FORM", status: 400, cause });
    }
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    if (!file || typeof file === "string") throw new AppError("Choose a file.", { code: "DOCUMENT_EMPTY", status: 400 });
    if (title.length < 2 || title.length > 160) throw new AppError("Give the document a title (2–160 characters).", { code: "VALIDATION_FAILED", status: 400 });
    const content = new Uint8Array(await file.arrayBuffer());
    return {
      data: await uploadDocument({ productId: String(form.get("productId") ?? ""), title, documentType: String(form.get("documentType") ?? ""), fileName: file.name, mimeType: file.type, content }, user.id),
      status: 201,
    };
  });
}
