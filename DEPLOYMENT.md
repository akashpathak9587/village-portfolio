# Village Journey Portfolio: Deployment Guide

This guide takes you from a fresh clone to a live, auto-deploying portfolio:

```
 GitHub ──push──▶ Jenkins ──docker build/test/push──▶ Docker Hub
                     │                                     │
                     └──ansible-playbook──▶ Server ◀──pull─┘   (nginx container on :80)
```

| Part | What you do | Time |
|------|-------------|------|
| 1 | Personalise and run locally | 10 min |
| 2 | Build and run with Docker | 5 min |
| 3 | Push the code to GitHub and create a Docker Hub repo | 5 min |
| 4 | Create a server | 10 min |
| 5 | Deploy manually with Ansible | 10 min |
| 6 | Automate with Jenkins | 20 min |
| 7 | Optional: domain + HTTPS | 15 min |
| 8 | Rollback, updates, troubleshooting | — |

---

## 0. Prerequisites

| Tool | Where | Install |
|------|-------|---------|
| Node.js 20+ and npm | your laptop | https://nodejs.org |
| Docker | laptop + Jenkins host | https://docs.docker.com/get-docker/ |
| Git + a GitHub account | laptop | https://git-scm.com |
| Docker Hub account | — | https://hub.docker.com (free) |
| Ansible 2.15+ | laptop or Jenkins host (the *control node*) | see Part 5 |
| A Linux server | cloud (AWS EC2, DigitalOcean, Hetzner, …) | Ubuntu 22.04/24.04 recommended |

> Windows users: run Ansible inside WSL2 (Ubuntu). Ansible does not run natively on Windows.

---

## 1. Personalise and run locally

```bash
cd village-portfolio
npm install
npm run dev            # → http://localhost:5173
```

