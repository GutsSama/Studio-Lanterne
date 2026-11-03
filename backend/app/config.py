"""Configuration centralisée du backend via variables d'environnement."""

import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Charger automatiquement backend/.env quel que soit le répertoire courant
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)


class Settings(BaseSettings):
    """Paramètres d'exécution du serveur FastAPI, Supabase et LiteLLM."""

    app_env: str = "development"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Clés API LLM (lues automatiquement par LiteLLM dans l'environnement)
    groq_api_key: str = ""
    mistral_api_key: str = ""
    gemini_api_key: str = ""

    # Garde-fous Moteur IA & Budget
    llm_timeout_seconds: float = 8.0
    max_tokens_per_game: int = 50000
    sliding_window_messages: int = 8
    debate_rounds_per_day: int = 2

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

# Garantir que LiteLLM trouve les clés dans os.environ
if settings.groq_api_key:
    os.environ.setdefault("GROQ_API_KEY", settings.groq_api_key)
if settings.mistral_api_key:
    os.environ.setdefault("MISTRAL_API_KEY", settings.mistral_api_key)
if settings.gemini_api_key:
    os.environ.setdefault("GEMINI_API_KEY", settings.gemini_api_key)

