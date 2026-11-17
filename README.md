# 🚲 Village Journey Portfolio

An interactive 3D portfolio. Visitors ride a bicycle through a village, and each signpost along the road opens a section of the portfolio. The sky moves from dawn to night over the ride.

A second tab, **📖 Project Book** (`#/project-book`), presents each project as a chapter in a book. Scrolling turns the pages in 3D, and each page's text fades in as it is revealed.

Everything is driven by **two JSON files**. One holds your content and chooses job-seeker or freelancer mode; the other is a list of themes you can switch between.

**Stack:** React 18 · Vite 5 · Three.js (react-three-fiber) · Docker + nginx · Jenkins · Ansible

```bash
npm install
npm run dev          # http://localhost:5173
```

---

## Configuration

### `src/config/portfolio.json`: your content

```jsonc
{
  "mode": "job",            // "job" | "freelancer"
  "theme": "aurora",        // any id from themes.json
  "themeSwitcher": true,    // show the theme dropdown in the nav (set false for the final site)

  "profile":  { "name", "location", "email", "phone", "resumeUrl", "links": [...] },
  "about":    ["paragraph", "..."],
  "skills":   [{ "group": "Frontend", "items": ["React", "..."] }],
  "projects": [{ "name", "icon", "category", "role", "description", "points": [...], "tech": [...], "link", "repo" }],

  "job":        { ... },    // used when mode = "job"
  "freelancer": { ... }     // used when mode = "freelancer"
}
```

Shared content (`profile`, `about`, `skills`, `projects`) appears in both modes. Each mode block sets the rest:

| Key | Job mode | Freelancer mode |
|-----|----------|-----------------|
| `role`, `badge`, `tagline` | "Full-Stack Engineer", "Open to full-stack roles" | "Freelance Full-Stack Developer", "Available for freelance projects" |
| `sections` | `about, skills, experience, projects, contact` | `about, services, skills, projects, contact` |
| `highlights` | three stat tiles on the About card | same |
| `experience` | work + education timeline | — |
| `services`, `process`, `availability`, `rates` | — | service cards, "how we work" steps, availability line, optional rates |
| `testimonials` | optional | `[{ "quote", "name", "role" }]`, shown on the Contact stop (empty = hidden) |
| `contactTitle`, `contactNote` | contact heading + text | same |
| `primaryCta` | "Download résumé" button | "Start a project" mailto button |

**`sections`** controls which stops appear on the ride and in what order. Available ids: `about`, `skills`, `experience`, `services`, `projects`, `contact`. Each one gets its own signpost and landmark automatically.

### `src/config/themes.json`: theme list

| id | Name | Look |
|----|------|------|
| `aurora` | Aurora | Dark glass, violet / pink / cyan, pastel village *(default)* |
| `sunset` | Sunset | Warm coral, amber and rose, golden-hour village |
| `ocean` | Ocean | Navy glass, sky blue and teal, seaside village |
| `forest` | Forest | Evergreen glass, emerald / lime / gold, woodland village |
| `minimal` | Minimal Light | Light theme: white glass, ink black and indigo |
| `neon` | Neon Night | Cyberpunk magenta / cyan / yellow, glowing night village |

**To choose a theme**, set `"theme": "ocean"` (for example) in `portfolio.json`.

Each theme defines:
- **`ui`:** page colours (background, glass, text, 4 accents), fonts (any Google Font, loaded automatically) and light/dark scheme.
- **`book`:** cover gradient and page colours for the Project Book.
- **`scene`:** the 3D world: sky colours through the ride, grass, road, houses, trees, fields, water, signposts, street lamps and the rider's outfit.

To add your own theme, copy an existing entry in `themes.json`, give it a new id and change the colours.

### Preview without editing files

Add URL parameters to try any combination:

```
http://localhost:5173/?theme=neon
http://localhost:5173/?mode=freelancer&theme=sunset
http://localhost:5173/?theme=minimal#/project-book
```

The theme dropdown in the nav does the same thing (`"themeSwitcher": true`).

---

## Project files

| File | Purpose |
|------|---------|
| `src/config/portfolio.json` | All content + mode + chosen theme |
| `src/config/themes.json` | Theme presets (UI, book, 3D scene) |
| `public/resume.pdf` | Résumé served by the download buttons |
| `Dockerfile`, `nginx.conf` | Multi-stage build → small nginx image with `/healthz` |
| `docker-compose.yml` | `docker compose up -d --build` → http://localhost:8080 |
| `Jenkinsfile` | Build → smoke test → push to Docker Hub → deploy with Ansible |
| `jenkins/` | Jenkins image with Docker CLI + Ansible preinstalled |
| `ansible/` | Playbook that installs Docker on a server and runs the container |

📘 **Full step-by-step deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md)**
