import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import TopTabs from '../components/TopTabs';
import useSmoothWheel from '../components/useSmoothWheel';
import { buildPages, renderEndpaper } from './pages';
import './book.css';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
// Smooth in/out so each page eases off the stack and settles gently.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function useMedia(query) {
  const get = () => window.matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

function usePageWidth(single) {
  const calc = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const byHeight = (vh - 150) / 1.4;
    return Math.round(single ? Math.min(440, vw - 32, byHeight) : Math.min(470, (vw - 96) / 2, byHeight));
  };
  const [w, setW] = useState(calc);
  useEffect(() => {
    const on = () => setW(calc());
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single]);
  return w;
}

/**
 * A scroll-driven book. The page is made very tall; the book sits in a sticky stage and
 * every scroll position maps to an exact rotation of each leaf, so scrolling scrubs the
 * page turns smoothly in both directions. A little inertia is added on top.
 */
export default function ProjectBook({ profile, route, reducedMotion }) {
  const single = useMedia('(max-width: 820px)');
  useSmoothWheel();
  const pw = usePageWidth(single);

  const wrapRef = useRef(null);
  const bookRef = useRef(null);
  const leafRefs = useRef([]);
  const anim = useRef({ target: 0, cur: 0, raf: 0, last: 0, spread: -1, range: '' });
  const [spread, setSpread] = useState(0);
  // The spreads on either side of the current position (both are partly visible mid-turn).
  const [range, setRange] = useState([0, 0]);
  const [seen, setSeen] = useState(() => new Set());

  // ---- Build leaves from the flat page list ----
  const leavesRef = useRef(0);
  const scrollToSpread = useCallback((s) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const max = wrap.offsetHeight - window.innerHeight;
    const L = leavesRef.current || 1;
    window.scrollTo({ top: wrap.offsetTop + (s / L) * max, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [reducedMotion]);

  const goToProject = useCallback((j) => scrollToSpread(single ? 2 + j * 2 : j + 1), [scrollToSpread, single]);

  const pages = useMemo(() => buildPages(profile, goToProject), [profile, goToProject]);
  const endPage = pages[pages.length - 1];
  const leaves = useMemo(() => {
    const body = pages.slice(0, -1);
    if (single) return body.map((p) => ({ front: p, back: null }));
    const out = [];
    for (let i = 0; i < body.length; i += 2) out.push({ front: body[i], back: body[i + 1] || null });
    return out;
  }, [pages, single]);
  const L = leaves.length;
  leavesRef.current = L;

  // Which pages are face-up for a given resting spread.
  const visibleKeys = useCallback(
    (s) => {
      const keys = [];
      if (!single && s > 0 && leaves[s - 1]?.back) keys.push(leaves[s - 1].back.key);
      keys.push(s < L ? leaves[s].front.key : endPage.key);
      return keys;
    },
    [leaves, L, single, endPage],
  );

  // ---- Apply a progress value (in "leaves turned") to the DOM ----
  const apply = useCallback(
    (f) => {
      for (let i = 0; i < L; i++) {
        const el = leafRefs.current[i];
        if (!el) continue;
        const e = ease(clamp01((f - i - 0.12) / 0.76));
        const lift = Math.sin(Math.PI * e);
        el.style.transform = `translateZ(${lift * 40}px) rotateY(${-180 * e}deg) skewY(${lift * -1.5}deg)`;
        el.style.zIndex = e <= 0 ? L - i : e >= 1 ? L + i : 3 * L;
        el.style.setProperty('--turn', e.toFixed(4));
        el.style.setProperty('--lift', lift.toFixed(4));
        el.style.visibility = single && e >= 1 ? 'hidden' : 'visible';
      }
      if (bookRef.current) {
        const open = ease(clamp01((f - 0.12) / 0.76));
        // Closed book: centre the cover and tilt it a little more, like it's lying on a desk.
        const shift = single ? 0 : (1 - open) * -25;
        const tilt = 16 - open * 10;
        bookRef.current.style.transform = `translateX(${shift}%) rotateX(${tilt}deg)`;
        bookRef.current.style.setProperty('--open', open.toFixed(4));
      }
      const s = Math.min(L, Math.max(0, Math.round(f)));
      if (s !== anim.current.spread) {
        anim.current.spread = s;
        setSpread(s);
      }
      const lo = Math.min(L, Math.max(0, Math.floor(f + 0.02)));
      const hi = Math.min(L, Math.max(0, Math.ceil(f - 0.02)));
      const key = `${lo}-${hi}`;
      if (key !== anim.current.range) {
        anim.current.range = key;
        setRange([lo, hi]);
      }
    },
    [L, single],
  );

  // Reveal ("ink in") the pages of each spread the first time they are seen.
  useEffect(() => {
    const keys = [...visibleKeys(range[0]), ...visibleKeys(range[1])];
    setSeen((prev) => {
      if (keys.every((k) => prev.has(k))) return prev;
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  }, [range, visibleKeys]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.title = `Project Book · ${profile.name}`;
  }, [profile.name]);

  // ---- Scroll → target progress, then ease toward it every frame ----
  useEffect(() => {
    const st = anim.current;
    const read = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const max = Math.max(1, wrap.offsetHeight - window.innerHeight);
      st.target = clamp01((window.scrollY - wrap.offsetTop) / max) * L;
    };
    read();
    st.cur = st.target;
    apply(st.cur);

    const tick = (now) => {
      const dt = Math.min(0.05, st.last ? (now - st.last) / 1000 : 0.016);
      st.last = now;
      const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
      st.cur += (st.target - st.cur) * k;
      if (Math.abs(st.target - st.cur) < 0.0004) st.cur = st.target;
      apply(st.cur);
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
    window.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      cancelAnimationFrame(st.raf);
      window.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, [L, apply, reducedMotion]);

  // Keyboard: ← / → turn one page.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') scrollToSpread(Math.min(L, anim.current.spread + 1));
      if (e.key === 'ArrowLeft') scrollToSpread(Math.max(0, anim.current.spread - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [L, scrollToSpread]);

  const face = (page, side) => {
    if (!page) return <div className={`face face--${side} face--blank`} />;
    const active = seen.has(page.key);
    return (
      <div className={`face face--${side} face--${page.kind} ${active ? 'is-inked' : ''}`}>
        {page.render()}
        <div className="face__shade" />
      </div>
    );
  };

  const total = L + 1;
  const label =
    spread === 0 ? 'Cover' : spread >= L ? 'The End' : single ? `Page ${spread} of ${pages.length - 1}` : `Spread ${spread} of ${L}`;

  return (
    <div className="bookview" style={{ '--pw': `${pw}px` }}>
      <div className="bookview__desk" aria-hidden="true" />
      <header className="bookbar">
        <TopTabs route={route} />
        <div className="bookbar__progress" aria-hidden="true">
          <div style={{ width: `${(spread / L) * 100}%` }} />
        </div>
        <span className="bookbar__label">{label}</span>
      </header>

      <div className="bookview__scroll" ref={wrapRef} style={{ height: `${total * 100}vh` }}>
        <div className="bookview__stage">
          <div className={`book ${single ? 'book--single' : ''}`} ref={bookRef}>
            {!single && (
              <div className="book__base book__base--left">
                {renderEndpaper(profile)}
              </div>
            )}
            <div className="book__base book__base--right">
              <div className={`face face--front face--paper ${seen.has(endPage.key) ? 'is-inked' : ''}`}>
                {endPage.render()}
              </div>
            </div>
            {leaves.map((leaf, i) => (
              <div
                key={leaf.front.key}
                className={`leaf ${i === 0 ? 'leaf--cover' : ''}`}
                ref={(el) => (leafRefs.current[i] = el)}
              >
                {face(leaf.front, 'front')}
                {single ? <div className="face face--back face--blank" /> : face(leaf.back, 'back')}
              </div>
            ))}
          </div>
        </div>
      </div>

      <nav className="bookctl" aria-label="Page navigation">
        <button type="button" onClick={() => scrollToSpread(Math.max(0, spread - 1))} disabled={spread === 0}>
          ‹ Prev
        </button>
        <span className="bookctl__hint">Scroll, or use ← → to turn the pages</span>
        <button type="button" onClick={() => scrollToSpread(Math.min(L, spread + 1))} disabled={spread >= L}>
          Next ›
        </button>
      </nav>
    </div>
  );
}
