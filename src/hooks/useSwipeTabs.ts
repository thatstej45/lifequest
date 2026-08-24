import { TouchEvent, useRef } from 'react';

const MIN_SWIPE_DISTANCE = 56;
const MAX_VERTICAL_DRIFT = 72;

export function useSwipeTabs<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  onChange: (tab: T) => void,
) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, button, a, [contenteditable="true"], [data-no-swipe]')) {
      start.current = null;
      return;
    }
    const touch = event.changedTouches[0];
    start.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (!start.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.current.x;
    const deltaY = touch.clientY - start.current.y;
    start.current = null;

    if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE || Math.abs(deltaY) > MAX_VERTICAL_DRIFT) return;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1);
    if (nextIndex >= 0 && nextIndex < tabs.length) onChange(tabs[nextIndex]);
  };

  return { onTouchStart, onTouchEnd };
}
