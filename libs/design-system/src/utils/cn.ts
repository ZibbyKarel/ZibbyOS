import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The custom `--text-*` sizes of `globals.css` (`@theme`). Without them tailwind-merge reads
 * `text-meta` / `text-body` … as a text colour and drops it next to `text-ink-3`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "caption",
            "display",
            "title-xl",
            "title-l",
            "widget-t1",
            "widget-t2",
            "widget-t3",
            "body",
            "reading",
            "meta",
            "mono",
            "overline",
          ],
        },
      ],
    },
  },
});

/**
 * Merge conditional class names and resolve Tailwind conflicts.
 * The single place the design system composes class strings.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
