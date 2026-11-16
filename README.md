# 🚲 Village Journey Portfolio

An interactive 3D portfolio. Visitors ride a bicycle through a low-poly village, and each signpost along the road opens a section of the portfolio: About, Skills, Experience, Projects and Contact. The sky moves from dawn to dusk over the ride, with lanterns and fireflies at the end.

A second tab, **📖 Project Book** (`#/project-book`), presents each project as a chapter in a leather-bound book. Scrolling turns the pages in 3D, and each page's text fades in as it is revealed.

**Stack:** React 18 · Vite 5 · Three.js (react-three-fiber) · Docker + nginx · Jenkins · Ansible

```bash
npm install
npm run dev          # http://localhost:5173
```

Make it yours by editing **`src/data/profile.js`** (it feeds both the ride and the book) and adding `public/resume.pdf`.

| File | Purpose |
|------|---------|
| `Dockerfile`, `nginx.conf` | Multi-stage build → small nginx image with `/healthz` |
| `docker-compose.yml` | `docker compose up -d --build` → http://localhost:8080 |
| `Jenkinsfile` | Build → smoke test → push to Docker Hub → deploy with Ansible |
| `jenkins/` | Jenkins image with Docker CLI + Ansible preinstalled |
| `ansible/` | Playbook that installs Docker on a server and runs the container |

📘 **Full step-by-step deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md)**
