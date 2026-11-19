import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SourceEditor, SourceEditorTestId } from "./SourceEditor";

describe("SourceEditor", () => {
  it("numbers every source line and echoes the text in the backdrop", () => {
    render(
      <SourceEditor ariaLabel="Body" onChange={() => {}} value={"# Title\n\n- **bold** item"} />,
    );
    expect(screen.getByTestId(`${SourceEditorTestId.LineNumber}-3`)).toHaveTextContent("3");
    expect(screen.queryByTestId(`${SourceEditorTestId.LineNumber}-4`)).toBeNull();
    expect(screen.getByTestId(SourceEditorTestId.Backdrop)).toHaveTextContent("# Title");
  });

  it("reports edits through onChange", () => {
    const onChange = vi.fn();
    render(<SourceEditor ariaLabel="Body" onChange={onChange} value="a" />);
    fireEvent.change(screen.getByTestId(SourceEditorTestId.Control), { target: { value: "ab" } });
    expect(onChange).toHaveBeenCalledWith("ab");
    expect(screen.getByTestId(SourceEditorTestId.Control)).toHaveAccessibleName("Body");
  });
});
