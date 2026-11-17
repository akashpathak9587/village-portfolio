import { useEffect, useRef } from 'react';
import TopTabs from './TopTabs';
import ThemePicker from './ThemePicker';
import { journey } from '../scene/path';

export default function RouteBar({ milestones, ride, route }) {
  const { active, goTo, autoRiding, startAuto, stopAuto } = ride;
  const last = milestones.length - 1;
  const doneRef = useRef(null);
  const bikeRef = useRef(null);

  // Follow the bike's eased position every frame, without re-rendering React.
  useEffect(() => {
    let raf = 0;
    let shown = -1;
    const tick = () => {
      const p = Math.min(1, Math.max(0, journey.smooth));
      if (Math.abs(p - shown) > 0.0002) {
        shown = p;
        if (doneRef.current) doneRef.current.style.transform = `scaleX(${p})`;
        if (bikeRef.current) bikeRef.current.style.left = `${p * 100}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <header className="routebar">
      <TopTabs route={route} />
      <nav className="routebar__track" aria-label="Sections">
        <div className="routebar__road">
          <div className="routebar__done" ref={doneRef} />
          <div className="routebar__bike" ref={bikeRef} aria-hidden="true">
            🚲
          </div>
        </div>
        {milestones.map((m, i) => (
          <button
            key={m.id}
            className={`routebar__stop ${i <= active ? 'is-passed' : ''} ${i === active ? 'is-active' : ''}`}
            style={{ left: `${(i / last) * 100}%` }}
            onClick={() => goTo(i)}
            aria-current={i === active ? 'step' : undefined}
          >
            <span className="routebar__dot" />
            <span className="routebar__label">{m.label}</span>
          </button>
        ))}
      </nav>
      <ThemePicker />
      <button className="btn btn--small routebar__auto" onClick={autoRiding ? stopAuto : startAuto}>
        {autoRiding ? '❚❚ Pause ride' : '▶ Auto-ride'}
      </button>
    </header>
  );
}
