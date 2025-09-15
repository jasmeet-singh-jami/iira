FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies (added procps, gawk, bc, coreutils)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    procps \
    gawk \
    bc \
    coreutils \
    vim \
 && rm -rf /var/lib/apt/lists/*

# Copy only the requirements file first to leverage Docker cache
COPY iira-backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application code
COPY ./iira-backend/ /app/

# Copy the scripts directory into the container
COPY ./scripts/ /app/scripts/

# Ensure shell scripts are executable
RUN chmod +x /app/scripts/shell/*.sh

# Expose port for FastAPI
EXPOSE 8000

# Run FastAPI with uvicorn
CMD ["python", "-u", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
