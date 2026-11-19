import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegistryList, RegistryListTestId } from "./RegistryList";

describe("RegistryList", () => {
  it("renders rows and an optional terminal bar", () => {
    const { rerender } = render(
      <RegistryList>
        <li>a</li>
      </RegistryList>,
    );
    expect(screen.queryByTestId(RegistryListTestId.Bar)).toBeNull();
    rerender(
      <RegistryList terminalTitle="~/cmds">
        <li>a</li>
      </RegistryList>,
    );
    expect(screen.getByTestId(RegistryListTestId.Bar)).toHaveTextContent("~/cmds");
  });
});
