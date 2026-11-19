"use client";
import { type ReactNode, useRef } from "react";
import { cn } from "../../utils/cn";

export enum SourceEditorTestId {
  Root = "source-editor-root",
  Gutter = "source-editor-gutter",
  /** One gutter number, suffixed with the 1-based line number. */
  LineNumber = "source-editor-line-number",
  Backdrop = "source-editor-backdrop",
  Control = "source-editor-control",
}

export interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  readOnly?: boolean;
}

// Shared by the backdrop and the textarea so the glyphs line up exactly.
const textClass = "m-0 py-3 pl-3 pr-4 font-mono text-[12.5px] leading-[1.75] whitespace-pre";

/** Light Markdown colouring for one source line: headings, **bold**, `code`, list markers. */
function highlightLine(line: string): ReactNode {
  if (/^#{1,6}\s/.test(line)) return <span className="font-bold text-ink">{line}</span>;
  const marker = /^(\s*(?:[-*+]|\d+\.)\s)/.exec(line)?.[1] ?? "";
  const rest = line.slice(marker.length);
  const parts = rest.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {marker && <span className="text-ink-3">{marker}</span>}
      {parts.map((part, i) =>
        part.startsWith("**") ? (
          <span className="font-bold text-ink" key={i}>
            {part}
          </span>
        ) : part.startsWith("`") ? (
          <span className="text-ok" key={i}>
            {part}
          </span>
        ) : (
          <span className="text-ink-2" key={i}>
            {part}
          </span>
        ),
      )}
    </>
  );
}

/**
 * A code-style Markdown source editor: line-number gutter, mono type and light syntax
 * colouring over a transparent textarea. It fills its (sized) parent and scrolls inside.
 * The highlight layer is an `aria-hidden` backdrop kept in sync with the textarea's scroll.
 */
export function SourceEditor({
  value,
  onChange,
  ariaLabel,
  placeholder,
  readOnly,
}: SourceEditorProps) {
  const gutter = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLPreElement>(null);
  const lines = value.split("\n");
  return (
    <div className="flex h-full min-h-0 overflow-hidden" data-testid={SourceEditorTestId.Root}>
      <div
        aria-hidden="true"
        className="w-11 shrink-0 select-none overflow-hidden border-r border-line py-3 text-right font-mono text-[11.5px] leading-[1.75] text-ink-3"
        data-testid={SourceEditorTestId.Gutter}
        ref={gutter}
      >
        {lines.map((_, i) => (
          <div className="pr-2.5" data-testid={`${SourceEditorTestId.LineNumber}-${i + 1}`} key={i}>
            {i + 1}
          </div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <pre
          aria-hidden="true"
          className={cn(textClass, "pointer-events-none absolute inset-0 overflow-hidden")}
          data-testid={SourceEditorTestId.Backdrop}
          ref={backdrop}
        >
          {lines.map((line, i) => (
            <div key={i}>{line === "" ? " " : highlightLine(line)}</div>
          ))}
        </pre>
        <textarea
          aria-label={ariaLabel}
          className={cn(
            textClass,
            "absolute inset-0 h-full w-full resize-none overflow-auto border-0 bg-transparent",
            "text-transparent caret-ink outline-none placeholder:text-ink-3",
          )}
          data-testid={SourceEditorTestId.Control}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            const { scrollTop, scrollLeft } = e.currentTarget;
            if (gutter.current) gutter.current.scrollTop = scrollTop;
            if (backdrop.current) {
              backdrop.current.scrollTop = scrollTop;
              backdrop.current.scrollLeft = scrollLeft;
            }
          }}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={false}
          value={value}
          wrap="off"
        />
      </div>
    </div>
  );
}
