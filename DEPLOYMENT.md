# RailETA — Production Deployment & Cloud Hosting Guide
**SIH Problem Statement 26028:** Dynamic Forecast of Expected Time of Arrival (ETA) for Coaching Trains

RailETA is designed for turnkey cloud deployment with high concurrency, enterprise security, and real-time streaming capabilities.

---

## 1. Quick Start: Single-Command Docker Deployment

Deploy the complete RailETA stack (FastAPI Gunicorn backend + Next.js standalone frontend) on any Linux server, VPS, or local machine:

```bash
# 1. Clone repository and navigate to root
cd SIH_2026

# 2. Start containerized stack in detached mode
docker compose up -d --build

# 3. Verify running containers and health checks
docker compose ps
```

- **Frontend Web UI**: `http://localhost:3000`
- **Backend API & Swagger Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

---

## 2. Cloud Deployment Options

### Option A: Vercel (Frontend) + Render / Railway (Backend) — *Recommended for Free / Fast Setup*

#### Step 1: Deploy Backend on Railway or Render
1. Create a new Web Service pointing to the repository root with root directory set to `backend`.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `gunicorn -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:$PORT app.main:app`
4. Set Environment Variables:
   - `ENVIRONMENT`: `production`
   - `DATA_SOURCE_MODE`: `REAL`
   - `RAILRADAR_API_KEY`: `<YOUR_RAILRADAR_API_KEY>`
   - `OPENWEATHER_API_KEY`: `<YOUR_OPENWEATHER_API_KEY>`
   - `OPENTOPOGRAPHY_API_KEY`: `<YOUR_OPENTOPOGRAPHY_API_KEY>`
   - `MAPTILER_API_KEY`: `<YOUR_MAPTILER_API_KEY>`

#### Step 2: Deploy Frontend on Vercel
1. Import repository on [Vercel](https://vercel.com).
2. Set Root Directory to `frontend`.
3. Set Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend.railway.app`
   - `NEXT_PUBLIC_WS_URL`: `wss://your-backend.railway.app`
   - `NEXT_PUBLIC_MAPTILER_KEY`: `<YOUR_MAPTILER_API_KEY>`
4. Click **Deploy**.

---

### Option B: Fly.io (Global Edge Multi-Worker Deployment)

```bash
# Deploy Backend
cd backend
fly launch --name raileta-backend
fly deploy

# Deploy Frontend
cd ../frontend
fly launch --name raileta-frontend
fly deploy
```

---

### Option C: AWS EC2 / DigitalOcean Droplet (Docker Compose with Nginx Reverse Proxy)

1. Provision Ubuntu 22.04 LTS instance (2 vCPU, 4GB RAM minimum).
2. Install Docker & Docker Compose:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
   ```
3. Clone repository and run:
   ```bash
   docker compose up -d
   ```
4. Setup SSL with Certbot & Nginx for HTTPS domain routing.

---

## 3. Security & Production Checklist

- [x] **Rate Limiting**: Protected with Token Bucket IP rate limiting (180 req/min general, 60 req/min ML).
- [x] **OWASP Security Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HSTS`, `Referrer-Policy`.
- [x] **Zero External Key Leakage**: Third-party API keys are strictly server-side proxied.
- [x] **Non-Root Containers**: Docker containers run as unprivileged `raileta` and `nextjs` system users.
- [x] **Graceful Degradation**: Offline fallback caching for weather, elevation, and train data.
- [x] **Admin Authentication**: Salted cryptographic hash verification for the Operations Control Center.
