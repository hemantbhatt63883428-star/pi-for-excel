import assert from "node:assert/strict";
import test from "node:test";

import {
  HARDCODED_GATEWAY_MODELS,
  normalizeGatewayEndpointUrl,
  parseGatewayModelIds,
  saveCustomGateway,
} from "../src/auth/custom-gateways.ts";

test("normalizeGatewayEndpointUrl removes trailing slash", () => {
  assert.equal(
    normalizeGatewayEndpointUrl("https://api.b.ai/v1/"),
    "https://api.b.ai/v1",
  );
});

test("normalizeGatewayEndpointUrl removes hash", () => {
  assert.equal(
    normalizeGatewayEndpointUrl("https://api.b.ai/v1/#test"),
    "https://api.b.ai/v1",
  );
});

test("normalizeGatewayEndpointUrl rejects invalid URL", () => {
  assert.throws(() => normalizeGatewayEndpointUrl("not-a-url"));
});

test("normalizeGatewayEndpointUrl rejects unsupported protocols", () => {
  assert.throws(() => normalizeGatewayEndpointUrl("ftp://example.com/api"));
});

test("parseGatewayModelIds parses comma separated models", () => {
  assert.deepEqual(
    parseGatewayModelIds("model-a, model-b,model-c"),
    ["model-a", "model-b", "model-c"],
  );
});

test("parseGatewayModelIds parses newline separated models", () => {
  assert.deepEqual(
    parseGatewayModelIds("model-a\nmodel-b\nmodel-c"),
    ["model-a", "model-b", "model-c"],
  );
});

test("parseGatewayModelIds removes duplicates and empty values", () => {
  assert.deepEqual(
    parseGatewayModelIds("model-a, model-b\nmodel-a,, model-c\n"),
    ["model-a", "model-b", "model-c"],
  );
});

test("B.AI hardcoded gateway has the expected models", () => {
  assert.deepEqual(
    HARDCODED_GATEWAY_MODELS["https://api.b.ai/v1"],
    [
      "qwen3.8-flash",
      "deepseek-v4-flash",
      "mimo-v2.5",
      "deepseek-v4-flash-vision-exp",
    ],
  );
});

test("OpenRouter hardcoded gateway has a seed model", () => {
  assert.deepEqual(
    HARDCODED_GATEWAY_MODELS["https://openrouter.ai/api/v1"],
    ["openrouter/auto"],
  );
});

test("saveCustomGateway saves explicit multiple models", () => {
  const saved = saveCustomGateway({
    id: "test-gateway",
    displayName: "Test Gateway",
    endpointUrl: "https://example.com/v1/",
    modelId: "model-a,model-b\nmodel-c",
    apiKey: "test-key",
    providerName: "test",
    contextWindow: 128000,
  });

  assert.equal(saved.id, "test-gateway");
  assert.equal(saved.displayName, "Test Gateway");
  assert.equal(saved.endpointUrl, "https://example.com/v1");
  assert.deepEqual(saved.modelIds, ["model-a", "model-b", "model-c"]);
  assert.equal(saved.apiKey, "test-key");
  assert.equal(saved.providerName, "test");
  assert.equal(saved.contextWindow, 128000);
  assert.equal(saved.disableDiscovery, true);
});

test("saveCustomGateway uses B.AI hardcoded models when model is blank", () => {
  const saved = saveCustomGateway({
    id: "bai",
    displayName: "B.AI",
    endpointUrl: "https://api.b.ai/v1",
    modelId: "",
    apiKey: "bai-key",
    providerName: "bai",
    contextWindow: 128000,
  });

  assert.deepEqual(saved.modelIds, [
    "qwen3.8-flash",
    "deepseek-v4-flash",
    "mimo-v2.5",
    "deepseek-v4-flash-vision-exp",
  ]);
  assert.equal(saved.disableDiscovery, true);
});

