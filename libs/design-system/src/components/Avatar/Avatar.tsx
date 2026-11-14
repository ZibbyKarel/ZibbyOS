import type { HTMLAttributes, Ref } from "react";
import { cn } from "../../utils/cn";

export enum AvatarTestId {
  Root = "avatar-root",
  Image = "avatar-image",
  Fallback = "avatar-fallback",
}

export type AvatarSize = "xs" | "sm" | "md";

const sizeClass: Record<AvatarSize, string> = {
  /** 16px — the redesign's neutral row avatar (PR meta line). */
  xs: "size-4 text-[8px] font-bold",
  sm: "size-5 text-[10px]",
  md: "size-8 text-sm",
};

export interface AvatarProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  "className" | "children"
> {
  /** Person's name — the fallback initial; the image itself is decorative (the name sits beside it). */
  name: string;
  /** Image URL; empty or absent → the initial. */
  src?: string;
  size?: AvatarSize;
  ref?: Ref<HTMLSpanElement>;
}

/** A round user avatar: the picture, or the name's first letter when there is none. */
export function Avatar({ name, src, size = "sm", ref, ...props }: AvatarProps) {
  return (
    <span
      className={cn(
        // `uppercase` only capitalizes the single fallback initial (Bridge `.av`).
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised font-sans font-semibold uppercase text-ink-2",
        sizeClass[size],
      )}
      data-testid={AvatarTestId.Root}
      ref={ref}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatar of arbitrary size, no optimisation wanted
        <img alt="" className="size-full object-cover" data-testid={AvatarTestId.Image} src={src} />
      ) : (
        <span aria-hidden="true" data-testid={AvatarTestId.Fallback}>
          {name.trim().charAt(0)}
        </span>
      )}
    </span>
  );
}
