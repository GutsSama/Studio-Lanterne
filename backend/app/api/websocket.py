"""WebSocket temps réel pour le débat séquentiel des 5 IA et les transitions de phases."""

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.agents.orchestrator import interroger_agent_ia
from app.api.routes import serialiser_partie_pour_humain
from app.config import settings
from app.models.enums import CanalMessage, PhasePartie
from app.models.game import MessagePartie
from app.services.supabase_service import depot_parties

ws_router = APIRouter(tags=["websocket"])


@ws_router.websocket("/ws/parties/{partie_id}")
async def websocket_partie(websocket: WebSocket, partie_id: UUID) -> None:
    """Canal temps réel entre le joueur humain et le moteur de jeu."""
    await websocket.accept()
    partie = depot_parties.obtenir(partie_id)
    if partie is None:
        await websocket.send_json({"type": "erreur", "detail": "Partie introuvable."})
        await websocket.close(code=1008)
        return

    # Envoi de l'état initial filtré (anti-triche)
    await websocket.send_json(
        {
            "type": "etat_partie",
            "donnees": serialiser_partie_pour_humain(partie),
        }
    )

    try:
        while True:
            payload = await websocket.receive_json()
            commande = payload.get("commande")

            if commande == "lancer_tour_debat_ia":
                if partie.phase_actuelle != PhasePartie.DEBAT_JOUR:
                    await websocket.send_json(
                        {
                            "type": "erreur",
                            "detail": "Le débat IA ne peut être lancé que pendant debat_jour.",
                        }
                    )
                    continue

                # Débat séquentiel : chaque IA vivante prend la parole l'une après l'autre
                for tour_table in range(1, settings.debate_rounds_per_day + 1):
                    for agent in partie.joueurs_vivants():
                        if agent.est_humain:
                            continue

                        reponse_ia, tokens = await interroger_agent_ia(
                            partie,
                            agent,
                            instruction_phase=(
                                f"Tour de table {tour_table}/{settings.debate_rounds_per_day} du débat diurne. "
                                "Réagis aux dernières déclarations, exprime tes soupçons ou défends-toi."
                            ),
                        )

                        msg = MessagePartie(
                            partie_id=partie.id,
                            joueur_emetteur_id=agent.id,
                            nom_emetteur=agent.nom_affiche,
                            canal=CanalMessage.VILLAGE_PUBLIC,
                            tour=partie.tour_actuel,
                            phase=partie.phase_actuelle,
                            contenu=reponse_ia.declaration_publique,
                            est_ia=True,
                            tokens_utilises=tokens,
                        )
                        partie.messages.append(msg)

                        # Diffusion immédiate de la déclaration publique (JAMAIS `analyse_interne`)
                        await websocket.send_json(
                            {
                                "type": "message_ia",
                                "message": msg.model_dump(mode="json"),
                                "tokens_total_utilises": partie.tokens_total_utilises,
                                "cout_estime_usd": partie.cout_estime_usd,
                            }
                        )

            elif commande == "rafraichir_etat":
                await websocket.send_json(
                    {
                        "type": "etat_partie",
                        "donnees": serialiser_partie_pour_humain(partie),
                    }
                )

    except WebSocketDisconnect:
        return

