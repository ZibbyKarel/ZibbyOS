"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  CanvasPanel,
  type CanvasPanelBanner,
  type CanvasPanelPreviewWidth,
  type CanvasPanelStatus,
  useResolvedTheme,
} from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatErrorLog, saveDownload, zibbyHrefToPath } from "../canvas/canvasActions";
import { canvasVersionLabels, codeVersionOf } from "../canvas/canvasVersions";
import {
  useCanvasFetchMutation,
  useGrantCanvasOriginMutation,
  useRestoreCanvasVersionMutation,
  useSetCanvasParamsMutation,
} from "../canvas/mutations";
import { getCanvasQueryKey, useCanvasQuery } from "../canvas/queries";
import { canvasUrls } from "../canvas/canvasUrl";
import {
  type CanvasFetchResult,
  type CanvasKeyPayload,
  type CanvasParamValues,
  useCanvasBridge,
} from "../canvas/useCanvasBridge";
import { type OpenCanvas, useChat } from "../chat/ChatContext";

const SANDBOX = "allow-scripts allow-pointer-lock allow-modals";
const STATUSES = [
  "loading",
  "ready",
  "error",
  "unresponsive",
] as const satisfies readonly CanvasPanelStatus[];
const PREVIEW_WIDTHS = ["phone", "tablet", "full"] as const;
/** A slider drag is many `z:params-changed`; one POST after it settles. */
export const PARAMS_DEBOUNCE_MS = 1_500;

/** `zibby.state` of each canvas, kept for the session so a reload hands it back. */
const canvasStates = new Map<string, unknown>();

type ErrorLike = { status?: number; body?: unknown; message?: string };

/** ts-rest throws non-2xx responses as `{ status, body }`; network failures are `Error`s. */
function asErrorLike(err: unknown): ErrorLike {
  return typeof err === "object" && err !== null ? (err as ErrorLike) : {};
}

function deniedOf(err: unknown): { error: string; origin: string } | null {
  const { status, body } = asErrorLike(err);
  if (status !== 403 || typeof body !== "object" || body === null) return null;
  const { error, origin } = body as { error?: unknown; origin?: unknown };
  return typeof error === "string" && typeof origin === "string" ? { error, origin } : null;
}

