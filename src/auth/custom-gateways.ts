/**
 * Helpers for custom OpenAI-compatible gateway providers.
 */

import type { Api, Model } from "@earendil-works/pi-ai";
import type { CustomProvider } from "../storage/local/custom-providers-store.js";

const OPENAI_GATEWAY_ID_PREFIX = "pi-openai-gateway:";
export const OPENAI_GATEWAY_PROVIDER_PREFIX = "Gateway · ";
const OPENAI_GATEWAY_TYPE = "openai-completions";

export const DEFAULT_OPENAI_GATEWAY_CONTEXT_WINDOW = 16_384;
const DEFAULT_OPENAI_GATEWAY_MAX_TOKENS = 4_096;

type StoredModel = NonNullable<CustomProvider["models"]>[number];

export interface CustomProvidersStoreLike {
  get(id: string): Promise<CustomProvider | null>;
  set(provider: CustomProvider): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<CustomProvider[]>;
}

export interface OpenAiGatewayConfig {
  id: string;
  displayName: string;
  endpointUrl: string;
  modelIds: string[];
  apiKey: string;
  providerName: string;
  contextWindow: number;
  disableDiscovery?: boolean;
}

export interface SaveOpenAiGatewayInput {
  id?: string;
  displayName?: string;
  endpointUrl: string;
  modelId?: string;
  apiKey?: string;
  contextWindow?: number;
}

export interface CustomProviderRuntimeInfo {
  providerNames: Set<string>;
  apiKeys: Map<string, string | undefined>;
  defaultModel: Model<Api> | null;
}

function normalizeOptionalString(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeRequiredString(value: string, label: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

export function normalizeGatewayEndpointUrl(endpointUrl: string): string {
  const raw = normalizeRequiredString(endpointUrl, "Endpoint URL");

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      "Endpoint URL must be a valid http:// or https:// URL.",
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      "Endpoint URL must use http:// or https://.",
    );
  }

  parsed.hash = "";

  const normalized = parsed.toString();

  return normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
}

export function normalizeGatewayModelId(modelId: string): string {
  return modelId.trim();
}

export function normalizeGatewayContextWindow(
  contextWindow: number | null | undefined,
): number {
  if (contextWindow == null) {
    return DEFAULT_OPENAI_GATEWAY_CONTEXT_WINDOW;
  }

  if (!Number.isInteger(contextWindow)) {
    throw new Error(
      "Max context tokens must be a whole number.",
    );
  }

  const normalized = contextWindow;

  if (normalized < 1_024) {
    throw new Error(
      "Max context tokens must be at least 1024.",
    );
  }

  return normalized;
}

function deriveDisplayName(
  rawName: string | undefined,
  endpointUrl: string,
): string {
  const explicit = normalizeOptionalString(rawName);

  if (explicit.length > 0) {
    return explicit;
  }

  try {
    const url = new URL(endpointUrl);

    const host =
      url.port.length > 0
        ? `${url.hostname}:${url.port}`
        : url.hostname;

    if (host.trim().length > 0) {
      return host;
    }
  } catch {
    // noop — endpoint URL is validated before this runs.
  }

  return "Custom gateway";
}

function toGatewayProviderName(
  displayName: string,
): string {
  return `${OPENAI_GATEWAY_PROVIDER_PREFIX}${displayName}`;
}

function getFirstModel(
  provider: CustomProvider,
): StoredModel | null {
  if (
    !Array.isArray(provider.models) ||
    provider.models.length === 0
  ) {
    return null;
  }

  return provider.models[0] ?? null;
}

export function isOpenAiGatewayProvider(
  provider: CustomProvider,
): boolean {
  if (!provider.id.startsWith(OPENAI_GATEWAY_ID_PREFIX)) {
    return false;
  }

  if (provider.type !== OPENAI_GATEWAY_TYPE) {
    return false;
  }

  const model = getFirstModel(provider);

  if (!model) {
    return false;
  }

  const providerName =
    normalizeOptionalString(model.provider);

  const modelId =
    normalizeOptionalString(model.id);

  return (
    providerName.length > 0 &&
    modelId.length > 0
  );
}

