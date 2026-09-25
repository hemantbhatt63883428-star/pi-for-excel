// Fixed-destination BYOK relay for the Excel taskpane. No API keys are stored here.
const INCEPTION_CHAT_URL = "https://api.inceptionlabs.ai/v1/chat/completions";
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function onRequestPost({ request }) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("Origin") !== origin) {
    return new Response("Forbidden", { status: 403 });
  }

  const auth = request.headers.get("Authorization") ?? "";
  if (!/^Bearer [^\s]+$/i.test(auth)) {
    return new Response("Missing API key", { status: 401 });
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) {
    return new Response("Expected JSON", { status: 415 });
  }

  const declaredSize = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return new Response("Request too large", { status: 413 });
  }

  let body;
  try {
    body = await request.arrayBuffer();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
  if (body.byteLength > MAX_BODY_BYTES) {
    return new Response("Request too large", { status: 413 });
  }

  try {
    const upstream = await fetch(INCEPTION_CHAT_URL, {
      method: "POST",
      redirect: "manual",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body,
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return new Response("Unexpected provider redirect", { status: 502 });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Provider unavailable", { status: 502 });
  }
}
