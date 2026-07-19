import { useRef, useState, type KeyboardEvent } from "react";

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

  const shared = {
    "aria-label": ariaLabel,
    autoFocus: true,
    className: `inline-field nodrag nowheel ${className ?? ""}`.trim(),
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
