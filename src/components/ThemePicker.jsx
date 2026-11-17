import { previewTheme, showThemeSwitcher, themeList, themeName } from '../config';

/** Dropdown listing every theme in src/config/themes.json (hide it with "themeSwitcher": false). */
export default function ThemePicker() {
  if (!showThemeSwitcher) return null;
  return (
    <label className="themepick" title="Change theme">
      <span className="sr-only">Theme</span>
      <select value={themeName} onChange={(e) => previewTheme(e.target.value)} aria-label="Theme">
        {themeList.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
