import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum ZibbyComposerBarTestId {
  Root = "zibby-composer-bar-root",
  Leading = "zibby-composer-bar-leading",
  Middle = "zibby-composer-bar-middle",
  Trailing = "zibby-composer-bar-trailing",
  Input = "zibby-composer-input",
}

export interface ZibbyComposerBarProps {
  /** Leading slot (the PTT button). */
  leading?: ReactNode;
  /** The text entry; the middle is `flex:1; min-width:0` and may grow with a multi-line editor. */
  children?: ReactNode;
  /** Trailing slot (send button …). */
  trailing?: ReactNode;
  /** Accessible name of the composer group. */
  label?: string;
  "data-testid"?: string;
  ref?: Ref<HTMLDivElement>;
}

/** The raised composer container (`.zc`). Items align to the bottom when the editor grows beyond one line. Top margin is the consumer's. */
export function ZibbyComposerBar({
  leading,
  children,
  trailing,
  label,
  "data-testid": testId = ZibbyComposerBarTestId.Root,
  ref,
}: ZibbyComposerBarProps) {
  const minH = leading ? "min-h-[48px]" : "min-h-[40px]";
  return (
    <div
      aria-label={label}
      className="flex items-end gap-[10px] rounded-[22px] border border-line-2 bg-panel p-2 shadow-[var(--shadow-pop)] focus-within:border-ink-3"
      data-testid={testId}
      ref={ref}
      role={label ? "group" : undefined}
    >
      {leading ? (
        <div className="flex flex-none items-center" data-testid={ZibbyComposerBarTestId.Leading}>
          {leading}
        </div>
      ) : null}
      <div
        className={cn("flex min-w-0 flex-1 items-center", minH)}
        data-testid={ZibbyComposerBarTestId.Middle}
      >
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {trailing ? (
        <div
          className={cn("flex flex-none items-center gap-1", minH)}
          data-testid={ZibbyComposerBarTestId.Trailing}
        >
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

export interface ZibbyComposerInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> {
  ref?: Ref<HTMLInputElement>;
}

/** Plain borderless text input for the composer middle (`.zin`). Give it an `aria-label`. */
export function ZibbyComposerInput({ ref, ...rest }: ZibbyComposerInputProps) {
  return (
    <input
      data-testid={ZibbyComposerBarTestId.Input}
      type="text"
      {...rest}
      className="h-10 w-full min-w-0 border-0 bg-transparent px-1.5 text-[14px] text-ink outline-none placeholder:text-ink-3"
      ref={ref}
    />
  );
}
