import { useRef, useState, type KeyboardEvent } from "react";

const inlineFieldWidthPadding = 2;
const inlineFieldMinWidth = 8;
const inlineFieldMaxWidth = 32;

interface InlineFieldProps {
  ariaLabel: string;
  value: string;
  multiline?: boolean;
  sizeToContent?: boolean;
  className?: string;
  onCommit(value: string): void;
  onCancel(): void;
}

export function InlineField({
  ariaLabel,
  value,
  multiline = false,
  sizeToContent = true,
  className,
  onCommit,
  onCancel,
}: InlineFieldProps) {
  const [draft, setDraft] = useState(value);
  const composing = useRef(false);
  const cancelled = useRef(false);

  const commit = () => {
    if (cancelled.current || composing.current) return;
    onCommit(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // A field still holding exactly what it opened with is not an edit in
    // progress — it is the state a newly created object lands in, with its
    // default text preselected. Undo or the command palette pressed there
    // means "undo what I just made" / "open the palette", not "undo my
    // typing", and swallowing both made them silent no-ops at precisely the
    // moment a user reaches for them. Once anything has actually been typed
    // this yields, and native text undo behaves normally.
    if ((event.ctrlKey || event.metaKey) && draft === value) {
      const key = event.key.toLocaleLowerCase();
      if (key === "z" || key === "k") {
        cancelled.current = true;
        onCancel();
        // Deliberately no stopPropagation: the workspace shortcut handler
        // needs to see this, and it allows untouched inline fields through.
        return;
      }
    }
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      cancelled.current = true;
      setDraft(value);
      onCancel();
      return;
    }
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !composing.current &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      onCommit(draft);
    }
  };

  // Size single-line fields to their own content in `ch` units. Without this,
  // the shared width: 100% CSS rule collapses to the browser's default input
  // width inside a shrink-to-fit positioned wrapper, clipping long authored
  // values (e.g. an approximation-marked dollar figure) so only the tail is
  // visible once autofocus + select() scrolls the caret into view. Capped so a
  // long value cannot grow the field past its own node; multiline fields wrap
  // instead and keep the stylesheet's width, so content sizing never applies.
  const visibleWidth = Math.min(
    Math.max(draft.length + inlineFieldWidthPadding, inlineFieldMinWidth),
    inlineFieldMaxWidth,
  );

  const shared = {
    "aria-label": ariaLabel,
    // Lets the workspace shortcut handler distinguish "a field sitting on its
    // default text" from "an edit in progress" without reaching into state.
    "data-inline-untouched": draft === value ? "true" : undefined,
    autoFocus: true,
    className: `inline-field nodrag nowheel ${className ?? ""}`.trim(),
    style: multiline || !sizeToContent ? undefined : { width: `${visibleWidth}ch` },
    value: draft,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.currentTarget.value),
    onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      event.currentTarget.select(),
    onBlur: commit,
    onKeyDown: handleKeyDown,
    onCompositionStart: () => {
      composing.current = true;
    },
    onCompositionEnd: () => {
      composing.current = false;
    },
  };

  return multiline ? <textarea {...shared} rows={3} /> : <input {...shared} type="text" />;
}
