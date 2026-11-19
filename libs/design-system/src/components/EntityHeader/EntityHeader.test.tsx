import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntityHeader, EntityHeaderTestId } from "./EntityHeader";

describe("EntityHeader", () => {
  it("renders title, meta, lede and the aside block", () => {
    render(
      <EntityHeader
        aside={<span>gauge</span>}
        lede="Freight booking"
        mark={<i />}
        title="Acme"
        titleMeta="acme"
        variant="company"
      />,
    );
    expect(screen.getByTestId(EntityHeaderTestId.Title)).toHaveTextContent("Acmeacme");
    expect(screen.getByTestId(EntityHeaderTestId.Root)).toHaveTextContent("Freight booking");
    expect(screen.getByTestId(EntityHeaderTestId.Aside)).toHaveTextContent("gauge");
  });

  it("omits the aside slot when none is given", () => {
    render(<EntityHeader mark={<i />} title="Platform" variant="team" />);
    expect(screen.queryByTestId(EntityHeaderTestId.Aside)).toBeNull();
  });
});

import { EntityLogo, EntityLogoTestId } from "./EntityHeader";

describe("EntityLogo", () => {
  it("upper-cases and clips to two letters", () => {
    render(<EntityLogo initials="acme" />);
    expect(screen.getByTestId(EntityLogoTestId.Root)).toHaveTextContent("AC");
  });
});
