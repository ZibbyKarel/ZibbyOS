import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { focusRing } from "../../utils/focus";

export enum ZibbyChipTestId {
  Root = "zibby-chip-root",
  Orb = "zibby-chip-orb",
  Label = "zibby-chip-label",
  Kbd = "zibby-chip-kbd",
}

export interface ZibbyChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children" | "type"
> {
  /** 20 px orb slot (pass `<ZibbyOrb size={20} />`). */
  orb?: ReactNode;
  /** Visible label, e.g. "Zibby". */
  children?: ReactNode;
  /** Trailing shortcut slot (pass a `Kbd`). */
  kbd?: ReactNode;
  /** Accessible name (`aria-label`), e.g. "Summon Zibby (⌥ Space)". Required. */
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Header summon button (`.zchip`): 32 px pill with orb, label and shortcut. */
export function ZibbyChip({ orb, children, kbd, label, ref, ...rest }: ZibbyChipProps) {
  return (
    <button
      data-testid={ZibbyChipTestId.Root}
      {...rest}
      aria-label={label}
      className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full border border-line-2 bg-panel pl-[5px] pr-[6px] text-left text-[13px] text-ink hover:border-ink-3 hover:bg-panel-2 ${focusRing}`}
      ref={ref}
      type="button"
    >
      {orb ? (
        <span
          className="grid h-5 w-5 flex-none place-items-center"
          data-testid={ZibbyChipTestId.Orb}
        >
          {orb}
        </span>
      ) : null}
      {children ? <span data-testid={ZibbyChipTestId.Label}>{children}</span> : null}
      {kbd ? (
        <span className="inline-flex" data-testid={ZibbyChipTestId.Kbd}>
          {kbd}
        </span>
      ) : null}
    </button>
  );
}
