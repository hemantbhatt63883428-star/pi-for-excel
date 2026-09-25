// Model discovery for the same provider, using the user's own API key.
export async function onRequestGet({ request }) {
  const auth = request.headers.get("Authorization") ?? "";
  if (!/^Bearer [^\s]+$/i.test(auth)) {
    return new Response("Missing API key", { status: 401 });
  }
  const incomingOrigin = request.headers.get("Origin");
  if (incomingOrigin && incomingOrigin !== new URL(request.url).origin) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const upstream = await fetch("https://api.inceptionlabs.ai/v1/models", {
      method: "GET",
      redirect: "manual",
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return new Response("Unexpected provider redirect", { status: 502 });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Provider unavailable", { status: 502 });
  }
}
