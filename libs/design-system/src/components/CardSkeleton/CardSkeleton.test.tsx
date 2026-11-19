import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardSkeleton, CardSkeletonTestId } from "./CardSkeleton";

describe("CardSkeleton", () => {
  it("renders the requested silhouette", () => {
    render(<CardSkeleton shape="portrait" />);
    expect(screen.getByTestId(CardSkeletonTestId.Root)).toHaveAttribute("data-shape", "portrait");
    expect(screen.getAllByTestId(CardSkeletonTestId.Line).length).toBeGreaterThan(0);
  });
});
