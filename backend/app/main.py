"""Point d'entrée FastAPI — Le Beffroi Central (Studio Lanterne)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.websocket import ws_router
from app.config import settings

app = FastAPI(
    title="Studio Lanterne — Créatures de la Nuit vs IA",
    description=(
        "Moteur de jeu déterministe anti-triche et orchestrateur multi-modèles LiteLLM "
        "(Groq, Mistral, Gemini) conforme RGPD & AI Act."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health", tags=["systeme"])
async def healthcheck() -> dict[str, str]:
    return {"statut": "ok", "service": "studio-lanterne-backend"}

