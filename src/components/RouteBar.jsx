import TopTabs from './TopTabs';

export default function RouteBar({ milestones, ride, route }) {
  const { active, progress, goTo, autoRiding, startAuto, stopAuto } = ride;
  const last = milestones.length - 1;
  return (
    <header className="routebar">
      <TopTabs route={route} />
      <nav className="routebar__track" aria-label="Sections">
        <div className="routebar__road">
          <div className="routebar__done" style={{ width: `${progress * 100}%` }} />
          <div className="routebar__bike" style={{ left: `${progress * 100}%` }} aria-hidden="true">
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
      <button className="btn btn--small routebar__auto" onClick={autoRiding ? stopAuto : startAuto}>
        {autoRiding ? '❚❚ Pause ride' : '▶ Auto-ride'}
      </button>
    </header>
  );
}