function readable(err: unknown, fallback: string): string {
  const { body, message } = asErrorLike(err);
  if (typeof body === "object" && body !== null) {
    const m = (body as { message?: unknown; error?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return message || fallback;
}

export interface ZibbyCanvasPanelProps {
  canvas: OpenCanvas;
  /** A ZibbyOS shortcut pressed inside the page (`z:key`) — same handlers as the window's. */
  onKey: (key: CanvasKeyPayload) => void;
  /** Put text into the composer — never sends (`ask`, "Fix it"). */
  onPrefill: (text: string) => void;
  /** Send an operator-approved prompt as a typed message (`propose`). */
  onSend: (text: string) => void;
}

interface GrantPrompt {
  origin: string;
  decide: (allow: boolean) => void;
}

/** The side panel of the overlay: the canvas iframe, its bridge and the panel actions. */
export function ZibbyCanvasPanel({ canvas, onKey, onPrefill, onSend }: ZibbyCanvasPanelProps) {
  const t = useTranslations("zibby.canvas.panel");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canvasMode, setCanvasMode, closeCanvas } = useChat();
  const theme = useResolvedTheme();
  const frameRef = useRef<HTMLIFrameElement>(null);

  const { data: meta, refetch } = useCanvasQuery(canvas.id);
  const setParams = useSetCanvasParamsMutation();
  const restore = useRestoreCanvasVersionMutation();
  const grant = useGrantCanvasOriginMutation();
  const fetchMutation = useCanvasFetchMutation();

  // ---- which version the iframe shows ----------------------------------------------------
  const latest = Math.max(canvas.version, meta?.current ?? 0);
  /** The version the iframe has loaded; a params version of the same base never changes it. */
  const [frameVersion, setFrameVersionState] = useState(canvas.version);
  /** The version whose content the page shows (≥ frameVersion after a live params push). */
  const [displayed, setDisplayed] = useState(canvas.version);
  const setFrameVersion = useCallback((v: number) => {
    setFrameVersionState(v);
    setDisplayed(v);
  }, []);
  const [viewing, setViewing] = useState<number | null>(null);
  const [previewWidth, setPreviewWidth] = useState<CanvasPanelPreviewWidth>("full");
  const frameVersionRef = useRef(frameVersion);
  const viewingRef = useRef(viewing);
  const processedRef = useRef(canvas.version);
  useEffect(() => {
    frameVersionRef.current = frameVersion;
    viewingRef.current = viewing;
  });
  const shown = viewing ?? frameVersion;
  const { frame, external, isolated } = canvasUrls(canvas.id, shown, theme);

  const bridgeRef = useRef<{ post: (type: string, payload?: Record<string, unknown>) => void }>(
    null,
  );
  const applyLatest = useCallback(
    (versions: NonNullable<typeof meta>["versions"] | undefined, next: number) => {
      const v = versions?.find((x) => x.version === next);
      const loaded = versions ? codeVersionOf(versions, frameVersionRef.current) : undefined;
      if (
        v?.kind === "params" &&
        v.base !== undefined &&
        v.base === loaded &&
        viewingRef.current === null
      ) {
        // The page already has an operator's values; an agent's are pushed in, no reload.
        if (v.by === "agent" && v.params) bridgeRef.current?.post("z:params", { params: v.params });
        setDisplayed(next);
        return;
      }
      setFrameVersion(next);
    },
    [setFrameVersion],
  );
  useEffect(() => {
    if (latest === processedRef.current) return;
    processedRef.current = latest;
    if (meta?.versions.some((v) => v.version === latest)) {
      applyLatest(meta.versions, latest);
    } else {
      // The widget is ahead of the cached metadata: refresh it before deciding.
      void refetch().then(
        (r) => applyLatest(r.data?.versions, latest),
        () => applyLatest(undefined, latest),
      );
    }
  }, [latest, meta, refetch, applyLatest]);

  const currentVersion = meta?.current ?? latest;
  const versions = (() => {
    if (!meta) return undefined;
    const labels = canvasVersionLabels(meta.versions);
    const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
    return [...meta.versions].reverse().map((v) => ({
      key: String(v.version),
      label: labels.get(v.version) ?? `v${v.version}`,
      at: fmt.format(new Date(v.at)),
      note: v.note,
      current: v.version === meta.current,
    }));
  })();

  const onViewVersion = (key: string) => {
    const n = Number(key);
    if (n === currentVersion) {
      setViewing(null);
      setFrameVersion(latest);
    } else {
      setViewing(n);
    }
  };
  const onRestoreVersion = (key: string) =>
    restore.mutate(
      { params: { id: canvas.id }, body: { version: Number(key) } },
      {
        onSuccess: (res) => {
          processedRef.current = res.body.current;
          setViewing(null);
          setFrameVersion(res.body.current);
        },
      },
    );

  // ---- page → host -----------------------------------------------------------------------
  const pendingParams = useRef<CanvasParamValues | null>(null);
  const paramsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushParams = useCallback(() => {
    clearTimeout(paramsTimer.current);
    const params = pendingParams.current;
    pendingParams.current = null;
    if (params) setParams.mutate({ params: { id: canvas.id }, body: { params } });
  }, [canvas.id, setParams]);
  const flushRef = useRef(flushParams);
  useEffect(() => {
    flushRef.current = flushParams;
  });
  // A drag that ends with the panel closing still saves its last value.
  useEffect(() => () => flushRef.current(), []);
  const onParamsChanged = (params: CanvasParamValues) => {
    pendingParams.current = params;
    clearTimeout(paramsTimer.current);
    paramsTimer.current = setTimeout(flushParams, PARAMS_DEBOUNCE_MS);
  };

  const [proposal, setProposal] = useState<{ title: string; prompt: string } | null>(null);
  const [grantPrompt, setGrantPrompt] = useState<GrantPrompt | null>(null);
  const grantedOrigins = useRef(new Set<string>());
  // ponytail: grant prompts queue on one promise chain (one banner at a time, FIFO).
  const grantChain = useRef<Promise<unknown>>(Promise.resolve());
  const askGrant = (origin: string) => {
    const next = grantChain.current.then(
      () =>
        grantedOrigins.current.has(origin) ||
        new Promise<boolean>((resolve) =>
          setGrantPrompt({
            origin,
            decide: (allow) => {
              setGrantPrompt(null);
              resolve(allow);
            },
          }),
        ),
    );
    grantChain.current = next;
    return next;
  };

  const onFetch = async (url: string): Promise<CanvasFetchResult> => {
    const run = async () =>
      (await fetchMutation.mutateAsync({ params: { id: canvas.id }, body: { url } })).body;
    try {
      return await run();
    } catch (err) {
      const denied = deniedOf(err);
      if (!denied) throw new Error(readable(err, "Network request failed"));
      if (denied.error === "blocked") throw new Error(`Blocked: ${denied.origin}`);
      if (denied.error !== "needs-grant") throw new Error(`Not allowed: ${denied.origin}`);
      if (!(await askGrant(denied.origin))) throw new Error("denied");
      try {
        if (!grantedOrigins.current.has(denied.origin)) {
          await grant.mutateAsync({ params: { id: canvas.id }, body: { origin: denied.origin } });
          grantedOrigins.current.add(denied.origin);
        }
        return await run();
      } catch (err2) {
        throw new Error(readable(err2, "Network request failed"));
      }
    }
  };

  const {
    status,
    errors,
    reload: reloadFrame,
    post,
  } = useCanvasBridge({
    frameRef,
    src: frame ?? "",
    onKey,
    theme,
    getState: () => canvasStates.get(canvas.id),
    confirmOpenUrl: (url) => t("confirmOpenUrl", { url }),
    onParamsChanged,
    onState: (state) => canvasStates.set(canvas.id, state),
    onAsk: onPrefill,
    onPropose: setProposal,
    onFetch,
    onDownload: saveDownload,
    onOpenZibby: (href) => {
      const path = zibbyHrefToPath(href);
      if (path) router.push(path as never);
    },
  });
  useEffect(() => {
    bridgeRef.current = { post };
  });
  // After a live params push the iframe's src is older than what it shows: reload the shown one.
  const reload = () => {
    if (viewing === null && displayed !== frameVersion) setFrameVersion(displayed);
    else reloadFrame();
  };
  const label = viewing ?? displayed;
  // A new version from the thread: the cached metadata is stale.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: getCanvasQueryKey(canvas.id) });
  }, [canvas.id, canvas.version, queryClient]);

  if (!frame) return null;

  const banner: CanvasPanelBanner | undefined = grantPrompt
    ? {
        title: t("grantTitle", { origin: grantPrompt.origin }),
        confirmLabel: t("allow"),
        dismissLabel: t("deny"),
        onConfirm: () => grantPrompt.decide(true),
        onDismiss: () => grantPrompt.decide(false),
      }
    : proposal
      ? {
          title: t("proposeTitle", { title: proposal.title }),
          body: proposal.prompt,
          confirmLabel: t("approve"),
          dismissLabel: t("dismiss"),
          onConfirm: () => {
            onSend(proposal.prompt);
            setProposal(null);
          },
          onDismiss: () => setProposal(null),
        }
      : undefined;

  const first = errors[0];
  const message =
    status === "unresponsive"
      ? t("unresponsiveMessage")
      : first
        ? t("pageError", { message: first.message })
        : t("loadFailed");
  const full = canvasMode === "full";
  return (
    <CanvasPanel
      actions={
        <Button intent="secondary" onClick={reload} size="sm">
          {t("reload")}
        </Button>
      }
      allow="fullscreen; clipboard-write"
      backLabel={t("back")}
      backToCurrentLabel={t("backToCurrent")}
      banner={banner}
      closeLabel={t("close")}
      colorScheme={theme}
      errorCount={errors.length}
      errorsLabel={(count) => t("errors", { count })}
      exportLabel={t("export")}
      fixErrorsLabel={t("fixErrors")}
      frameRef={frameRef}
      frameTitle={t("frameTitle", { title: canvas.title })}
      full={full}
      fullLabel={t("full")}
      message={message}
      onClose={closeCanvas}
      onExport={() => {
        const base = canvasUrls(canvas.id, label, theme).external;
        if (!base) return;
        const url = new URL(base);
        url.searchParams.set("download", "1");
        window.open(url.href, "_blank", "noopener");
      }}
      onFixErrors={() => onPrefill(`${t("fixErrorsIntro")}\n\n${formatErrorLog(errors)}`)}
      onOpenExternal={() => {
        if (external) window.open(external, "_blank", "noopener,noreferrer");
      }}
      onPreviewWidthChange={setPreviewWidth}
      onReload={reload}
      onRestoreVersion={onRestoreVersion}
      onToggleFull={() => setCanvasMode(full ? "split" : "full")}
      onViewVersion={onViewVersion}
      openExternalLabel={t("openExternal")}
      previewWidth={previewWidth}
      previewWidthAriaLabel={t("previewWidth.label")}
      previewWidthLabels={
        Object.fromEntries(PREVIEW_WIDTHS.map((w) => [w, t(`previewWidth.${w}`)])) as Record<
          CanvasPanelPreviewWidth,
          string
        >
      }
      reloadLabel={t("reload")}
      restoreLabel={t("restore")}
      sandbox={isolated ? `${SANDBOX} allow-same-origin` : SANDBOX}
      src={frame}
      status={status}
      statusLabels={Object.fromEntries(STATUSES.map((s) => [s, t(`status.${s}`)]))}
      title={canvas.title}
      version={label}
      versions={versions}
      versionsLabel={t("versions")}
      viewingKey={String(viewing ?? currentVersion)}
      viewingLabel={(label) => t("viewing", { label })}
    />
  );
}
