# syntax=docker/dockerfile:1
FROM python:3.9-slim

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY ml/requirements.txt requirements.txt

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt fastapi uvicorn pydantic

# Copy project source code
COPY api/ ./api/
COPY src/ ./src/
COPY models/ ./models/
COPY data/ ./data/

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