test("saveCustomGateway uses OpenRouter seed model and enables discovery when model is blank", () => {
  const saved = saveCustomGateway({
    id: "openrouter",
    displayName: "OpenRouter",
    endpointUrl: "https://openrouter.ai/api/v1",
    modelId: "",
    apiKey: "openrouter-key",
    providerName: "openrouter",
    contextWindow: 128000,
  });

  assert.deepEqual(saved.modelIds, ["openrouter/auto"]);
  assert.equal(saved.disableDiscovery, false);
});

test("saveCustomGateway enables discovery for an unknown gateway only when requested by model discovery", () => {
  const saved = saveCustomGateway({
    id: "unknown",
    displayName: "Unknown Gateway",
    endpointUrl: "https://example.com/v1",
    modelId: "model-a",
    apiKey: "test-key",
    providerName: "unknown",
    contextWindow: 128000,
  });

  assert.deepEqual(saved.modelIds, ["model-a"]);
  assert.equal(saved.disableDiscovery, true);
});

test("saveCustomGateway normalizes endpoint URL", () => {
  const saved = saveCustomGateway({
    id: "normalized",
    displayName: "Normalized",
    endpointUrl: "https://example.com/v1///",
    modelId: "model-a",
    apiKey: "test-key",
    providerName: "normalized",
    contextWindow: 128000,
  });

  assert.equal(saved.endpointUrl, "https://example.com/v1");
});

test("saveCustomGateway trims display name and provider name", () => {
  const saved = saveCustomGateway({
    id: "trimmed",
    displayName: "  My Gateway  ",
    endpointUrl: "https://example.com/v1",
    modelId: "model-a",
    apiKey: "test-key",
    providerName: "  my-provider  ",
    contextWindow: 128000,
  });

  assert.equal(saved.displayName, "My Gateway");
  assert.equal(saved.providerName, "my-provider");
});

test("saveCustomGateway trims API key", () => {
  const saved = saveCustomGateway({
    id: "key-trim",
    displayName: "Key Trim",
    endpointUrl: "https://example.com/v1",
    modelId: "model-a",
    apiKey: "  secret-key  ",
    providerName: "test",
    contextWindow: 128000,
  });

  assert.equal(saved.apiKey, "secret-key");
});

test("saveCustomGateway rejects missing API key", () => {
  assert.throws(() =>
    saveCustomGateway({
      id: "missing-key",
      displayName: "Missing Key",
      endpointUrl: "https://example.com/v1",
      modelId: "model-a",
      apiKey: "",
      providerName: "test",
      contextWindow: 128000,
    }),
  );
});

test("saveCustomGateway rejects missing endpoint", () => {
  assert.throws(() =>
    saveCustomGateway({
      id: "missing-endpoint",
      displayName: "Missing Endpoint",
      endpointUrl: "",
      modelId: "model-a",
      apiKey: "test-key",
      providerName: "test",
      contextWindow: 128000,
    }),
  );
});

test("saveCustomGateway rejects missing model for unknown gateway", () => {
  assert.throws(() =>
    saveCustomGateway({
      id: "unknown-no-model",
      displayName: "Unknown",
      endpointUrl: "https://example.com/v1",
      modelId: "",
      apiKey: "test-key",
      providerName: "unknown",
      contextWindow: 128000,
    }),
  );
});

test("saveCustomGateway accepts blank model for B.AI", () => {
  const saved = saveCustomGateway({
    id: "bai-blank",
    displayName: "B.AI",
    endpointUrl: "https://api.b.ai/v1/",
    modelId: "",
    apiKey: "test-key",
    providerName: "bai",
    contextWindow: 128000,
  });

  assert.equal(saved.endpointUrl, "https://api.b.ai/v1");
  assert.equal(saved.modelIds.length, 4);
});

test("saveCustomGateway accepts blank model for OpenRouter", () => {
  const saved = saveCustomGateway({
    id: "or-blank",
    displayName: "OpenRouter",
    endpointUrl: "https://openrouter.ai/api/v1/",
    modelId: "",
    apiKey: "test-key",
    providerName: "openrouter",
    contextWindow: 128000,
  });

  assert.equal(saved.endpointUrl, "https://openrouter.ai/api/v1");
  assert.deepEqual(saved.modelIds, ["openrouter/auto"]);
  assert.equal(saved.disableDiscovery, false);
});
