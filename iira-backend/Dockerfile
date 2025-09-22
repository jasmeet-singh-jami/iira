# ============================
# Stage 1 - Build dependencies
# ============================
FROM python:3.10-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
 && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY iira-backend/requirements.txt .

# Install Python deps into a clean folder
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ============================
# Stage 2 - Runtime image
# ============================
FROM python:3.10-slim

WORKDIR /app

# Install only runtime dependencies (small footprint)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    procps \
    gawk \
    bc \
    coreutils \
 && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY ./iira-backend/ /app/
COPY ./scripts/ /app/scripts/

# Ensure shell scripts are executable
RUN chmod +x /app/scripts/shell/*.sh

# Expose FastAPI port
EXPOSE 8000

# Run FastAPI with uvicorn
CMD ["python", "-u", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
