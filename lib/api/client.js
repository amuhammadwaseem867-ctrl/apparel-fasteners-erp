export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      // FormData sets its own multipart boundary.
      ...(options.body && !(typeof FormData !== "undefined" && options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new Error(`The server returned an unreadable response (${response.status}).`, {
      cause,
    });
  }

  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error?.message || `Request failed (${response.status}).`);
  }

  // Tell listeners (the process bar) that something was saved, so they show the new state.
  if ((options.method ?? "GET").toUpperCase() !== "GET" && typeof window !== "undefined") {
    window.dispatchEvent(new Event("erp:data-changed"));
  }

  return payload.data;
}

/*
 * Downloads a file produced by an API route. Error responses use the
 * standard JSON envelope, so failures surface the server's message.
 */
export async function downloadFile(path, fallbackName) {
  const response = await fetch(path);

  if (!response.ok) {
    let message = `Download failed (${response.status}).`;

    try {
      const payload = await response.json();
      message = payload?.error?.message || message;
    } catch {
      // keep the status-based message
    }

    throw new Error(message);
  }

  const disposition = response.headers.get("content-disposition") || "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");

  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
