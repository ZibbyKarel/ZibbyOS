import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsLayout, SettingsLayoutTestId } from "./SettingsLayout";

const nav = [
  { id: "general", href: "/s/general", label: "General", icon: "gear" as const, active: true },
  { id: "access", href: "/s/access", label: "Access", icon: "lock" as const },
];
const anchors = [
  { id: "a", label: "Language" },
  { id: "b", label: "Appearance" },
  { id: "c", label: "Shortcuts", warn: true },
  { id: "d", label: "Live log", dirty: true },
];
const base = {
  navTitle: "Settings",
  navLabel: "Settings pages",
  nav,
  onNavigate: vi.fn(),
  eyebrow: "Settings",
  title: "General",
  subtitle: "How do I want it?",
  anchorsTitle: "On this page",
};

describe("SettingsLayout", () => {
  it("renders the rail with the active page marked and the page header", () => {
    render(
      <SettingsLayout {...base} anchors={anchors} navFooter="v1.1.2">
        <p>panels</p>
      </SettingsLayout>,
    );
    const items = screen.getAllByTestId(SettingsLayoutTestId.NavItem);
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId(SettingsLayoutTestId.Header)).toHaveTextContent("General");
    expect(screen.getByTestId(SettingsLayoutTestId.NavFooter)).toHaveTextContent("v1.1.2");
    expect(screen.getByTestId(SettingsLayoutTestId.Main)).toHaveTextContent("panels");
  });

  it("lists anchors only when the page has 4 or more panels", () => {
    const { rerender } = render(
      <SettingsLayout {...base} anchors={anchors}>
        x
      </SettingsLayout>,
    );
    expect(screen.getAllByTestId(SettingsLayoutTestId.Anchor)).toHaveLength(4);
    expect(screen.getAllByTestId(SettingsLayoutTestId.Anchor)[0]).toHaveAttribute("href", "#a");
    rerender(
      <SettingsLayout {...base} anchors={anchors.slice(0, 3)}>
        x
      </SettingsLayout>,
    );
    expect(screen.queryByTestId(SettingsLayoutTestId.Anchors)).toBeNull();
  });

  it("navigates from the phone page select", () => {
    const onNavigate = vi.fn();
    render(
      <SettingsLayout {...base} anchors={[]} onNavigate={onNavigate}>
        x
      </SettingsLayout>,
    );
    fireEvent.change(screen.getByTestId(SettingsLayoutTestId.NavSelect), {
      target: { value: "/s/access" },
    });
    expect(onNavigate).toHaveBeenCalledWith("/s/access");
  });
});
