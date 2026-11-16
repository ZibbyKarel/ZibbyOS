import type { AnchorHTMLAttributes } from "react";
import type { Route } from "next";
import Link from "next/link";

/**
 * Adapts `next/link`'s `Link` (which types `href` as `Route | UrlObject`) to
 * the DS chrome's router-agnostic `linkComponent` contract (`href: string`) — the DS
 * itself never imports `next/link`. `href` is cast once here, at the one seam that needs it.
 */
export function NavLink({
  href,
  ...rest
}: { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return <Link href={href as Route} {...rest} />;
}