1. **Edit `src/config/portfolio.json`.** All your content lives there. Set `"mode"` to `"job"` or `"freelancer"`, and `"theme"` to one of the themes in `src/config/themes.json` (see the README's Configuration section).
2. **Add your résumé** as `public/resume.pdf`, or set `resumeUrl: null` to hide the buttons.
3. Optional: change which stops appear (and their order) with the `sections` list in the `job` / `freelancer` block.

Check the production build:

```bash
npm run build && npm run preview   # → http://localhost:4173
```

### Project layout

```
village-portfolio/
├── src/
│   ├── config/portfolio.json    ← your content, mode and theme (edit me)
│   ├── config/themes.json       ← theme presets
│   ├── scene/                   ← Three.js world (react-three-fiber)
│   │   ├── VillageJourney.jsx   camera, lights, day→dusk sky
│   │   ├── Bicycle.jsx          rider + bike with pedalling IK
│   │   ├── World.jsx            terrain, road, trees, houses, landmarks
│   │   └── path.js              road curve + shared helpers
│   ├── book/                    Project Book: scroll-driven 3D page turns
│   ├── components/              scroll hook, tabs, route bar, content cards
│   └── styles.css
├── Dockerfile  nginx.conf  docker-compose.yml
├── Jenkinsfile
├── jenkins/                     Jenkins image with Docker CLI + Ansible
└── ansible/                     deploy.yml, inventory.ini, group_vars/
```

---

## 2. Build and run with Docker

```bash
docker build -t village-portfolio:local .
docker run -d --name portfolio -p 8080:80 village-portfolio:local
curl http://localhost:8080/healthz      # → ok
open http://localhost:8080              # (or just visit it in a browser)
docker rm -f portfolio                  # clean up
```

Or with Compose: `docker compose up -d --build` (→ http://localhost:8080).

The image is a **multi-stage build**: stage 1 (`node:20-alpine`) runs `npm ci && npm run build`, and stage 2 (`nginx:1.27-alpine`) serves only the static `dist/` folder. The final image is about 50 MB and contains no Node.js. `nginx.conf` adds gzip, long-term caching for hashed assets, an SPA fallback and a `/healthz` endpoint used by Docker, Jenkins and Ansible.

---

## 3. GitHub and Docker Hub

```bash
git init && git add . && git commit -m "Village journey portfolio"
git branch -M main
git remote add origin https://github.com/<you>/village-portfolio.git
git push -u origin main
```

On Docker Hub:
1. Create a repository called **`village-portfolio`** (public is fine).
2. Go to **Account settings → Personal access tokens** and create a token with *Read & Write* scope. Jenkins uses it in place of your password.
3. In **`Jenkinsfile`** set `IMAGE_NAME = '<your-dockerhub-user>/village-portfolio'`, and do the same for `image_name` in **`ansible/group_vars/all.yml`**. Commit and push.

---

## 4. Create the server

Any Ubuntu 22.04/24.04 VM with 1 vCPU / 1 GB RAM is enough. Example for **AWS EC2**:

1. EC2 → **Launch instance** → *Ubuntu Server 24.04 LTS*, type `t2.micro`/`t3.micro`.
2. **Key pair**: create one (e.g. `portfolio-deploy`) and download the `.pem` file.
3. **Security group**: allow inbound **22** (SSH, ideally from your IP only) and **80** (HTTP, from anywhere). Add **443** if you plan to do Part 7.
4. Launch and note the **public IPv4 address**. Optionally attach an Elastic IP so it doesn't change.

Test SSH from your laptop:

```bash
chmod 400 ~/Downloads/portfolio-deploy.pem
mv ~/Downloads/portfolio-deploy.pem ~/.ssh/
ssh -i ~/.ssh/portfolio-deploy.pem ubuntu@<SERVER_IP>
```

> You don't need to install anything on the server. Ansible installs Docker for you.

---

## 5. Deploy with Ansible (manual run)

### 5.1 Install Ansible on the control node

```bash
# macOS
brew install ansible
# Ubuntu / Debian / WSL2
sudo apt update && sudo apt install -y ansible
# any OS with Python 3.9+
python3 -m pip install --user ansible

ansible --version
```

### 5.2 Configure the inventory

Edit `ansible/inventory.ini`:

```ini
[web]
portfolio-1 ansible_host=<SERVER_IP> ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/portfolio-deploy.pem
```

Settings you can change in `ansible/group_vars/all.yml`:

| Variable | Default | Meaning |
|----------|---------|---------|
| `image_name` | `your-dockerhub-user/village-portfolio` | image to pull |
| `image_tag` | `latest` | tag to run (Jenkins passes the build number) |
| `host_port` | `80` | public port on the server |
| `container_name` | `village-portfolio` | Docker container name |
| `registry_username/password` | read from env vars | only needed for **private** images |
| `prune_old_images` | `true` | delete old portfolio images after deploy |
| `open_firewall` | `true` | open SSH and `host_port` in UFW if present |

### 5.3 Install collections and test connectivity

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml
ansible web -m ping            # expect: "ping": "pong"
```

### 5.4 Push an image and deploy

```bash
# from the project root: build and push once by hand
docker login
docker build -t <you>/village-portfolio:latest .
docker push <you>/village-portfolio:latest
#   Apple Silicon Mac → x86 server? build for the server's CPU instead:
#   docker buildx build --platform linux/amd64 -t <you>/village-portfolio:latest --push .

cd ansible
ansible-playbook deploy.yml --syntax-check
ansible-playbook deploy.yml --check          # dry run (some tasks are skipped in check mode)
ansible-playbook deploy.yml                  # real deploy
```

The playbook:

1. Installs Docker Engine from Docker's official repo (Ubuntu/Debian; Amazon Linux/RHEL also supported).
2. Starts and enables Docker, and adds the SSH user to the `docker` group.
3. Opens ports 22 and 80 in UFW (if UFW is installed).
4. Logs in to the registry, but only if credentials are set (private images).
5. Pulls `image_name:image_tag` and (re)creates the container with `restart: unless-stopped` and a health check.
6. Polls `http://127.0.0.1/healthz` on the server until it returns 200.
7. Prunes old portfolio images.

Open **`http://<SERVER_IP>`** to see your portfolio. 🎉

Private image? Export the credentials before running the playbook:

```bash
export REGISTRY_USERNAME=<you> REGISTRY_PASSWORD=<docker-hub-token>
ansible-playbook deploy.yml
```

---

## 6. Automate with Jenkins

### 6.1 Run Jenkins

Use the ready-made image in `jenkins/`. It is Jenkins LTS plus the Docker CLI, Ansible, the `community.docker` collection and the required plugins. Run it on your laptop or on a separate CI server, not the portfolio server:

```bash
cd jenkins
# Linux: Jenkins needs the docker socket's group id
DOCKER_GID=$(stat -c '%g' /var/run/docker.sock) docker compose up -d --build
# macOS (Docker Desktop):
docker compose up -d --build

docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open **http://localhost:8081** (or `http://<ci-server>:8081`), paste the password, choose **Install suggested plugins**, and create an admin user.

> Already have Jenkins? Install the plugins *Pipeline*, *Git*, *Credentials Binding*, *SSH Credentials*, *Pipeline: Stage View* and *Timestamper*. Then make sure the agent has `docker` (with daemon access), `ansible` and `git`, and run `ansible-galaxy collection install community.docker community.general` as the Jenkins user.

### 6.2 Add credentials

**Manage Jenkins → Credentials → System → Global credentials → Add credentials**

| ID (must match) | Kind | Values |
|-----------------|------|--------|
| `dockerhub-creds` | Username with password | Docker Hub username + access token (Part 3) |
| `deploy-ssh-key` | SSH Username with private key | Username `ubuntu`; paste the contents of `portfolio-deploy.pem` |

### 6.3 Create the pipeline job

1. **New Item** → name `village-portfolio` → **Pipeline** → OK.
2. **Build Triggers**: tick *GitHub hook trigger for GITScm polling* (or *Poll SCM* with `H/5 * * * *` if Jenkins isn't reachable from the internet).
3. **Pipeline → Definition**: *Pipeline script from SCM*
   * SCM: **Git**, Repository URL: `https://github.com/<you>/village-portfolio.git` (add credentials if the repo is private)
   * Branch: `*/main`
   * Script Path: `Jenkinsfile`
4. **Save**, then click **Build with Parameters → Build**. The first run registers the parameters.

### 6.4 What the pipeline does

| Stage | Action |
|-------|--------|
| Checkout | Clones the repo and records the short commit SHA |
| Build image | `docker build`, which runs `npm ci` + `vite build` in the multi-stage Dockerfile. Tagged `:<build#>`, `:<sha>` and `:latest` |
| Smoke test | Starts the image and checks `/healthz` and the HTML shell from inside the container |
| Push image | Logs in with `dockerhub-creds` and pushes all three tags |
| Deploy with Ansible | Runs `ansible/deploy.yml` with `deploy-ssh-key`, `image_tag=<build#>` (only if the **DEPLOY** parameter is ticked) |
| post | `docker logout` and removes local tags to save disk |

Parameters: **DEPLOY** (on by default) and **ANSIBLE_LIMIT** (inventory group or host, default `web`).

### 6.5 GitHub webhook (push → auto-deploy)

GitHub repo → **Settings → Webhooks → Add webhook**
* Payload URL: `http://<jenkins-host>:8081/github-webhook/`
* Content type: `application/json`, event: *Just the push event*.

From now on every `git push` to `main` builds, tests and deploys automatically.

> If Jenkins is on your laptop, GitHub can't reach it. Use *Poll SCM* instead, or a tunnel such as `ngrok http 8081`.

### 6.6 Ansible inventory for Jenkins

Jenkins uses `ansible/inventory.ini` from the repo, so make sure it is committed with your server IP. The SSH key comes from the `deploy-ssh-key` credential, so leave `ansible_ssh_private_key_file` out of the committed inventory (or comment it out).

---

## 7. Optional: domain + HTTPS

1. At your DNS provider, create an **A record** `portfolio.yourdomain.com → <SERVER_IP>`.
2. Set `host_port: 8080` in `group_vars/all.yml` and redeploy, so the container listens on 8080 behind a proxy.
3. On the server, put **Caddy** in front. It gets and renews Let's Encrypt certificates automatically:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
echo 'portfolio.yourdomain.com {
  reverse_proxy 127.0.0.1:8080
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

4. Open ports 80 and 443 in the security group. Visit `https://portfolio.yourdomain.com`.

---

## 8. Operations

### Update the content

Edit `src/config/portfolio.json` → `git commit` → `git push`. Jenkins redeploys in about 2 minutes.

### Roll back

Every build is pushed with its build number, so you can redeploy any earlier one:

```bash
cd ansible
ansible-playbook deploy.yml -e image_tag=41
```

### Useful commands on the server

```bash
docker ps                                   # container + health status
docker logs -f village-portfolio            # nginx access/error logs
docker inspect --format '{{.State.Health.Status}}' village-portfolio
curl -s localhost/healthz
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ansible web -m ping` → *UNREACHABLE* | Wrong IP/user/key, or port 22 is closed in the security group. Try `ssh -i key user@ip` by hand first |
| `Permission denied (publickey)` | Run `chmod 400` on the key, and use the right user (`ubuntu` for Ubuntu AMIs, `ec2-user` for Amazon Linux) |
| Jenkins: `permission denied … docker.sock` | Start Jenkins with `DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)` (Linux) |
| Jenkins: `ansible-playbook: not found` | Use the `jenkins/` image, or install Ansible on the agent |
| `couldn't resolve module/action 'community.docker…'` | `ansible-galaxy collection install -r ansible/requirements.yml` |
| Server: `exec format error` | The image was built on an ARM Mac for an x86 server. Build with `--platform linux/amd64` (Jenkins on x86 is fine) |
| Site loads but stays on an old version | Hard refresh. `index.html` is served `no-cache`, so a normal reload picks up new deploys |
| Blank 3D background | The visitor's browser has WebGL disabled. The content still shows on a gradient fallback |
| Pull fails with `unauthorized` | The repo is private. Set `REGISTRY_USERNAME`/`REGISTRY_PASSWORD` (Part 5.4) |

---

## 9. Sharing with HR

* Put the live URL at the top of your résumé and in the job application form.
* Mention the stack in one line: *"React + Three.js portfolio, containerised with Docker and deployed through a Jenkins → Ansible CI/CD pipeline."* That line is itself proof of DevOps skills.
* The **▶ Auto-ride** button tours every section on its own, so recruiters don't have to scroll.
* Link the GitHub repo too. The `Jenkinsfile` and `ansible/` folder are what technical interviewers like to look at.
