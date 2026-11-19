"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** What a settings panel tells the draft grammar about itself. */
export interface DraftPanelHandle {
  id: string;
  /** Short name listed on the save bar ("Schedulers"). */
  label: string;
  dirty: boolean;
  /** Persist this panel only. */
  save: () => Promise<void>;
  discard: () => void;
  /** Panels sharing a batch key are saved by ONE call on "Save all" (e.g. one PUT of one document). */
  batch?: { key: string; save: () => Promise<void> };
}

export interface SettingsDraftContextValue {
  /** The daemon is unreachable — every control is read-only. */
  readOnly: boolean;
  dirtyPanels: readonly { id: string; label: string }[];
  saving: boolean;
  error: string | undefined;
  savePanel: (id: string) => Promise<void>;
  saveAll: () => Promise<void>;
  discardPanel: (id: string) => void;
  discardAll: () => void;
  register: (handle: DraftPanelHandle) => void;
  unregister: (id: string) => void;
  clearError: () => void;
}

const Ctx = createContext<SettingsDraftContextValue | null>(null);

export interface SettingsDraftProviderProps {
  readOnly: boolean;
  children: ReactNode;
}

/**
 * Per-page draft state for settings: panels register their dirty/save/discard handles,
 * the provider answers "what is dirty" (anchor rail, save bar), saves one panel or all
 * of them (batched panels once), and surfaces the first failure so the save bar can show
 * it while the edits stay kept. The page owns Cmd+S and the leave guard (see
 * `SettingsSaveBar`).
 */
export function SettingsDraftProvider({ readOnly, children }: SettingsDraftProviderProps) {
  const handles = useRef(new Map<string, DraftPanelHandle>());
  const [dirtyPanels, setDirtyPanels] = useState<{ id: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const sync = useCallback(() => {
    const next = [...handles.current.values()]
      .filter((h) => h.dirty)
      .map((h) => ({ id: h.id, label: h.label }));
    setDirtyPanels((prev) =>
      prev.length === next.length &&
      prev.every((p, i) => p.id === next[i]?.id && p.label === next[i]?.label)
        ? prev
        : next,
    );
  }, []);

  const register = useCallback(
    (handle: DraftPanelHandle) => {
      handles.current.set(handle.id, handle);
      sync();
    },
    [sync],
  );
  const unregister = useCallback(
    (id: string) => {
      handles.current.delete(id);
      sync();
    },
    [sync],
  );

  const run = useCallback(async (work: () => Promise<void>) => {
    setSaving(true);
    setError(undefined);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, []);

  const savePanel = useCallback(
    (id: string) => run(async () => void (await handles.current.get(id)?.save())),
    [run],
  );
  const saveAll = useCallback(
    () =>
      run(async () => {
        const dirty = [...handles.current.values()].filter((h) => h.dirty);
        const done = new Set<string>();
        for (const h of dirty) {
          if (h.batch) {
            if (done.has(h.batch.key)) continue;
            done.add(h.batch.key);
            await h.batch.save();
          } else {
            await h.save();
          }
        }
      }),
    [run],
  );
  const discardPanel = useCallback((id: string) => {
    handles.current.get(id)?.discard();
    setError(undefined);
  }, []);
  const discardAll = useCallback(() => {
    for (const h of handles.current.values()) if (h.dirty) h.discard();
    setError(undefined);
  }, []);
  const clearError = useCallback(() => setError(undefined), []);

  const value = useMemo<SettingsDraftContextValue>(
    () => ({
      readOnly,
      dirtyPanels,
      saving,
      error,
      savePanel,
      saveAll,
      discardPanel,
      discardAll,
      register,
      unregister,
      clearError,
    }),
    [
      readOnly,
      dirtyPanels,
      saving,
      error,
      savePanel,
      saveAll,
      discardPanel,
      discardAll,
      register,
      unregister,
      clearError,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettingsDraft(): SettingsDraftContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettingsDraft must be used inside SettingsDraftProvider");
  return ctx;
}

/** Outside a provider (tests rendering a bare section) panels behave as writable and unguarded. */
export function useOptionalSettingsDraft(): SettingsDraftContextValue | null {
  return useContext(Ctx);
}

/**
 * Registers a panel with the draft grammar. Handles are re-published every render so the
 * latest closures (current draft values) are what Save sees; the panel unregisters on unmount.
 */
export function useDraftPanel(handle: DraftPanelHandle): void {
  const draft = useOptionalSettingsDraft();
  const register = draft?.register;
  const unregister = draft?.unregister;
  const handleRef = useRef(handle);
  useEffect(() => {
    handleRef.current = handle;
    // A stable proxy so the registered handle always calls the freshest closures.
    register?.({
      get id() {
        return handleRef.current.id;
      },
      get label() {
        return handleRef.current.label;
      },
      get dirty() {
        return handleRef.current.dirty;
      },
      save: () => handleRef.current.save(),
      discard: () => handleRef.current.discard(),
      get batch() {
        const b = handleRef.current.batch;
        return b ? { key: b.key, save: () => handleRef.current.batch!.save() } : undefined;
      },
    });
  });
  useEffect(() => {
    const id = handle.id;
    return () => unregister?.(id);
  }, [handle.id, unregister]);
}

/** True while the daemon is unreachable (controls must be disabled). False outside a provider. */
export function useSettingsReadOnly(): boolean {
  return useContext(Ctx)?.readOnly ?? false;
}
