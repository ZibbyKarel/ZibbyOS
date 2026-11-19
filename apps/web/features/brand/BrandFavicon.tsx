"use client";

import { useEffect } from "react";
import { useApprovalsQuery } from "../approvals/queries";
import { useRunsQuery } from "../runs/queries";
import { deriveBrandState, faviconDataUri } from "./brandState";

/** Swaps the tab favicon to the state-coloured mark (amber waits, violet runs, grey calm). Renders nothing. */
export function BrandFavicon() {
  const { data: approvals } = useApprovalsQuery();
  const { runs } = useRunsQuery();
  const state = deriveBrandState({
    pendingApprovals: approvals?.length ?? 0,
    runStatuses: runs.map((r) => r.status),
  });

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = faviconDataUri(state);
    // Our link goes last so it wins over the static icons; removed on change/unmount.
    document.head.appendChild(link);
    return () => link.remove();
  }, [state]);

  return null;
}
