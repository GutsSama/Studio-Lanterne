"""Configuration centralisée du backend via variables d'environnement."""

from pydantic_settings import BaseSettings, SettingsConfigDict


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
    llm_timeout_seconds: float = 3.5
    max_tokens_per_game: int = 50000
    sliding_window_messages: int = 8
    debate_rounds_per_day: int = 2

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