function providerToGatewayConfig(
  provider: CustomProvider,
): OpenAiGatewayConfig | null {
  if (!isOpenAiGatewayProvider(provider)) {
    return null;
  }

  const model = getFirstModel(provider);

  if (!model) {
    return null;
  }

  const providerName =
    normalizeOptionalString(model.provider);

  if (providerName.length === 0) {
    return null;
  }

  const endpointUrl =
    normalizeOptionalString(provider.baseUrl);

  const storedModels =
    Array.isArray(provider.models)
      ? provider.models
      : [];

  const modelIds = storedModels
    .map((m) =>
      normalizeOptionalString(m.id),
    )
    .filter(
      (id) => id.length > 0,
    );

  if (
    endpointUrl.length === 0 ||
    modelIds.length === 0
  ) {
    return null;
  }

  const defaultDisplayName =
    providerName.startsWith(
      OPENAI_GATEWAY_PROVIDER_PREFIX,
    )
      ? providerName.slice(
          OPENAI_GATEWAY_PROVIDER_PREFIX.length,
        )
      : providerName;

  return {
    id: provider.id,
    displayName:
      normalizeOptionalString(provider.name) ||
      defaultDisplayName,
    endpointUrl,
    modelIds,
    apiKey:
      normalizeOptionalString(provider.apiKey),
    providerName,
    contextWindow:
      normalizeGatewayContextWindow(
        model.contextWindow,
      ),
    disableDiscovery:
      provider.disableDiscovery,
  };
}

function createGatewayModel(args: {
  endpointUrl: string;
  modelId: string;
  providerName: string;
  contextWindow: number;
}): Model<"openai-completions"> {
  const maxTokens = Math.min(
    DEFAULT_OPENAI_GATEWAY_MAX_TOKENS,
    args.contextWindow,
  );

  return {
    id: args.modelId,
    name: args.modelId,
    api: "openai-completions",
    provider: args.providerName,
    baseUrl: args.endpointUrl,
    reasoning: false,

    input:
      args.modelId ===
      "deepseek-v4-flash-vision-exp"
        ? ["text", "image"]
        : ["text"],

    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },

    contextWindow:
      args.contextWindow,

    maxTokens,
  };
}

/**
 * Known gateway models.
 *
 * B.AI:
 * https://api.b.ai/v1
 *
 * OpenRouter:
 * https://openrouter.ai/api/v1
 */
const HARDCODED_GATEWAY_MODELS: Record<
  string,
  string[]
> = {
  "https://api.b.ai/v1": [
    "qwen3.8-flash",
    "deepseek-v4-flash",
    "mimo-v2.5",
    "deepseek-v4-flash-vision-exp",
  ],

  /**
   * OpenRouter is OpenAI-compatible.
   *
   * Keep a valid route as a seed model so the
   * provider is persisted immediately.
   *
   * Dynamic /models discovery then refreshes
   * the actual OpenRouter catalogue when loaded.
   */
  "https://openrouter.ai/api/v1": [
    "openrouter/auto",
  ],
};

function parseGatewayModelIds(
  raw: string | undefined,
): string[] {
  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(/[\n,]+/u)
        .map((value) => value.trim())
        .filter(
          (value) =>
            value.length > 0,
        ),
    ),
  );
}

function resolveUniqueProviderName(args: {
  displayName: string;
  existingGateways: OpenAiGatewayConfig[];
  editingId?: string;
}): string {
  const candidateBase =
    toGatewayProviderName(
      args.displayName,
    );

  const usedNames = new Set(
    args.existingGateways
      .filter(
        (gateway) =>
          gateway.id !== args.editingId,
      )
      .map(
        (gateway) =>
          gateway.providerName.toLowerCase(),
      ),
  );

  if (
    !usedNames.has(
      candidateBase.toLowerCase(),
    )
  ) {
    return candidateBase;
  }

  let suffix = 2;

  while (suffix < 500) {
    const candidate =
      `${candidateBase} (${suffix})`;

    if (
      !usedNames.has(
        candidate.toLowerCase(),
      )
    ) {
      return candidate;
    }

    suffix += 1;
  }

  return `${candidateBase} (${Date.now()})`;
}

