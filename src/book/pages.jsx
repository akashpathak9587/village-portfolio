/**
 * Page content for the Project Book. Each entry in the list returned by buildPages() is
 * one physical page. The book component pairs them into leaves (front/back) on wide screens
 * and shows them one at a time on phones.
 */

const pad = (n) => String(n).padStart(2, '0');

function Ink({ i = 0, as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`ink ${className}`} style={{ '--i': i }} {...rest}>
      {children}
    </Tag>
  );
}

function Folio({ number, running }) {
  return (
    <>
      {running && <div className="page__running">{running}</div>}
      {number != null && <div className="page__folio">{number}</div>}
    </>
  );
}

/* ---------------- individual page layouts ---------------- */

function Cover({ profile }) {
  return (
    <div className="cover">
      <div className="cover__orb" aria-hidden="true" />
      <div className="cover__orb cover__orb--2" aria-hidden="true" />
      <div className="cover__grid" aria-hidden="true" />
      <div className="cover__top">
        <span>Portfolio</span>
        <span>{new Date().getFullYear()}</span>
      </div>
      <div className="cover__main">
        <p className="cover__eyebrow">Selected work</p>
        <h1 className="cover__title">
          Project
          <br />
          Book<span className="cover__dot">.</span>
        </h1>
        <p className="cover__author">{profile.name}</p>
        <p className="cover__sub">{profile.role}</p>
      </div>
      <div className="cover__bottom">
        <span>{pad(profile.projects.length)} projects</span>
        <span className="cover__hint">Scroll to open ↓</span>
      </div>
    </div>
  );
}

function Contents({ profile, number, goToProject }) {
  return (
    <div className="page__body">
      <Ink i={0} as="p" className="eyebrow">Index</Ink>
      <Ink i={1} as="h2" className="page__title">Contents</Ink>
      <Ink i={2} as="p" className="lede">
        Things I have designed, built and shipped. Keep scrolling to turn the pages, or jump straight to a chapter.
      </Ink>
      <ol className="toc">
        {profile.projects.map((p, j) => (
          <Ink key={p.name} i={3 + j} as="li">
            <button type="button" className="toc__item" onClick={() => goToProject(j)}>
              <span className="toc__num">{pad(j + 1)}</span>
              <span className="toc__text">
                <span className="toc__name">{p.name}</span>
                <span className="toc__cat">{p.category}</span>
              </span>
              <span className="toc__page">p.{2 + j * 2}</span>
              <span className="toc__arrow" aria-hidden="true">→</span>
            </button>
          </Ink>
        ))}
      </ol>
      <Folio number={number} />
    </div>
  );
}

function ChapterOpen({ project, index, number }) {
  return (
    <div className="page__body">
      <Folio number={number} running={`Chapter ${pad(index + 1)}`} />
      <div className="chapter__head">
        <Ink i={0} className="chapter__num" aria-hidden="true">{pad(index + 1)}</Ink>
        <Ink i={1} className="chapter__badge">
          <span className="chapter__icon" aria-hidden="true">{project.icon}</span>
        </Ink>
      </div>
      <Ink i={2} as="p" className="chapter__category">{project.category}</Ink>
      <Ink i={3} as="h2" className="page__title">{project.name}</Ink>
      <Ink i={4} as="p" className="lede">{project.description}</Ink>
      <Ink i={5} className="chapter__role">
        <span>My role</span>
        {project.role}
      </Ink>
    </div>
  );
}

function ChapterDetail({ project, index, number }) {
  return (
    <div className="page__body">
      <Folio number={number} running={project.name} />
      <Ink i={0} as="h3" className="page__h3">What I built</Ink>
      <ul className="built">
        {project.points.map((pt, k) => (
          <Ink key={pt} i={1 + k} as="li">{pt}</Ink>
        ))}
      </ul>
      <Ink i={2 + project.points.length} as="h3" className="page__h3">Tech stack</Ink>
      <Ink i={3 + project.points.length} as="ul" className="stack">
        {project.tech.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </Ink>
      {(project.link || project.repo) && (
        <Ink i={4 + project.points.length} className="page__links">
          {project.link && (
            <a href={project.link} target="_blank" rel="noreferrer">Live demo ↗</a>
          )}
          {project.repo && (
            <a href={project.repo} target="_blank" rel="noreferrer">Source code ↗</a>
          )}
        </Ink>
      )}
      <Ink i={6 + project.points.length} className="page__flourish" aria-hidden="true">
        — End of chapter {pad(index + 1)} —
      </Ink>
    </div>
  );
}

function TheEnd({ profile, number }) {
  return (
    <div className="page__body page__body--center">
      <Folio number={number} />
      <Ink i={0} className="end__orb" aria-hidden="true" />
      <Ink i={1} as="h2" className="page__title page__title--big">Thanks for reading.</Ink>
      <Ink i={2} as="p" className="lede">
        If you would like to talk about any of these chapters, or build the next one together, I would love to hear from you.
      </Ink>
      <Ink i={3} className="end__actions">
        <a className="btn" href={`mailto:${profile.email}`}>✉ Email me</a>
        {profile.resumeUrl && (
          <a className="btn btn--light" href={profile.resumeUrl} download>Résumé ↓</a>
        )}
      </Ink>
      <Ink i={4} className="end__actions">
        <a className="btn btn--light" href="#/">🚲 Back to the journey</a>
      </Ink>

    </div>
  );
}

function Endpaper({ profile }) {
  return (
    <div className="endpaper">
      <div className="endpaper__grid" aria-hidden="true" />
      <div className="bookplate">
        <p>Designed &amp; built by</p>
        <strong>{profile.name}</strong>
      </div>
    </div>
  );
}

/* ---------------- page list ---------------- */

export function buildPages(profile, goToProject) {
  const pages = [{ key: 'cover', kind: 'cover', render: () => <Cover profile={profile} /> }];
  pages.push({ key: 'toc', kind: 'paper', render: () => <Contents profile={profile} number={1} goToProject={goToProject} /> });
  profile.projects.forEach((project, j) => {
    pages.push({
      key: `p${j}a`,
      kind: 'paper',
      render: () => <ChapterOpen project={project} index={j} number={2 + j * 2} />,
    });
    pages.push({
      key: `p${j}b`,
      kind: 'paper',
      render: () => <ChapterDetail project={project} index={j} number={3 + j * 2} />,
    });
  });
  pages.push({ key: 'end', kind: 'paper', render: () => <TheEnd profile={profile} number={2 + profile.projects.length * 2} /> });
  return pages;
}

export const renderEndpaper = (profile) => <Endpaper profile={profile} />;
