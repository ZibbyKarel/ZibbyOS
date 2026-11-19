import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvatarStack, AvatarStackTestId } from "./AvatarStack";

const people = ["Karel Z", "Anna B", "Cyril D", "Dana E", "Eva F", "Filip G"].map((name) => ({
  name,
}));

describe("AvatarStack", () => {
  it("caps avatars and shows the label", () => {
    render(<AvatarStack items={people} label="6 osob" max={4} />);
    expect(screen.getAllByTestId(AvatarStackTestId.Item)).toHaveLength(4);
    expect(screen.getByTestId(AvatarStackTestId.Label)).toHaveTextContent("6 osob");
  });
  it("spread mode shows a +N bubble", () => {
    render(<AvatarStack spread items={people} max={4} />);
    expect(screen.getByTestId(AvatarStackTestId.More)).toHaveTextContent("+2");
  });
});
