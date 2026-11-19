import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionAddTile, ConnectionTile, ConnectionTileTestId } from "./ConnectionTile";

describe("ConnectionTile", () => {
  it("own tile shows the Own chip and what it serves", () => {
    render(
      <ConnectionTile
        health="ok"
        mark={<i />}
        meta={["synced 2 min ago"]}
        name="Jira"
        origin="own"
        serves="→ 4 projects"
        status="Connected"
      />,
    );
    expect(screen.getByTestId(ConnectionTileTestId.Source)).toHaveTextContent("Own→ 4 projects");
    expect(screen.getByTestId(ConnectionTileTestId.Status)).toHaveTextContent("Connected");
  });

  it("inherited tile shows where it comes from and is clickable", () => {
    const onClick = vi.fn();
    render(
      <ConnectionTile
        health="bad"
        mark={<i />}
        name="Slack"
        onClick={onClick}
        origin="inherited"
        sourceLabel="From Acme"
        status="Token revoked"
      />,
    );
    expect(screen.getByTestId(ConnectionTileTestId.Source)).toHaveTextContent("From Acme");
    fireEvent.click(screen.getByTestId(ConnectionTileTestId.Root));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("add tile fires onClick", () => {
    const onClick = vi.fn();
    render(<ConnectionAddTile hint="Jira, GitHub" label="Connect" onClick={onClick} />);
    fireEvent.click(screen.getByTestId(ConnectionTileTestId.Add));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
