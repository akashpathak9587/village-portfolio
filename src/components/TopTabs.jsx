import { ROUTES } from './useHashRoute';

const TABS = [
  { route: ROUTES.journey, icon: '🚲', label: 'Journey' },
  { route: ROUTES.book, icon: '📖', label: 'Project Book' },
];

export default function TopTabs({ route }) {
  return (
    <nav className="tabs" aria-label="Views">
      {TABS.map((t) => (
        <a
          key={t.route}
          href={`#${t.route}`}
          className={`tabs__tab ${route === t.route ? 'is-active' : ''}`}
          aria-current={route === t.route ? 'page' : undefined}
        >
          <span aria-hidden="true">{t.icon}</span>
          <span className="tabs__label">{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