export async function listOpenAiGatewayConfigs(
  customProvidersStore:
    CustomProvidersStoreLike,
): Promise<OpenAiGatewayConfig[]> {
  const providers =
    await customProvidersStore.getAll();

  return providers
    .map((provider) =>
      providerToGatewayConfig(
        provider,
      ),
    )
    .filter(
      (
        gateway,
      ): gateway is OpenAiGatewayConfig =>
        gateway !== null,
    )
    .sort(
      (a, b) =>
        a.displayName.localeCompare(
          b.displayName,
        ),
    );
}

export async function saveOpenAiGatewayConfig(
  customProvidersStore:
    CustomProvidersStoreLike,
  input: SaveOpenAiGatewayInput,
): Promise<OpenAiGatewayConfig> {
  const endpointUrl =
    normalizeGatewayEndpointUrl(
      input.endpointUrl,
    );

  const modelIdsInput =
    parseGatewayModelIds(
      input.modelId,
    );

  const contextWindow =
    normalizeGatewayContextWindow(
      input.contextWindow,
    );

  const existingGateways =
    await listOpenAiGatewayConfigs(
      customProvidersStore,
    );

  if (input.id) {
    const match =
      existingGateways.find(
        (gateway) =>
          gateway.id === input.id,
      );

    if (!match) {
      throw new Error(
        "Gateway not found.",
      );
    }
  }

  const displayName =
    deriveDisplayName(
      input.displayName,
      endpointUrl,
    );

  const uniqueProviderNameArgs: {
    displayName: string;
    existingGateways: OpenAiGatewayConfig[];
    editingId?: string;
  } = {
    displayName,
    existingGateways,
  };

  if (input.id !== undefined) {
    uniqueProviderNameArgs.editingId =
      input.id;
  }

  const providerName =
    resolveUniqueProviderName(
      uniqueProviderNameArgs,
    );

  /**
   * Explicit model IDs:
   *
   * User entered one or more model IDs.
   *
   * Discovery is disabled because the user
   * explicitly selected the models.
   */
  let modelIds = modelIdsInput;
  let disableDiscovery = true;

  if (modelIds.length === 0) {
    /**
     * No model was entered.
     *
     * Check whether this endpoint is a known
     * gateway.
     */
    const knownModels =
      HARDCODED_GATEWAY_MODELS[
        endpointUrl
      ];

    if (
      Array.isArray(knownModels) &&
      knownModels.length > 0
    ) {
      modelIds = [
        ...knownModels,
      ];

      /**
       * B.AI uses its known fixed model list.
       *
       * OpenRouter has a seed model and keeps
       * discovery enabled.
       */
      disableDiscovery =
        endpointUrl !==
        "https://openrouter.ai/api/v1";
    } else {
      /**
       * Unknown gateway with no model:
       *
       * No models means we cannot create a
       * runtime provider, so discovery is
       * disabled until a model is supplied.
       */
      modelIds = [];
      disableDiscovery = true;
    }
  }

  if (modelIds.length === 0) {
    throw new Error(
      "At least one model ID is required.",
    );
  }

  const id =
    input.id ??
    `${OPENAI_GATEWAY_ID_PREFIX}${crypto.randomUUID()}`;

  const apiKey =
    input.apiKey !== undefined
      ? normalizeOptionalString(
          input.apiKey,
        )
      : "";

  const models = modelIds.map(
    (modelId) =>
      createGatewayModel({
        endpointUrl,
        modelId,
        providerName,
        contextWindow,
      }),
  );

  const provider: CustomProvider = {
    id,
    name: displayName,
    type: OPENAI_GATEWAY_TYPE,
    baseUrl: endpointUrl,
    apiKey,
    models,
    disableDiscovery,
  };

  await customProvidersStore.set(
    provider,
  );

  return {
    id,
    displayName,
    endpointUrl,
    modelIds,
    apiKey,
    providerName,
    contextWindow,
    disableDiscovery,
  };
}

