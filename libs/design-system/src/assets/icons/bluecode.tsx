import type { ReactNode } from "react";

/** BlueCode gateway mark — a rounded frame holding a "B" glyph, stroked in `currentColor`. */
export const bluecode: ReactNode = (
  <>
    <rect height="18" rx="4" width="18" x="3" y="3" />
    <path d="M9.5 7.5v9h3.2a2.25 2.25 0 0 0 0-4.5H9.5m0 0h2.8a2.25 2.25 0 0 0 0-4.5H9.5" />
  </>
);
