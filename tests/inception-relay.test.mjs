import assert from "node:assert/strict";
import { test } from "node:test";
import { onRequestPost } from "../functions/api/inception/v1/chat/completions.js";
import { onRequestGet } from "../functions/api/inception/v1/models.js";

const ORIGIN = "https://hemant-example.pages.dev";

test("Mercury relay streams a tool call to the client with the user's key", async () => {
  const originalFetch = globalThis.fetch;
  const chunks = 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"write_cells"}}]}}]}\n\n';
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.inceptionlabs.ai/v1/chat/completions");
      assert.equal(options.headers.Authorization, "Bearer user-key");
      assert.equal(options.redirect, "manual");
      assert.equal(new TextDecoder().decode(options.body), '{"model":"mercury-2.5","stream":true}');
      return new Response(chunks, { headers: { "Content-Type": "text/event-stream" } });
    };
    const request = new Request(`${ORIGIN}/api/inception/v1/chat/completions`, {
      method: "POST", headers: { Origin: ORIGIN, Authorization: "Bearer user-key", "Content-Type": "application/json" },
      body: '{"model":"mercury-2.5","stream":true}',
    });
    const response = await onRequestPost({ request });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "text/event-stream");
    assert.equal(await response.text(), chunks);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("relay rejects cross-origin calls and missing keys without upstream access", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => { throw new Error("Must not contact provider"); };
    const crossOrigin = new Request(`${ORIGIN}/api/inception/v1/chat/completions`, {
      method: "POST", headers: { Origin: "https://attacker.example", Authorization: "Bearer key", "Content-Type": "application/json" }, body: "{}",
    });
    assert.equal((await onRequestPost({ request: crossOrigin })).status, 403);
    const noKey = new Request(`${ORIGIN}/api/inception/v1/chat/completions`, {
      method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: "{}",
    });
    assert.equal((await onRequestPost({ request: noKey })).status, 401);
    const noOrigin = new Request(`${ORIGIN}/api/inception/v1/chat/completions`, {
      method: "POST", headers: { Authorization: "Bearer key", "Content-Type": "application/json" }, body: "{}",
    });
    assert.equal((await onRequestPost({ request: noOrigin })).status, 403);
    const models = new Request(`${ORIGIN}/api/inception/v1/models`, { headers: { Origin: "https://attacker.example", Authorization: "Bearer key" } });
    assert.equal((await onRequestGet({ request: models })).status, 403);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
