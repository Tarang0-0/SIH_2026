# ==============================================================================
# RailETA Backend — Production Multi-Stage Dockerfile (FastAPI + Gunicorn/Uvicorn)
# Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains
# ==============================================================================

# Stage 1: Build Dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
RUN pip install --no-cache-dir --user gunicorn==21.2.0

# Stage 2: Production Runtime
FROM python:3.11-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user for security
RUN groupadd -g 1001 raileta && \
    useradd -u 1001 -g raileta -s /bin/bash -m raileta

# Copy Python packages from builder
COPY --from=builder /root/.local /home/raileta/.local
ENV PATH=/home/raileta/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV ENVIRONMENT=production

# Copy application source code and ML models
COPY --chown=raileta:raileta . /app/

USER raileta

EXPOSE 8000

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Production Gunicorn worker execution with Uvicorn worker class
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "app.main:app"]
