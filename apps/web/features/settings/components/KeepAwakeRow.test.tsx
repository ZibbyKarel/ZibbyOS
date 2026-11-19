import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { renderSettings as render, screen } from "../testing/renderSettings";
import { KEEP_AWAKE_STORAGE_KEY, KeepAwakeRow, KeepAwakeRowTestId } from "./KeepAwakeRow";

beforeEach(() => localStorage.clear());

describe("KeepAwakeRow", () => {
  it("reads the stored value and persists changes", async () => {
    localStorage.setItem(KEEP_AWAKE_STORAGE_KEY, "false");
    render(<KeepAwakeRow />);
    const toggle = screen.getByTestId(KeepAwakeRowTestId.Toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(localStorage.getItem(KEEP_AWAKE_STORAGE_KEY)).toBe("true");
  });
});
