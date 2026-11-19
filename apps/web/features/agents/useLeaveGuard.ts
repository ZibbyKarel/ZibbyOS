import { useCallback, useEffect, useState } from "react";

/**
 * Leave guard for a dirty page. The browser's own prompt covers reload / tab close
 * (`beforeunload`); an in-app click on a same-origin link is intercepted (the App
 * Router has no navigation-blocking API) and parked in `pending` so the page can ask
 * Save / Discard before calling `proceed()`.
 */
export function useLeaveGuard(active: boolean) {
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a || a.getAttribute("target") === "_blank") return;
      const url = new URL(a.getAttribute("href") ?? "", window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  const stay = useCallback(() => setPending(null), []);
  return { pending, stay };
}
