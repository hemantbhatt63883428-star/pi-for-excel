import assert from "node:assert/strict";
import test from "node:test";

import {
  listOpenAiGatewayConfigs,
  normalizeGatewayEndpointUrl,
  saveOpenAiGatewayConfig,
  type CustomProvidersStoreLike,
} from "../src/auth/custom-gateways.ts";
import type { CustomProvider } from "../src/storage/local/custom-providers-store.ts";

function createStore(): CustomProvidersStoreLike {
  const providers = new Map<string, CustomProvider>();
  return {
    get: (id) => Promise.resolve(providers.get(id) ?? null),
    set: (provider) => { providers.set(provider.id, provider); return Promise.resolve(); },
    delete: (id) => { providers.delete(id); return Promise.resolve(); },
    getAll: () => Promise.resolve([...providers.values()]),
  };
}

void test("normalizes endpoint URL while preserving the API path", () => {
  assert.equal(normalizeGatewayEndpointUrl("https://example.com/v1/"), "https://example.com/v1");
  assert.throws(() => normalizeGatewayEndpointUrl("ftp://example.com/v1"));
});

void test("Mercury gateway saves a usable model and persists its configuration", async () => {
  const store = createStore();
  const saved = await saveOpenAiGatewayConfig(store, {
    displayName: "Mercury 2.5",
    endpointUrl: "https://example.pages.dev/api/inception/v1/",
    modelId: "mercury-2.5",
    apiKey: "test-key",
    contextWindow: 260000,
  });
  assert.deepEqual(saved.modelIds, ["mercury-2.5"]);
  assert.equal(saved.disableDiscovery, true);
  assert.equal((await listOpenAiGatewayConfigs(store))[0]?.endpointUrl,
    "https://example.pages.dev/api/inception/v1");
});

void test("unknown gateway without a model is rejected instead of silently disappearing", async () => {
  const store = createStore();
  await assert.rejects(saveOpenAiGatewayConfig(store, {
    endpointUrl: "https://example.com/v1",
    modelId: "",
    apiKey: "test-key",
  }), /model ID/i);
  assert.deepEqual(await store.getAll(), []);
});

void test("OpenRouter preset remains discoverable when its model is blank", async () => {
  const saved = await saveOpenAiGatewayConfig(createStore(), {
    endpointUrl: "https://openrouter.ai/api/v1",
    modelId: "",
    apiKey: "test-key",
  });
  assert.deepEqual(saved.modelIds, ["openrouter/auto"]);
  assert.equal(saved.disableDiscovery, undefined);
});
