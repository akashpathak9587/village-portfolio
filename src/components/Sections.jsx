import { memo, useEffect, useRef } from 'react';

/** Name of the 3D landmark beside each stop (matches LANDMARKS in scene/World.jsx). */
const LANDMARK_NAMES = ['', 'Home', 'Wind turbine', 'The studio', 'The lake', 'Mailbox'];

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

function Stop({ index, id, title, children }) {
  const side = index % 2 === 0 ? 'left' : 'right';
  const kicker = LANDMARK_NAMES[index % LANDMARK_NAMES.length];
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

const Chips = ({ items, small }) => (
  <ul className={`chips ${small ? 'chips--small' : ''}`}>
    {items.map((s) => (
      <li key={s}>{s}</li>
    ))}
  </ul>
);

/* ---------------- section bodies (one per section id in portfolio.json) ---------------- */

function About({ profile }) {
  return (
    <>
      {profile.about.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {profile.highlights.length > 0 && (
        <ul className="stats">
          {profile.highlights.map((h) => (
            <li key={h.label}>
              <strong>{h.value}</strong>
              <span>{h.label}</span>
            </li>
          ))}
        </ul>
      )}
      {profile.location && <p className="muted">📍 {profile.location}</p>}
    </>
  );
}

function Skills({ profile }) {
  return (
    <div className="skills">
      {profile.skills.map((g) => (
        <div key={g.group} className="skills__group">
          <h3>{g.group}</h3>
          <Chips items={g.items} />
        </div>
      ))}
    </div>
  );
}

function Experience({ profile }) {
  return (
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
  );
}

function Services({ profile }) {
  return (
    <>
      <div className="services">
        {profile.services.map((s) => (
          <article key={s.title} className="service">
            <span className="service__icon" aria-hidden="true">{s.icon}</span>
            <h3>{s.title}</h3>
            <p>{s.description}</p>
            {s.deliverables?.length > 0 && <Chips items={s.deliverables} small />}
          </article>
        ))}
      </div>
      {profile.process.length > 0 && (
        <ol className="process" aria-label="How we'll work">
          {profile.process.map((step, i) => (
            <li key={step}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
      )}
      {(profile.availability || profile.rates) && (
        <p className="muted small availability">
          {profile.availability && <span>● {profile.availability}</span>}
          {profile.rates && <span>{profile.rates}</span>}
        </p>
      )}
    </>
  );
}

function Projects({ profile }) {
  return (
    <>
      <div className="projects">
        {profile.projects.map((p) => (
          <article key={p.name} className="project">
            <h3>
              <span aria-hidden="true">{p.icon}</span> {p.name}
            </h3>
            <p className="project__cat">{p.category}</p>
            <Chips items={p.tech} small />
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
        📖 {profile.mode === 'freelancer' ? 'Read the case studies' : 'Read the full Project Book'}
      </a>
    </>
  );
}

function Contact({ profile }) {
  const cta = profile.primaryCta;
  return (
    <>
      {profile.testimonials.length > 0 && (
        <div className="testimonials">
          {profile.testimonials.map((t) => (
            <figure key={t.quote} className="testimonial">
              <blockquote>“{t.quote}”</blockquote>
              <figcaption>
                <strong>{t.name}</strong>
                {t.role && <span> · {t.role}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <p>{profile.contactNote}</p>
      <div className="contact">
        {cta && profile.mode === 'freelancer' && (
          <a className="btn" href={cta.href}>
            {cta.label} →
          </a>
        )}
        <a className={`btn ${profile.mode === 'freelancer' ? 'btn--ghost' : ''}`} href={`mailto:${profile.email}`}>
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
      <p className="muted small">Built with React, Vite &amp; Three.js · Shipped with Docker, Jenkins &amp; Ansible</p>
    </>
  );
}

const BODIES = { about: About, skills: Skills, experience: Experience, services: Services, projects: Projects, contact: Contact };

/* ---------------- page ---------------- */

function Hero({ profile, onStartRide }) {
  const cta = profile.primaryCta;
  return (
    <div className="hero">
      {profile.badge && (
        <p className="hero__badge">
          <span className="hero__dot" aria-hidden="true" /> {profile.badge}
        </p>
      )}
      <h1>
        <span className="hero__hello">Hi, I'm</span> {profile.name}
      </h1>
      <p className="hero__role">{profile.role}</p>
      <p className="hero__tagline">{profile.tagline}</p>
      <div className="hero__actions">
        <button className="btn" onClick={onStartRide}>
          Take the ride →
        </button>
        {cta && (
          <a className="btn btn--ghost" href={cta.href} {...(cta.download ? { download: true } : {})}>
            {cta.label}
          </a>
        )}
      </div>
      <p className="hero__hint">
        <span className="mouse" aria-hidden="true" /> Scroll to pedal through the village
      </p>
    </div>
  );
}

function Sections({ profile, milestones, onStartRide }) {
  return (
    <main className="content">
      <section id={milestones[0].id} data-stop={0} className="stop stop--hero">
        <Hero profile={profile} onStartRide={onStartRide} />
      </section>
      {milestones.slice(1).map((m, k) => {
        const Body = BODIES[m.id];
        return (
          <Stop key={m.id} index={k + 1} id={m.id} title={m.title}>
            <Body profile={profile} />
          </Stop>
        );
      })}
    </main>
  );
}

// Memoised: scrolling never changes these props, so the content never re-renders mid-ride.
export default memo(Sections);
