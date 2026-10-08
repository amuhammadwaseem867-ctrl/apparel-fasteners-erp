export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

  return payload.data;
}
