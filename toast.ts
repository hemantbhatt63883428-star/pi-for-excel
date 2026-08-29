/**
 * Shared toast helper used across taskpane and commands.
 */

interface ToastElements {
  root: HTMLDivElement;
  message: HTMLSpanElement;
  action: HTMLButtonElement;
}

export type ToastVariant = "info" | "error";

export interface ToastOptions {
  duration?: number;
  variant?: ToastVariant;
}

interface ActionToastOptions {
  message: string;
  actionLabel: string;
  onAction: () => void;
  duration?: number;
}

interface ResolvedToastOptions {
  message: string;
  duration: number;
  variant: ToastVariant;
  action?: {
    label: string;
    onAction: () => void;
  };
}

const ERROR_TOAST_PATTERN =
  /\b(fail(?:ed|ure)?|error|invalid|denied|blocked|could\s*not|couldn't|can\s*not|can't|unable|timed\s*out|exception|unhandled|rejected)\b/iu;

const DEFAULT_INFO_DURATION_MS = 2000;
const DEFAULT_ERROR_DURATION_MS = 8000;
const ACTION_TOAST_DEFAULT_MS = 7000;
const DUPLICATE_ERROR_WINDOW_MS = 1500;

let toastElements: ToastElements | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let actionHideTimer: ReturnType<typeof setTimeout> | null = null;
let lastErrorMessage = "";
let lastErrorAt = 0;
let globalErrorHandlersInstalled = false;

function clearHideTimer(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (actionHideTimer !== null) {
    clearTimeout(actionHideTimer);
    actionHideTimer = null;
  }
}

function hideToast(): void {
  const elements = toastElements;
  if (!elements) return;

  elements.root.classList.remove("visible");
  elements.root.classList.remove("pi-toast--action");
  elements.root.classList.remove("pi-toast--error");

  elements.action.hidden = true;
  elements.action.onclick = null;

  clearHideTimer();
}

function ensureToastElements(): ToastElements {
  if (toastElements) return toastElements;

  const root = document.createElement("div");
  root.id = "pi-toast";
  root.className = "pi-toast";
  root.setAttribute("aria-atomic", "true");

  const content = document.createElement("div");
  content.className = "pi-toast__content";

  const icon = document.createElement("span");
  icon.className = "pi-toast__icon";
  icon.setAttribute("aria-hidden", "true");

  const message = document.createElement("span");
  message.className = "pi-toast__message";

  const action = document.createElement("button");
  action.type = "button";
  action.className = "pi-toast__action";
  action.hidden = true;
  action.setAttribute("aria-label", "Dismiss");
  action.title = "Dismiss";

  content.append(icon, message, action);
  root.appendChild(content);
  document.body.appendChild(root);

  toastElements = { root, message, action };
  return toastElements;
}

function scheduleHide(duration: number): void {
  clearHideTimer();
  hideTimer = setTimeout(() => hideToast(), Math.max(0, duration));
}

function inferToastVariant(message: string): ToastVariant {
  return ERROR_TOAST_PATTERN.test(message) ? "error" : "info";
}

function normalizeToastOptions(
  message: string,
  durationOrOptions: number | ToastOptions | undefined,
): { duration: number; variant: ToastVariant } {
  if (typeof durationOrOptions === "number") {
    return { duration: durationOrOptions, variant: inferToastVariant(message) };
  }

  const variant = durationOrOptions?.variant ?? inferToastVariant(message);
  const duration =
    durationOrOptions?.duration ??
    (variant === "error" ? DEFAULT_ERROR_DURATION_MS : DEFAULT_INFO_DURATION_MS);

  return { duration, variant };
}

function applyToastVariant(root: HTMLDivElement, variant: ToastVariant): void {
  root.classList.toggle("pi-toast--error", variant === "error");

  if (variant === "error") {
    root.setAttribute("role", "alert");
    root.setAttribute("aria-live", "assertive");
  } else {
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
  }
}

