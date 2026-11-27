import type { Ref } from "react";

export enum CardSkeletonTestId {
  Root = "card-skeleton-root",
  Line = "card-skeleton-line",
  Ring = "card-skeleton-ring",
}

export interface CardSkeletonProps {
  /** Silhouette: `card` (title + 2 lines + footer), `portrait` (centred avatar), `wide` (horizontal pipeline), `row` (single dense row), `ring` (goal card: ring + lines). */
  shape?: "card" | "portrait" | "wide" | "row" | "ring";
  ref?: Ref<HTMLDivElement>;
}

function Bar({ w, h = 10 }: { w: string; h?: number }) {
  return (
    <span
      aria-hidden
      className="block animate-pulse rounded-[5px] bg-ink/[0.07] motion-reduce:animate-none"
      data-testid={CardSkeletonTestId.Line}
      style={{ width: w, height: h }}
    />
  );
}

/** Placeholder card for a loading list, one silhouette per card family. */
export function CardSkeleton({ shape = "card", ref }: CardSkeletonProps) {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-[10px] rounded-[12px] border border-line bg-panel p-[16px]"
      data-shape={shape}
      data-testid={CardSkeletonTestId.Root}
      ref={ref}
    >
      {shape === "portrait" ? (
        <div className="flex flex-col items-center gap-[10px] py-[14px]">
          <span className="block size-[58px] animate-pulse rounded-[16px] bg-ink/[0.07] motion-reduce:animate-none" />
          <Bar h={12} w="50%" />
          <Bar w="70%" />
          <Bar w="40%" />
        </div>
      ) : shape === "wide" ? (
        <div className="flex gap-[20px]">
          <div className="flex w-[240px] flex-col gap-[10px]">
            <Bar h={12} w="60%" />
            <Bar w="90%" />
            <Bar w="70%" />
          </div>
          <div className="flex flex-1 items-center gap-[14px]">
            <Bar h={54} w="110px" />
            <Bar h={54} w="110px" />
            <Bar h={54} w="110px" />
          </div>
        </div>
      ) : shape === "ring" ? (
        <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-[18px] sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-[20px]">
          <span
            className="block size-[86px] animate-pulse rounded-full border-[9px] border-ink/[0.07] motion-reduce:animate-none sm:size-[132px]"
            data-testid={CardSkeletonTestId.Ring}
          />
          <div className="flex flex-col gap-[10px]">
            <Bar h={22} w="30%" />
            <Bar h={14} w="70%" />
            <Bar h={26} w="55%" />
            <Bar h={48} w="100%" />
          </div>
        </div>
      ) : shape === "row" ? (
        <div className="flex items-center gap-[12px]">
          <Bar h={22} w="22px" />
          <Bar h={12} w="30%" />
          <Bar w="40%" />
        </div>
      ) : (
        <>
          <Bar h={14} w="45%" />
          <Bar w="80%" />
          <Bar w="65%" />
          <Bar h={28} w="100%" />
        </>
      )}
    </div>
  );
}
