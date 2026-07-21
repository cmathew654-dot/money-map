import { useRef, useState, type KeyboardEvent } from "react";

const inlineFieldWidthPadding = 2;
const inlineFieldMinWidth = 8;
const inlineFieldMaxWidth = 32;

interface InlineFieldProps {
  ariaLabel: string;
  value: string;
  multiline?: boolean;
  className?: string;
  onCommit(value: string): void;
  onCancel(): void;
}

export function InlineField({
  ariaLabel,
  value,
  multiline = false,
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
    autoFocus: true,
    className: `inline-field nodrag nowheel ${className ?? ""}`.trim(),
    style: multiline ? undefined : { width: `${visibleWidth}ch` },
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