function renderToast(opts: ResolvedToastOptions): void {
  const elements = ensureToastElements();
  clearHideTimer();

  applyToastVariant(elements.root, opts.variant);
  elements.message.textContent = opts.message;

  const icon = elements.root.querySelector(".pi-toast__icon");
  if (icon) {
    icon.textContent = opts.variant === "error" ? "⚠" : "✓";
  }

  if (opts.action) {
    elements.root.classList.add("pi-toast--action");
    elements.action.hidden = false;
    elements.action.textContent = opts.action.label;
    elements.action.onclick = () => {
      opts.action?.onAction();
      hideToast();
    };
  } else {
    elements.root.classList.remove("pi-toast--action");
    elements.action.hidden = true;
    elements.action.onclick = null;
  }

  elements.root.classList.add("visible");
  scheduleHide(opts.duration);
}

function stringifyUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : "Unknown error";
  } catch {
    return String(error);
  }
}

export function sanitizeErrorMessage(error: unknown): string {
  const raw = stringifyUnknownError(error).trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("402") ||
    lower.includes("requires more credits") ||
    lower.includes("can only afford") ||
    lower.includes("openrouter_credits")
  ) {
    return "Not enough credits. Reduce max tokens or add credits.";
  }

  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key")
  ) {
    return "Authentication failed. Please check your API key.";
  }

  if (
    lower.includes("403") ||
    lower.includes("forbidden")
  ) {
    return "The request was not authorized by the provider.";
  }

  if (
    lower.includes("429") ||
    lower.includes("rate limit")
  ) {
    return "Rate limit reached. Please try again later.";
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out")
  ) {
    return "The request timed out. Please try again.";
  }

  if (raw.length > 220) {
    return `${raw.slice(0, 217).trimEnd()}...`;
  }

  return raw || "An unexpected error occurred.";
}

export function showToast(message: string, duration?: number): void;
export function showToast(message: string, options?: ToastOptions): void;
export function showToast(
  message: string,
  durationOrOptions?: number | ToastOptions,
): void {
  const normalized = normalizeToastOptions(message, durationOrOptions);

  if (normalized.variant !== "error" && isActionToastVisible()) {
    return;
  }

  renderToast({
    message,
    duration: normalized.duration,
    variant: normalized.variant,
  });
}

export function showActionToast(opts: ActionToastOptions): void {
  renderToast({
    message: opts.message,
    duration: opts.duration ?? ACTION_TOAST_DEFAULT_MS,
    variant: "info",
    action: {
      label: opts.actionLabel,
      onAction: opts.onAction,
    },
  });
}

export function showErrorToast(
  error: unknown,
  duration = DEFAULT_ERROR_DURATION_MS,
): void {
  const message = sanitizeErrorMessage(error);
  const now = Date.now();

  if (
    message === lastErrorMessage &&
    now - lastErrorAt < DUPLICATE_ERROR_WINDOW_MS
  ) {
    return;
  }

  lastErrorMessage = message;
  lastErrorAt = now;

  renderToast({
    message,
    duration,
    variant: "error",
    action: {
      label: "×",
      onAction: () => {
        // Dismiss only.
      },
    },
  });
}

export function showErrorActionToast(
  message: string,
  actionLabel: string,
  onAction: () => void,
  duration = DEFAULT_ERROR_DURATION_MS,
): void {
  renderToast({
    message,
    duration,
    variant: "error",
    action: {
      label: actionLabel,
      onAction,
    },
  });
}

export function isActionToastVisible(): boolean {
  if (!toastElements) return false;

  return (
    toastElements.root.classList.contains("visible") &&
    toastElements.root.classList.contains("pi-toast--action") &&
    !toastElements.action.hidden
  );
}

/**
 * Install one global front-end error boundary for the taskpane.
 * All uncaught errors and rejected promises are shown as compact dismissible
 * toasts instead of being rendered into the chat/error panel.
 */
export function installGlobalErrorToastHandlers(): void {
  if (globalErrorHandlersInstalled) return;
  globalErrorHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    const error = event.error ?? event.message;
    if (error) {
      showErrorToast(error);
    }

    // Do not let the browser render additional UI for this error.
    event.preventDefault();
  });

  window.addEventListener("unhandledrejection", (event) => {
    showErrorToast(event.reason);

    // Prevent the browser from surfacing an additional unhandled-rejection UI.
    event.preventDefault();
  });
}