export async function deleteOpenAiGatewayConfig(
  customProvidersStore:
    CustomProvidersStoreLike,
  id: string,
): Promise<void> {
  const provider =
    await customProvidersStore.get(
      id,
    );

  if (!provider) {
    return;
  }

  if (
    !isOpenAiGatewayProvider(
      provider,
    )
  ) {
    return;
  }

  await customProvidersStore.delete(
    id,
  );
}

export function resolveCustomProviderModel(
  providers: CustomProvider[],
  model: Model<Api>,
): Model<Api> | null {
  const exactMatches: Model<Api>[] = [];

  for (const provider of providers) {
    if (
      !isOpenAiGatewayProvider(
        provider,
      )
    ) {
      continue;
    }

    const storedModels =
      Array.isArray(provider.models)
        ? provider.models
        : [];

    for (const storedModel of storedModels) {
      if (
        storedModel.api !==
        model.api
      ) {
        continue;
      }

      if (
        storedModel.id !==
        model.id
      ) {
        continue;
      }

      if (
        storedModel.baseUrl !==
        model.baseUrl
      ) {
        continue;
      }

      exactMatches.push(
        storedModel as Model<Api>,
      );
    }
  }

  if (exactMatches.length === 1) {
    return exactMatches[0] ?? null;
  }

  if (exactMatches.length > 1) {
    return null;
  }

  /**
   * Fallback:
   *
   * Match by base URL + model ID.
   *
   * Only return a model if exactly one
   * gateway matches.
   */
  const fallbackMatches: Model<Api>[] = [];

  for (const provider of providers) {
    if (
      !isOpenAiGatewayProvider(
        provider,
      )
    ) {
      continue;
    }

    const endpointUrl =
      normalizeOptionalString(
        provider.baseUrl,
      );

    if (
      endpointUrl.length === 0 ||
      endpointUrl !== model.baseUrl
    ) {
      continue;
    }

    const storedModels =
      Array.isArray(provider.models)
        ? provider.models
        : [];

    for (const storedModel of storedModels) {
      if (
        storedModel.api !==
        model.api
      ) {
        continue;
      }

      if (
        storedModel.id !==
        model.id
      ) {
        continue;
      }

      fallbackMatches.push(
        storedModel as Model<Api>,
      );
    }
  }

  if (fallbackMatches.length !== 1) {
    return null;
  }

  return fallbackMatches[0] ?? null;
}

export function collectCustomProviderRuntimeInfo(
  providers: CustomProvider[],
): CustomProviderRuntimeInfo {
  const providerNames =
    new Set<string>();

  const apiKeys =
    new Map<
      string,
      string | undefined
    >();

  let defaultModel:
    Model<Api> | null = null;

  for (const provider of providers) {
    if (
      isOpenAiGatewayProvider(
        provider,
      )
    ) {
      const config =
        providerToGatewayConfig(
          provider,
        );

      if (!config) {
        continue;
      }

      providerNames.add(
        config.providerName,
      );

      apiKeys.set(
        config.providerName,
        config.apiKey ||
          undefined,
      );

      if (!defaultModel) {
        defaultModel =
          createGatewayModel({
            endpointUrl:
              config.endpointUrl,
            modelId:
              config.modelIds[0]!,
            providerName:
              config.providerName,
            contextWindow:
              config.contextWindow,
          });
      }

      continue;
    }

    /**
     * Keep non-gateway custom providers
     * visible to runtime.
     */
    const name =
      normalizeOptionalString(
        provider.name,
      );

    if (name.length > 0) {
      providerNames.add(name);

      apiKeys.set(
        name,
        normalizeOptionalString(
          provider.apiKey,
        ) || undefined,
      );
    }
  }

  return {
    providerNames,
    apiKeys,
    defaultModel,
  };
}
