import { memo, useEffect, useRef } from 'react';

function Reveal({ className = '', children, ...rest }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle('is-visible', entry.isIntersecting),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`card reveal ${className}`} {...rest}>
      {children}
    </div>
  );
}

function Stop({ index, id, side, kicker, title, children }) {
  return (
    <section id={id} data-stop={index} className={`stop stop--${side}`} aria-labelledby={`${id}-title`}>
      <Reveal>
        <p className="kicker">
          <span className="kicker__num">Stop {String(index).padStart(2, '0')}</span> {kicker}
        </p>
        <h2 id={`${id}-title`}>{title}</h2>
        {children}
      </Reveal>
    </section>
  );
}

function Sections({ profile, milestones, onStartRide }) {
  const sideOf = (i) => (i % 2 === 0 ? 'left' : 'right');
  return (
    <main className="content">
      {/* 0 — Hero */}
      <section id={milestones[0].id} data-stop={0} className="stop stop--hero">
        <div className="hero">
          <p className="hero__badge">
            <span className="hero__dot" aria-hidden="true" /> Open to full-stack roles
          </p>
          <h1>
            <span className="hero__hello">Hi, I'm</span> {profile.name}
          </h1>
          <p className="hero__role">{profile.role}</p>
          <p className="hero__tagline">{profile.tagline}</p>
          <div className="hero__actions">
            <button className="btn" onClick={onStartRide}>
              Take the ride →
            </button>
            {profile.resumeUrl && (
              <a className="btn btn--ghost" href={profile.resumeUrl} download>
                Download résumé
              </a>
            )}
          </div>
          <p className="hero__hint">
            <span className="mouse" aria-hidden="true" /> Scroll to pedal through the village
          </p>
        </div>
      </section>

      {/* 1 — About */}
      <Stop index={1} id={milestones[1].id} side={sideOf(1)} kicker="Home" title="About me">
        {profile.about.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <ul className="stats">
          {profile.highlights.map((h) => (
            <li key={h.label}>
              <strong>{h.value}</strong>
              <span>{h.label}</span>
            </li>
          ))}
        </ul>
        <p className="muted">📍 {profile.location}</p>
      </Stop>

      {/* 2 — Skills */}
      <Stop index={2} id={milestones[2].id} side={sideOf(2)} kicker="Wind turbine" title="Skills that keep things turning">
        <div className="skills">
          {profile.skills.map((g) => (
            <div key={g.group} className="skills__group">
              <h3>{g.group}</h3>
              <ul className="chips">
                {g.items.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Stop>

      {/* 3 — Experience */}
      <Stop index={3} id={milestones[3].id} side={sideOf(3)} kicker="The studio" title="Work &amp; education">
        <ol className="timeline">
          {profile.experience.map((job) => (
            <li key={job.company + job.period}>
              <div className="timeline__head">
                <h3>
                  {job.role} <span>· {job.company}</span>
                </h3>
                <time>{job.period}</time>
              </div>
              <ul>
                {job.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Stop>

      {/* 4 — Projects */}
      <Stop index={4} id={milestones[4].id} side={sideOf(4)} kicker="The lake" title="Things I've built">
        <div className="projects">
          {profile.projects.map((p) => (
            <article key={p.name} className="project">
              <h3>
                <span aria-hidden="true">{p.icon}</span> {p.name}
              </h3>
              <p className="project__cat">{p.category}</p>
              <ul className="chips chips--small">
                {p.tech.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {(p.link || p.repo) && (
                <p className="project__links">
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer">
                      Live ↗
                    </a>
                  )}
                  {p.repo && (
                    <a href={p.repo} target="_blank" rel="noreferrer">
                      Code ↗
                    </a>
                  )}
                </p>
              )}
            </article>
          ))}
        </div>
        <a className="btn book-cta" href="#/project-book">
          📖 Read the full Project Book
        </a>
      </Stop>

      {/* 5 — Contact */}
      <Stop index={5} id={milestones[5].id} side={sideOf(5)} kicker="Mailbox" title="Let's work together">
        <p>{profile.contactNote}</p>
        <div className="contact">
          <a className="btn" href={`mailto:${profile.email}`}>
            ✉ {profile.email}
          </a>
          {profile.phone && (
            <a className="btn btn--ghost" href={`tel:${profile.phone.replace(/\s/g, '')}`}>
              ☎ {profile.phone}
            </a>
          )}
        </div>
        <ul className="links">
          {profile.links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.label} ↗
              </a>
            </li>
          ))}
          {profile.resumeUrl && (
            <li>
              <a href={profile.resumeUrl} download>
                Résumé (PDF) ↓
              </a>
            </li>
          )}
        </ul>
        <p className="muted small">
          Built with React, Vite &amp; Three.js · Shipped with Docker, Jenkins &amp; Ansible
        </p>
      </Stop>
    </main>
  );
}

// Memoised: scrolling never changes these props, so the content never re-renders mid-ride.
export default memo(Sections);
