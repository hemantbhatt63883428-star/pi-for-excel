/**
 * Custom OpenAI-compatible gateway settings.
 */

import type { CommandContext } from "../types.js";
import {
  deleteOpenAiGatewayConfig,
  listOpenAiGatewayConfigs,
  saveOpenAiGatewayConfig,
  type OpenAiGatewayConfig,
} from "../../auth/custom-gateways.js";
import { getCustomProvidersStore } from "../../storage/local/custom-providers-store.js";
import { t } from "../../language/index.js";

const BAI_ENDPOINT = "https://api.b.ai/v1";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1";

function createInput(
  value = "",
): HTMLInputElement {
  const input =
    document.createElement("input");

  input.value = value;
  input.className =
    "pi-custom-gateway-input";

  return input;
}

function createLabel(
  text: string,
): HTMLLabelElement {
  const label =
    document.createElement("label");

  label.textContent = text;
  label.className =
    "pi-custom-gateway-label";

  return label;
}

function createButton(
  text: string,
): HTMLButtonElement {
  const button =
    document.createElement("button");

  button.type = "button";
  button.textContent = text;
  button.className =
    "pi-custom-gateway-button";

  return button;
}

function createField(
  labelText: string,
  input: HTMLInputElement,
): HTMLDivElement {
  const wrapper =
    document.createElement("div");

  wrapper.className =
    "pi-custom-gateway-field";

  wrapper.append(
    createLabel(labelText),
    input,
  );

  return wrapper;
}

function createGatewayCard(
  gateway: OpenAiGatewayConfig,
  onChanged: () => void,
): HTMLElement {
  const card =
    document.createElement("div");

  card.className =
    "pi-custom-gateway-card";

  const title =
    document.createElement("div");

  title.className =
    "pi-custom-gateway-card-title";

  title.textContent =
    gateway.displayName;

  const endpoint =
    document.createElement("div");

  endpoint.className =
    "pi-custom-gateway-card-endpoint";

  endpoint.textContent =
    gateway.endpointUrl;

  const models =
    document.createElement("div");

  models.className =
    "pi-custom-gateway-card-models";

  models.textContent =
    gateway.modelIds.join(", ");

  const actions =
    document.createElement("div");

  actions.className =
    "pi-custom-gateway-card-actions";

  const editButton =
    createButton(
      t("custom-gateway.edit"),
    );

  const deleteButton =
    createButton(
      t("custom-gateway.delete"),
    );

  editButton.addEventListener(
    "click",
    () => {
      window.dispatchEvent(
        new CustomEvent(
          "pi:edit-custom-gateway",
          {
            detail: gateway,
          },
        ),
      );
    },
  );

  deleteButton.addEventListener(
    "click",
    async () => {
      const confirmed =
        window.confirm(
          t(
            "custom-gateway.confirmDelete",
          ),
        );

      if (!confirmed) {
        return;
      }

      try {
        const store =
          await getCustomProvidersStore();

        await deleteOpenAiGatewayConfig(
          store,
          gateway.id,
        );

        onChanged();
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : String(error),
        );
      }
    },
  );

  actions.append(
    editButton,
    deleteButton,
  );

  card.append(
    title,
    endpoint,
    models,
    actions,
  );

  return card;
}

