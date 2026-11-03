FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Copier les fichiers de dépendances uv
COPY pyproject.toml ./

# Installer les dépendances dans l'environnement virtuel du conteneur
RUN uv sync --no-dev

# Copier le code applicatif
COPY app ./app

EXPOSE 8080

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

