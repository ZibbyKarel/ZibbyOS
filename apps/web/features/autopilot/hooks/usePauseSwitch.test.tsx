import { renderHook } from "@testing-library/react";
import { type AutopilotStatus } from "@zibby/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePauseSwitch } from "./usePauseSwitch";

let status: AutopilotStatus = { paused: true, pendingApprovals: 0 };
const mutate = vi.fn();

vi.mock("../queries", () => ({ useAutopilotQuery: () => ({ data: status }) }));
vi.mock("../mutations", () => ({ useSetAutopilotMutation: () => ({ mutate, isPending: false }) }));

beforeEach(() => {
  mutate.mockReset();
  status = { paused: true, pendingApprovals: 0 };
});

describe("usePauseSwitch.resume", () => {
  it("always sends paused:false, even if the state already became unpaused (token retry)", () => {
    const { result, rerender } = renderHook(() => usePauseSwitch());
    result.current.resume();
    status = { paused: false, pendingApprovals: 0 };
    rerender();
    result.current.resume();
    expect(mutate.mock.calls.map((c) => c[0])).toEqual([
      { body: { paused: false } },
      { body: { paused: false } },
    ]);
  });
});
