import type { Meta, StoryObj } from "@storybook/react";
import { ZibbyOrb } from "../ZibbyOrb/ZibbyOrb";
import { ZibbyStatusAction, ZibbyStatusLink, ZibbyStatusMenu } from "./ZibbyStatusMenu";

const meta: Meta<typeof ZibbyStatusMenu> = {
  title: "DesignSystem/ZibbyStatusMenu",
  component: ZibbyStatusMenu,
};
export default meta;

export const Statuses: StoryObj<typeof ZibbyStatusMenu> = {
  render: () => (
    <div className="flex gap-4 p-6 text-ink">
      {(["run", "paused"] as const).map((status) => (
        <div
          className="w-[360px] overflow-hidden rounded-[10px] border border-line-2 bg-sheet"
          key={status}
        >
          <ZibbyStatusMenu
            description="Does what the autonomy levels allow."
            orb={<ZibbyOrb size={52} state={status === "run" ? "think" : "sleep"} />}
            orbLabel="Zibby"
            state={status === "run" ? " · Zibby thinks" : " · Zibby sleeps"}
            status={status}
            title={status === "run" ? "Running" : "Paused"}
          >
            <ZibbyStatusAction
              hint="Work in progress waits"
              label={status === "run" ? "Pause Zibby" : "Resume Zibby"}
              resume={status === "paused"}
            />
            <ZibbyStatusLink
              hint="No exceptions, same everywhere"
              icon="shield"
              label="Autonomy levels"
            />
          </ZibbyStatusMenu>
        </div>
      ))}
    </div>
  ),
};
