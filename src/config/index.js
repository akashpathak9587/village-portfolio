/**
 * Loads src/config/portfolio.json + src/config/themes.json and exposes everything the app
 * needs: the resolved content for the chosen mode, the stops on the ride, and the theme.
 *
 *   portfolio.json → "mode":  "job" | "freelancer"
 *   portfolio.json → "theme": any key from themes.json (aurora, sunset, ocean, forest, minimal, neon)
 *
 * For previews you can also override both from the URL: ?theme=ocean&mode=freelancer
 */
import portfolio from './portfolio.json';
import themes from './themes.json';

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export const themeIds = Object.keys(themes);
export const themeList = themeIds.map((id) => ({ id, name: themes[id].name, description: themes[id].description }));
export const themeName = pick(params.get('theme'), themeIds, pick(portfolio.theme, themeIds, themeIds[0]));
export const theme = themes[themeName];
export const showThemeSwitcher = portfolio.themeSwitcher !== false;

export const mode = pick(params.get('mode'), ['job', 'freelancer'], pick(portfolio.mode, ['job', 'freelancer'], 'job'));
const modeData = portfolio[mode] || {};

/** Default labels for every section type. Each becomes a stop (signpost) on the ride. */
const SECTION_META = {
  about: { label: 'About', sign: 'About Me', title: 'About me' },
  skills: { label: 'Skills', sign: 'Skills', title: 'Skills that keep things turning' },
  experience: { label: 'Experience', sign: 'Experience', title: 'Work & education' },
  services: { label: 'Services', sign: 'Services', title: 'How I can help' },
  projects: { label: mode === 'freelancer' ? 'Work' : 'Projects', sign: mode === 'freelancer' ? 'My Work' : 'Projects', title: mode === 'freelancer' ? 'Selected work' : "Things I've built" },
  contact: { label: 'Contact', sign: mode === 'freelancer' ? 'Hire Me' : 'Say Hello', title: modeData.contactTitle || "Let's talk" },
};

const sectionIds = (modeData.sections || ['about', 'skills', 'projects', 'contact']).filter((id) => SECTION_META[id]);

/** Stops on the ride: the start + one per section, in the order given in portfolio.json. */
export const milestones = [
  { id: 'home', label: 'Start', sign: 'Welcome!' },
  ...sectionIds.map((id) => ({ id, ...SECTION_META[id] })),
];

/** Flattened content used by the page and the Project Book. */
export const profile = {
  ...portfolio.profile,
  mode,
  role: modeData.role || portfolio.profile.role || '',
  badge: modeData.badge || '',
  tagline: modeData.tagline || '',
  about: portfolio.about || [],
  skills: portfolio.skills || [],
  projects: portfolio.projects || [],
  highlights: modeData.highlights || [],
  experience: modeData.experience || [],
  services: modeData.services || [],
  process: modeData.process || [],
  availability: modeData.availability || '',
  rates: modeData.rates || '',
  testimonials: modeData.testimonials || [],
  contactNote: modeData.contactNote || '',
  primaryCta: modeData.primaryCta || null,
};

/* ------------------------------------------------------------------ */
/* Theme → CSS variables + fonts                                       */
/* ------------------------------------------------------------------ */

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

export function applyTheme(t = theme) {
  const { ui, book } = t;
  const root = document.documentElement;
  const set = (k, v) => root.style.setProperty(k, v);
  set('--bg', ui.bg);
  set('--bg-2', ui.bg2);
  set('--glass', ui.glass);
  set('--glass-strong', ui.glassStrong);
  set('--fg-rgb', ui.fgRgb);
  set('--shadow-rgb', ui.shadowRgb);
  set('--text', ui.text);
  set('--text-soft', ui.textSoft);
  set('--text-dim', ui.textDim);
  ['accent1', 'accent2', 'accent3', 'accent4'].forEach((k, i) => {
    set(`--a${i + 1}`, ui[k]);
    set(`--a${i + 1}-rgb`, hexToRgb(ui[k]));
  });
  set('--ok', ui.ok);
  set('--ok-rgb', hexToRgb(ui.ok));
  set('--ok-text', ui.okText);
  set('--link', ui.link);
  set('--heading-2', ui.heading2);
  set('--dot', ui.dot);
  set('--font-display', `'${ui.fonts.display}', 'Inter', system-ui, sans-serif`);
  set('--font-body', `'${ui.fonts.body}', system-ui, -apple-system, 'Segoe UI', sans-serif`);
  set('--font-mono', `'${ui.fonts.mono}', ui-monospace, 'SFMono-Regular', Menlo, monospace`);
  book.cover.forEach((c, i) => set(`--cover-${i + 1}`, c));
  set('--paper', book.paper);
  set('--paper-2', book.paper2);
  set('--page-ink', book.ink);
  set('--page-soft', book.soft);
  set('--page-dim', book.dim);
  set('--page-line', book.line);
  const sky = t.scene.sky;
  set('--sky-top', sky[1].top);
  set('--sky-horizon', sky[1].horizon);
  set('--grass-1', t.scene.grassLow);
  set('--grass-2', t.scene.grassHigh);
  root.style.colorScheme = ui.colorScheme;
  root.dataset.theme = themeName;

  // Load the theme's Google Fonts.
  const families = [...new Set(Object.values(ui.fonts))];
  const href = `https://fonts.googleapis.com/css2?${families
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&')}&display=swap`;
  let link = document.getElementById('theme-fonts');
  if (!link) {
    link = document.createElement('link');
    link.id = 'theme-fonts';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Switch theme by reloading with ?theme=… (the 3D world is built once per load). */
export function previewTheme(id) {
  const url = new URL(window.location.href);
  url.searchParams.set('theme', id);
  window.location.href = url.toString();
}
