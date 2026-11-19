"use client";

import {
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  useId,
  useRef,
  useState,
} from "react";
import MDEditor, { commands } from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { useResolvedTheme } from "../../DesignSystemContext/hooks";
import { Stack } from "../Stack/Stack";

export enum MarkdownEditorTestId {
  Root = "markdown-editor-root",
  Label = "markdown-editor-label",
  /** Wrapper carrying the editor's `data-color-mode` (follows the DS theme). */
  Frame = "markdown-editor-frame",
  Control = "markdown-editor-control",
  Hint = "markdown-editor-hint",
  /** The `[[` autocomplete list. */
  Suggestions = "markdown-editor-suggestions",
  /** One suggestion, suffixed with the target id. */
  Suggestion = "markdown-editor-suggestion",
}

/** A note a `[[wikilink]]` can point at. */
export interface WikilinkTarget {
  id: string;
  label: string;
}

const MAX_SUGGESTIONS = 6;

/** The open `[[query` before the caret, or null. */
function openWikilink(value: string, caret: number): { start: number; text: string } | null {
  const m = /\[\[([^\]\n]*)$/.exec(value.slice(0, caret));
  return m ? { start: caret - m[0].length, text: m[1] ?? "" } : null;
}

const labelClass = "text-meta font-medium text-ink-3";

/**
 * Map the third-party editor's GitHub-primer colour variables onto the live
 * z.i.b.b.y tokens so the rich editor inherits the Zibby 2.0 palette instead of
 * shipping its own skin. Applied inline on the editor root and the preview pane
 * themselves: the library re-declares these vars on `.wmde-markdown-var` per
 * `data-color-mode`, so values inherited from a wrapper would lose to GitHub's
 * near-black dark canvas. The canvas is transparent — the editor sits on
 * whatever surface hosts it — and the frame is a rounded `--line2` hairline.
 * The cast keeps the CSS custom properties type-safe in `style`.
 */
const themeVars = {
  "--color-canvas-default": "transparent",
  "--color-canvas-subtle": "var(--color-code-bg)",
  "--color-border-default": "var(--color-line-2)",
  "--color-border-muted": "var(--color-line)",
  "--color-fg-default": "var(--color-foreground)",
  "--color-fg-muted": "var(--color-foreground-dim)",
  "--color-fg-subtle": "var(--color-foreground-faint)",
  "--color-accent-fg": "var(--color-accent)",
  "--color-accent-emphasis": "var(--color-accent)",
  "--color-neutral-muted": "var(--color-hover)",
  "--md-editor-font-family": "var(--font-sans)",
} as CSSProperties;

/** The editor root: the vars above plus the rounded card frame (`--radius`). */
const editorStyle = {
  ...themeVars,
  borderRadius: "var(--radius)",
  overflow: "hidden",
} as CSSProperties;

export interface MarkdownEditorProps {
  /** Markdown body. Frontmatter is owned elsewhere and never edited here. */
  value: string;
  onChange: (value: string) => void;
  /** Field label rendered above the editor. */
  label?: string;
  /** Helper text rendered under the editor. */
  hint?: string;
  placeholder?: string;
  /** Accessible name for the textarea when no visible `label` is provided. */
  ariaLabel?: string;
  /** Grow to the parent's height (parent must be a sized flex column) instead of a fixed 420px. */
  fill?: boolean;
  /** Blocks typing and drops toolbar edits; the toolbar stays visible so it does not flicker when toggled. */
  readOnly?: boolean;
  /** Notes offered by the `[[` autocomplete (typing `[[` opens it; Up/Down + Enter/Tab insert `[[id]]`). */
  wikilinkTargets?: readonly WikilinkTarget[];
}

/**
 * Rich Markdown editor (toolbar + Editor/Náhled toggle) wrapping
 * `@uiw/react-md-editor`, re-themed to the design-system tokens. The editor
 * only ever sees the Markdown *body*: YAML frontmatter is assembled by the
 * backend from structured fields, never typed here.
 */
export function MarkdownEditor({
  value,
  onChange,
  label,
  hint,
  placeholder,
  ariaLabel,
  fill = false,
  readOnly,
  wikilinkTargets,
}: MarkdownEditorProps) {
  const id = useId();
  const theme = useResolvedTheme();
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [link, setLink] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);

  const q = link?.text.toLowerCase() ?? "";
  const matches =
    link && wikilinkTargets
      ? wikilinkTargets
          .filter((t) => t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q))
          .slice(0, MAX_SUGGESTIONS)
      : [];

  const insert = (target: WikilinkTarget) => {
    const ta = area.current;
    if (!link || !ta) return;
    const caret = ta.selectionStart;
    const next = `${value.slice(0, link.start)}[[${target.id}]]${value.slice(caret)}`;
    const pos = link.start + target.id.length + 4;
    onChange(next);
    setLink(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!link || matches.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const pick = matches[Math.min(active, matches.length - 1)];
      if (pick) insert(pick);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setLink(null);
    }
  };
  // Declared (not an inline literal) so the extra `data-testid`, absent from
  // the third-party `ITextAreaProps`, passes structural assignability instead
  // of tripping the excess-property check.
  const textareaProps = {
    id,
    placeholder,
    spellCheck: false,
    readOnly,
    "aria-label": ariaLabel ?? label,
    "data-testid": MarkdownEditorTestId.Control,
    onKeyDown,
  };
  return (
    <Stack data-testid={MarkdownEditorTestId.Root} gap="100" grow={fill} minH0={fill}>
      {label && (
        <label className={labelClass} data-testid={MarkdownEditorTestId.Label} htmlFor={id}>
          {label}
        </label>
      )}
      <div
        className={fill ? "flex min-h-0 flex-1 flex-col" : undefined}
        data-color-mode={theme}
        data-testid={MarkdownEditorTestId.Frame}
      >
        <MDEditor
          className={
            fill
              ? "min-h-0 flex-1 [&_.w-md-editor-content]:min-h-0 [&_.w-md-editor-content]:flex-1"
              : undefined
          }
          extraCommands={[commands.codeEdit, commands.codePreview]}
          height={fill ? "100%" : 420}
          onChange={(next, event?: ChangeEvent<HTMLTextAreaElement>) => {
            // Toolbar commands edit via setRangeText, which ignores `readonly`.
            if (readOnly) return;
            onChange(next ?? "");
            if (!wikilinkTargets || !event) return;
            area.current = event.target;
            setLink(openWikilink(next ?? "", event.target.selectionStart));
            setActive(0);
          }}
          preview="edit"
          previewOptions={{ style: themeVars }}
          style={editorStyle}
          textareaProps={textareaProps}
          value={value}
          visibleDragbar={false}
        />
      </div>
      {matches.length > 0 && (
        <div
          className="flex flex-col rounded border border-line-2 bg-surface p-1"
          data-testid={MarkdownEditorTestId.Suggestions}
          role="listbox"
        >
          {/* onMouseDown keeps the textarea focused so the caret survives the click */}
          {matches.map((m, i) => (
            <button
              aria-selected={i === active}
              className={`flex items-center gap-2 rounded px-2 py-1 text-left font-sans text-xs text-ink ${i === active ? "bg-hover" : ""}`}
              data-testid={`${MarkdownEditorTestId.Suggestion}-${m.id}`}
              key={m.id}
              onClick={() => insert(m)}
              onMouseDown={(e) => e.preventDefault()}
              role="option"
              type="button"
            >
              <span className="truncate">{m.label}</span>
              <span className="truncate font-mono text-ink-3">{m.id}</span>
            </button>
          ))}
        </div>
      )}
      {hint && (
        <span
          className="font-sans text-xs text-foreground-faint"
          data-testid={MarkdownEditorTestId.Hint}
        >
          {hint}
        </span>
      )}
    </Stack>
  );
}
