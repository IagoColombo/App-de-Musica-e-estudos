import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Tells whether the sticky top bar is currently pinned over scrolled content.
 *
 * A 1px sentinel sits at the very top of the scrolling area. When it leaves the
 * viewport the page has been scrolled and the bar is pinned. IntersectionObserver
 * only reports changes in visibility, so there is no scroll listener and React
 * state is updated only when the bar changes between "resting" and "pinned".
 */
export function useStuckHeader(): { sentinelRef: RefObject<HTMLDivElement | null>; stuck: boolean } {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, stuck };
}
