import { isOperatorTokenError } from "../../state/operatorToken";

/** The two outcomes a toast conveys — a green confirmation or a red failure.
 * Absent (the `MutationCache` path) is treated as `"error"` by the Toaster. */
export type ToastSeverity = "ok" | "error";

export interface Toast {
  id: number;
  /** Render the localized "set the operator token in Settings" copy (a 401 on a guarded write). */
  operatorToken?: boolean;
  /** Custom copy; when absent the Toaster renders the localized mutation-error message. */
  message?: string;
  /** Visual tone; defaults to `"error"` at render (preserves the MutationCache behavior). */
  severity?: ToastSeverity;
  /** Trace id of a server 5xx — the toast links to that entry in the activity log. */
  errorTraceId?: string;
}

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();
// Monotonic counter — `Date.now()` / `Math.random()` are banned in this codebase.
let nextId = 1;

/**
 * A minimal module-level toast pub/sub. The non-React `QueryClient` `MutationCache`
 * `onError` callback `emit()`s here; the `<Toaster>` subscribes and renders. Decouples
 * the cache callback (outside React, no i18n) from the React toast surface.
 */
export const toastBus = {
  emit(
    toast: {
      message?: string;
      severity?: ToastSeverity;
      operatorToken?: boolean;
      errorTraceId?: string;
    } = {},
  ): void {
    const t: Toast = {
      id: nextId++,
      message: toast.message,
      severity: toast.severity,
      operatorToken: toast.operatorToken,
      errorTraceId: toast.errorTraceId,
    };
    for (const l of listeners) l(t);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** The slice of a TanStack `Mutation` the toast rule reads. */
export interface MutationMetaCarrier {
  options: { meta?: Record<string, unknown> };
}

/**
 * `true` when the mutation opted out of the global toast via
 * `meta: { inlineError: true }` — its call site already renders the specific
 * refusal inline (e.g. the self-update / ensure-self-project 409 `message`), so
 * a generic "not saved, try again" toast on top would be duplicate and
 * misleading.
 */
export function isInlineErrorMutation(mutation: MutationMetaCarrier | undefined): boolean {
  return mutation?.options.meta?.inlineError === true;
}

/** `MutationCache.onError`: every failed write toasts; a 401 gets the operator-token copy. */
export function emitMutationError(error: unknown): void {
  toastBus.emit({
    operatorToken: isOperatorTokenError(error),
    errorTraceId: serverErrorTraceId(error),
  });
}

/** The `traceId` of a ts-rest `{ status >= 500, body: { traceId } }` failure (the API logged it). */
function serverErrorTraceId(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { status, body } = error as { status?: unknown; body?: unknown };
  if (typeof status !== "number" || status < 500) return undefined;
  if (typeof body !== "object" || body === null) return undefined;
  const { traceId } = body as { traceId?: unknown };
  return typeof traceId === "string" && traceId ? traceId : undefined;
}