export async function renderCustomGatewaySettings(
  container: HTMLElement,
  context: CommandContext,
): Promise<void> {
  container.innerHTML = "";

  const root =
    document.createElement("div");

  root.className =
    "pi-custom-gateway-settings";

  const heading =
    document.createElement("h2");

  heading.textContent =
    t("custom-gateway.title");

  const description =
    document.createElement("p");

  description.textContent =
    t("custom-gateway.description");

  const form =
    document.createElement("div");

  form.className =
    "pi-custom-gateway-form";

  const nameInput =
    createInput();

  const endpointInput =
    createInput();

  const modelInput =
    createInput();

  const contextWindowInput =
    createInput(
      "16384",
    );

  const apiKeyInput =
    createInput();

  apiKeyInput.type =
    "password";

  endpointInput.placeholder =
    "https://api.example.com/v1";

  modelInput.placeholder =
    t(
      "custom-gateway.modelPlaceholder",
    );

  const presetRow =
    document.createElement("div");

  presetRow.className =
    "pi-custom-gateway-presets";

  const baiButton =
    createButton(
      t(
        "custom-gateway.presetBai",
      ),
    );

  const openRouterButton =
    createButton(
      t(
        "custom-gateway.presetOpenRouter",
      ),
    );

  /**
   * B.AI preset.
   *
   * Fills endpoint and leaves model
   * blank so the gateway save logic
   * inserts the four supported models.
   */
  baiButton.addEventListener(
    "click",
    () => {
      endpointInput.value =
        BAI_ENDPOINT;

      modelInput.value = "";

      apiKeyInput.focus();
    },
  );

  /**
   * OpenRouter preset.
   *
   * Blank model enables the OpenRouter
   * seed model + /models discovery.
   */
  openRouterButton.addEventListener(
    "click",
    () => {
      endpointInput.value =
        OPENROUTER_ENDPOINT;

      modelInput.value = "";

      apiKeyInput.focus();
    },
  );

  presetRow.append(
    baiButton,
    openRouterButton,
  );

  form.append(
    createField(
      t("custom-gateway.name"),
      nameInput,
    ),

    createField(
      t("custom-gateway.endpoint"),
      endpointInput,
    ),

    createField(
      t("custom-gateway.model"),
      modelInput,
    ),

    createField(
      t(
        "custom-gateway.contextWindow",
      ),
      contextWindowInput,
    ),

    createField(
      t("custom-gateway.apiKey"),
      apiKeyInput,
    ),
  );

  const saveButton =
    createButton(
      t("custom-gateway.save"),
    );

  const cancelButton =
    createButton(
      t("custom-gateway.cancel"),
    );

  const buttonRow =
    document.createElement("div");

  buttonRow.className =
    "pi-custom-gateway-actions";

  buttonRow.append(
    saveButton,
    cancelButton,
  );

  const list =
    document.createElement("div");

  list.className =
    "pi-custom-gateway-list";

  const refreshList =
    async (): Promise<void> => {
      list.innerHTML = "";

      const store =
        await getCustomProvidersStore();

      const gateways =
        await listOpenAiGatewayConfigs(
          store,
        );

      if (gateways.length === 0) {
        const empty =
          document.createElement("p");

        empty.textContent =
          t(
            "custom-gateway.empty",
          );

        list.append(empty);

        return;
      }

      for (const gateway of gateways) {
        list.append(
          createGatewayCard(
            gateway,
            refreshList,
          ),
        );
      }
    };

  let editingId:
    string | undefined;

  const loadGatewayForEdit =
    (
      gateway: OpenAiGatewayConfig,
    ): void => {
      editingId =
        gateway.id;

      nameInput.value =
        gateway.displayName;

      endpointInput.value =
        gateway.endpointUrl;

      modelInput.value =
        gateway.modelIds.join("\n");

      contextWindowInput.value =
        String(
          gateway.contextWindow,
        );

      apiKeyInput.value =
        gateway.apiKey;

      saveButton.textContent =
        t(
          "custom-gateway.update",
        );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  const handleEdit =
    (
      event: Event,
    ): void => {
      const customEvent =
        event as CustomEvent<OpenAiGatewayConfig>;

      if (!customEvent.detail) {
        return;
      }

      loadGatewayForEdit(
        customEvent.detail,
      );
    };

  window.addEventListener(
    "pi:edit-custom-gateway",
    handleEdit,
  );

  saveButton.addEventListener(
    "click",
    async () => {
      saveButton.disabled =
        true;

      try {
        const store =
          await getCustomProvidersStore();

        const contextWindow =
          Number(
            contextWindowInput.value.trim(),
          );

        const saved =
          await saveOpenAiGatewayConfig(
            store,
            {
              id: editingId,
              displayName:
                nameInput.value,
              endpointUrl:
                endpointInput.value,
              modelId:
                modelInput.value,
              apiKey:
                apiKeyInput.value,
              contextWindow,
            },
          );

        editingId =
          saved.id;

        saveButton.textContent =
          t(
            "custom-gateway.update",
          );

        await refreshList();

        if (
          context &&
          typeof context.notify ===
            "function"
        ) {
          context.notify(
            t(
              "custom-gateway.saved",
            ),
          );
        }
      } catch (error) {
        window.alert(
          error instanceof Error
            ? error.message
            : String(error),
        );
      } finally {
        saveButton.disabled =
          false;
      }
    },
  );

  cancelButton.addEventListener(
    "click",
    () => {
      editingId =
        undefined;

      nameInput.value = "";
      endpointInput.value = "";
      modelInput.value = "";
      contextWindowInput.value =
        "16384";
      apiKeyInput.value = "";

      saveButton.textContent =
        t("custom-gateway.save");
    },
  );

  root.append(
    heading,
    description,
    presetRow,
    form,
    buttonRow,
    list,
  );

  container.append(root);

  await refreshList();
}
