import { useEffect } from 'react';

/**
 * Inertial wheel scrolling (like Lenis): each mouse-wheel notch sets a target and the page
 * glides toward it every frame instead of jumping. Touch, keyboard, scrollbar dragging and
 * programmatic scrolls keep working natively — we simply re-sync to wherever the page is.
 */
export default function useSmoothWheel({ enabled = true, stiffness = 9 } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;

    let target = window.scrollY;
    let current = window.scrollY;
    let lastSet = window.scrollY;
    let animating = false;
    let raf = 0;
    let last = 0;

    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

    const tick = (now) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      // Someone else moved the page (scrollbar, keys, scrollTo): hand control back.
      if (Math.abs(window.scrollY - lastSet) > 2) {
        animating = false;
        target = current = window.scrollY;
        return;
      }
      current += (target - current) * (1 - Math.exp(-dt * stiffness));
      if (Math.abs(target - current) < 0.5) current = target;
      lastSet = Math.round(current);
      window.scrollTo(0, current);
      lastSet = window.scrollY;
      if (current === target) {
        animating = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e) => {
      if (e.ctrlKey || e.defaultPrevented) return; // pinch-zoom / handled elsewhere
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // horizontal swipe
      e.preventDefault();
      if (!animating) {
        target = current = lastSet = window.scrollY;
      }
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = Math.max(0, Math.min(maxScroll(), target + e.deltaY * unit));
      if (!animating) {
        animating = true;
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(raf);
    };
  }, [enabled, stiffness]);
}
