import { useCallback, useEffect, useRef, useState } from 'react';
import { journey } from '../scene/path';

/**
 * Maps page scroll to journey progress (0..1) so that each section arrives exactly when
 * the bike reaches its signpost, regardless of how tall the sections are.
 * Also provides an "auto ride" that scrolls through each stop with a short pause.
 */
export default function useJourneyScroll(count) {
  const anchors = useRef([]);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [autoRiding, setAutoRiding] = useState(false);
  const auto = useRef({ on: false, raf: 0, pauseUntil: 0, target: 1, last: 0 });

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
    setProgress(p);
    setActive(Math.round(p * (a.length - 1)));
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

  const goTo = useCallback((i) => {
    const a = anchors.current;
    if (a[i] === undefined) return;
    window.scrollTo({ top: a[i], behavior: 'smooth' });
  }, []);

  const stopAuto = useCallback(() => {
    auto.current.on = false;
    cancelAnimationFrame(auto.current.raf);
    setAutoRiding(false);
  }, []);

  const startAuto = useCallback(() => {
    const st = auto.current;
    const a = anchors.current;
    if (!a.length) return;
    // Restart from the top if we are already at the end.
    if (window.scrollY >= a[a.length - 1] - 2) window.scrollTo({ top: 0 });
    st.on = true;
    st.pauseUntil = 0;
    st.last = performance.now();
    st.target = a.findIndex((v) => v > window.scrollY + 2);
    setAutoRiding(true);

    const SPEED = 260; // px per second
    const tick = (now) => {
      if (!st.on) return;
      const dt = Math.min(0.05, (now - st.last) / 1000);
      st.last = now;
      const anchorsNow = anchors.current;
      if (st.target < 0 || st.target >= anchorsNow.length) return stopAuto();
      if (now < st.pauseUntil) {
        st.raf = requestAnimationFrame(tick);
        return;
      }
      const goal = anchorsNow[st.target];
      const next = Math.min(goal, window.scrollY + SPEED * dt);
      window.scrollTo({ top: next, behavior: 'instant' });
      if (next >= goal - 1) {
        st.target += 1;
        st.pauseUntil = now + 2800; // let the reader enjoy each stop
      }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }, [stopAuto]);

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

  return { active, progress, goTo, autoRiding, startAuto, stopAuto };
}
