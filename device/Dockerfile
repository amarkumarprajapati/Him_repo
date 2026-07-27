FROM python:3.10-slim-bookworm

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DEBIAN_FRONTEND noninteractive

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential libpq-dev fping net-tools lsof \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy all backend source code
COPY . .

# Create required directories for Django logging and caching
RUN mkdir -p logs cache staticfiles exports

# Run collectstatic (dummy key needed to bypass Django checks during build)
RUN SECRET_KEY=dummy-key-for-build python manage.py collectstatic --noinput --clear

EXPOSE 8000

# Start Gunicorn server (binds to 8000 internally based on gunicorn.conf.py)
CMD ["gunicorn", "--config", "core/gunicorn.conf.py", "core.wsgi:application"]
