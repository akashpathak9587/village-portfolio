import { useCallback, useEffect, useRef, useState } from 'react';
import { journey } from '../scene/path';

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Maps page scroll to journey progress (0..1) so that each section arrives exactly when
 * the bike reaches its signpost, regardless of how tall the sections are.
 *
 * Progress is written straight into the shared `journey` object (read by the 3D scene and
 * the route bar every frame), so scrolling never re-renders React. Only the active stop,
 * which changes a handful of times per ride, lives in state.
 *
 * Also provides an "auto ride" that glides from stop to stop with an eased start and
 * stop, pausing at each one.
 */
export default function useJourneyScroll(count) {
  const anchors = useRef([]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [autoRiding, setAutoRiding] = useState(false);
  const auto = useRef({ on: false, raf: 0 });

  const measure = useCallback(() => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const list = [];
    for (let i = 0; i < count; i++) {
      const el = document.querySelector(`[data-stop="${i}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const anchor = top + rect.height / 2 - window.innerHeight / 2;
      list.push(Math.min(max, Math.max(0, anchor)));
    }
    if (list.length) {
      list[0] = 0;
      list[list.length - 1] = max;
    }
    anchors.current = list;
  }, [count]);

  const update = useCallback(() => {
    const a = anchors.current;
    if (a.length < 2) return;
    const y = window.scrollY;
    let i = 0;
    while (i < a.length - 2 && y > a[i + 1]) i++;
    const span = a[i + 1] - a[i] || 1;
    const local = Math.min(1, Math.max(0, (y - a[i]) / span));
    const p = (i + local) / (a.length - 1);
    journey.p = p;
    const nextActive = Math.round(p * (a.length - 1));
    if (nextActive !== activeRef.current) {
      activeRef.current = nextActive;
      setActive(nextActive);
    }
  }, []);

  useEffect(() => {
    measure();
    update();
    const onResize = () => {
      measure();
      update();
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [measure, update]);

  const stopAuto = useCallback(() => {
    auto.current.on = false;
    cancelAnimationFrame(auto.current.raf);
    setAutoRiding(false);
  }, []);

  /** Eased glide to a scroll position; resolves when it arrives or is interrupted. */
  const glideTo = useCallback((goal, token) => {
    return new Promise((resolve) => {
      const start = window.scrollY;
      const dist = goal - start;
      const duration = Math.min(4.5, Math.max(1.2, Math.abs(dist) / 380)) * 1000;
      const t0 = performance.now();
      const step = (now) => {
        if (token && !auto.current.on) return resolve(false);
        const k = Math.min(1, (now - t0) / duration);
        window.scrollTo(0, start + dist * easeInOut(k));
        if (k < 1) auto.current.raf = requestAnimationFrame(step);
        else resolve(true);
      };
      auto.current.raf = requestAnimationFrame(step);
    });
  }, []);

  const goTo = useCallback(
    (i) => {
      const a = anchors.current;
      if (a[i] === undefined) return;
      stopAuto();
      glideTo(a[i]);
    },
    [glideTo, stopAuto],
  );

  const startAuto = useCallback(async () => {
    const a = anchors.current;
    if (!a.length) return;
    const st = auto.current;
    st.on = true;
    setAutoRiding(true);
    if (window.scrollY >= a[a.length - 1] - 2) {
      // Already at the end: glide back to the start first.
      if (!(await glideTo(0, true))) return;
    }
    let i = a.findIndex((v) => v > window.scrollY + 2);
    while (st.on && i >= 0 && i < anchors.current.length) {
      if (!(await glideTo(anchors.current[i], true))) return;
      i += 1;
      if (i >= anchors.current.length) break;
      // Let the reader enjoy each stop.
      await new Promise((r) => setTimeout(r, 2600));
    }
    if (st.on) stopAuto();
  }, [glideTo, stopAuto]);

  // Any manual interaction cancels the auto ride.
  useEffect(() => {
    if (!autoRiding) return undefined;
    const cancel = () => stopAuto();
    const onKey = (e) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Escape'].includes(e.key)) stopAuto();
    };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [autoRiding, stopAuto]);

  useEffect(() => () => cancelAnimationFrame(auto.current.raf), []);

  return { active, goTo, autoRiding, startAuto, stopAuto };
}
