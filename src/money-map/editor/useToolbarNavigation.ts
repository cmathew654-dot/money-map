import { useEffect, useState, type KeyboardEvent } from "react";

const navigationKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

export function useToolbarNavigation(itemCount: number) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, itemCount - 1)));
  }, [itemCount]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!navigationKeys.has(event.key) || itemCount === 0) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
    );
    if (buttons.length === 0) return;
    const target =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLButtonElement>("button:not([disabled])")
        : null;
    const focusedIndex = target ? buttons.indexOf(target) : -1;
    const currentIndex = focusedIndex >= 0 ? focusedIndex : activeIndex;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowRight" || event.key === "ArrowDown"
            ? (currentIndex + 1) % buttons.length
            : (currentIndex - 1 + buttons.length) % buttons.length;

    event.preventDefault();
    setActiveIndex(nextIndex);
    buttons[nextIndex]?.focus();
  };

  return {
    itemProps: (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      onFocus: () => setActiveIndex(index),
    }),
    onKeyDown,
  };
}
