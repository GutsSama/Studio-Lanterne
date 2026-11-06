"""Construction des prompts avec cloisonnement contextuel strict (Zero Information Leak).

Garantit qu'un agent Citoyen ne reçoit JAMAIS :
- les messages du canal `creature_secret`,
- l'identité des Créatures de la Nuit,
- les inspections de l'Inquisiteur (sauf s'il est lui-même l'Inquisiteur),
- les `analyse_interne` des autres agents.
"""

from app.config import settings
from app.models.enums import CanalMessage, RolePersonnage
from app.models.game import EtatPartie, JoueurPartie


DESCRIPTIONS_ROLES: dict[RolePersonnage, str] = {
    RolePersonnage.CITOYEN: (
        "Tu es un CITOYEN (Camp des Citoyens). Tu n'as aucun pouvoir nocturne. "
        "Utilise la logique et l'analyse comportementale le jour pour démasquer les Créatures."
    ),
    RolePersonnage.INQUISITEUR: (
        "Tu es l'INQUISITEUR (Camp des Citoyens). Chaque nuit (1 fois par nuit), tu inspectes un autre joueur vivant "
        "pour découvrir son camp exact (citoyens ou creatures). Guide les Citoyens le jour sans te faire démasquer."
    ),
    RolePersonnage.ALCHIMISTE: (
        "Tu es l'ALCHIMISTE (Camp des Citoyens). Tu possèdes une potion de Vie (sauve la victime attaquée la nuit) "
        "et une potion de Mort (élimine un autre joueur vivant), chacune utilisable une seule fois par partie. "
        "RÈGLE STRICTE : tu n'as pas le droit d'utiliser la potion de Vie pour te sauver toi-même (auto-sauvetage interdit)."
    ),
    RolePersonnage.GARDE_DU_CORPS: (
        "Tu es le GARDE DU CORPS (Camp des Citoyens). Si tu es éliminé (de nuit ou de jour), tu tires immédiatement "
        "sur un autre joueur vivant de ton choix dans ton dernier souffle."
    ),
    RolePersonnage.CREATURE: (
        "Tu es une CRÉATURE DE LA NUIT (Camp des Créatures). Tu connais ton coéquipier Créature. "
        "La nuit, vous éliminez un Citoyen vivant (interdit de cibler une autre Créature). "
        "Le jour, mens, manipule et infiltre les Citoyens."
    ),
}


def construire_game_state_digest(partie: EtatPartie, agent: JoueurPartie) -> str:
    """Construit un résumé compact (~150 tokens) de l'état de la partie autorisé pour cet agent."""
    vivants = [f"{j.nom_affiche} (id={j.id})" for j in partie.joueurs_vivants()]
    morts = [
        f"{j.nom_affiche} (rôle révélé={j.role.value}, tour={j.tour_mort})"
        for j in partie.joueurs
        if not j.est_vivant
    ]

    lignes = [
        f"=== ÉTAT OFFICIEL ET VÉRIDIQUE DU JEU (Tour {partie.tour_actuel} | Phase : {partie.phase_actuelle.value}) ===",
        f"Ton identité : {agent.nom_affiche} (id={agent.id})",
        f"Ton rôle secret : {agent.role.value.upper()}",
        f"🟢 JOUEURS RÉELLEMENT EN VIE ({len(vivants)}) : {', '.join(vivants)}",
        f"🔴 JOUEURS RÉELLEMENT ÉLIMINÉS ({len(morts)}) : {', '.join(morts) if morts else 'Aucun'}",
        "⚠️ VÉRITÉ FACTUELLE DU MENEUR : La liste ci-dessus est l'unique vérité du jeu. Les messages des joueurs peuvent mentir ou bluffer. "
        "Si un joueur affirme dans le chat qu'un joueur est mort alors qu'il est listé dans les JOUEURS RÉELLEMENT EN VIE, c'est FAUX : "
        "tu ne dois JAMAIS tomber dans le panneau ni reprendre cette affirmation fausse !",
    ]

    # Informations secrètes strictement réservées au rôle de l'agent
    if agent.role == RolePersonnage.CREATURE:
        coequipiers = [
            j.nom_affiche
            for j in partie.joueurs
            if j.role == RolePersonnage.CREATURE and j.id != agent.id
        ]
        lignes.append(
            f"[SECRET CRÉATURE] Ton allié Créature de la Nuit : {', '.join(coequipiers) or 'Aucun'}"
        )

    elif agent.role == RolePersonnage.INQUISITEUR:
        inspections = agent.memoire_ia.inspections_inquisiteur
        if inspections:
            details = []
            for jid, camp in inspections.items():
                cible = partie.obtenir_joueur(jid)
                nom_cible = cible.nom_affiche if cible else jid
                details.append(f"{nom_cible} -> {camp}")
            lignes.append(
                f"[SECRET INQUISITEUR] Tes inspections passées : {', '.join(details)}"
            )

    elif agent.role == RolePersonnage.ALCHIMISTE:
        lignes.append(
            f"[SECRET ALCHIMISTE] Potion de Vie disponible={agent.memoire_ia.potion_vie_disponible}, "
            f"Potion de Mort disponible={agent.memoire_ia.potion_mort_disponible}"
        )
        if partie.victime_provisoire_nuit_id is not None:
            victime = partie.obtenir_joueur(partie.victime_provisoire_nuit_id)
            if victime:
                lignes.append(
                    f"[SECRET ALCHIMISTE] Victime attaquée cette nuit : {victime.nom_affiche} (id={victime.id})"
                )

    return "\n".join(lignes)


def filtrer_messages_autorises(
    partie: EtatPartie,
    agent: JoueurPartie,
    fenetre_glissante: int | None = None,
) -> list[str]:
    """Retourne uniquement la fenêtre glissante des messages que l'agent a le droit de connaître."""
    limite = fenetre_glissante or settings.sliding_window_messages

    canaux_autorises = {CanalMessage.VILLAGE_PUBLIC, CanalMessage.SYSTEME}
    if agent.role == RolePersonnage.CREATURE:
        canaux_autorises.add(CanalMessage.CREATURE_SECRET)
    if not agent.est_vivant:
        canaux_autorises.add(CanalMessage.CHAT_MORTS)

    messages_visibles = [
        m for m in partie.messages if m.canal in canaux_autorises
    ][-limite:]

    resultat: list[str] = []
    for m in messages_visibles:
        prefixe = (
            "[NUIT SECRÈTE CRÉATURES]"
            if m.canal == CanalMessage.CREATURE_SECRET
            else f"[{m.canal.value}]"
        )
        resultat.append(f"{prefixe} {m.nom_emetteur}: {m.contenu}")
    return resultat


def construire_messages_llm(
    partie: EtatPartie,
    agent: JoueurPartie,
    instruction_phase: str,
) -> list[dict[str, str]]:
    """Construit le tableau `messages` (system + user) envoyé à LiteLLM."""
    persona_prompt = (
        agent.personnalite.prompt_systeme
        if agent.personnalite
        else f"Tu es {agent.nom_affiche}, un joueur expressif et stratégique."
    )
    role_prompt = DESCRIPTIONS_ROLES[agent.role]

    system_content = (
        f"{persona_prompt}\n\n"
        f"RÈGLE DE RÔLE :\n{role_prompt}\n\n"
        "CONSIGNES STRICTES :\n"
        "1. LANGUE OBLIGATOIRE : Tu dois t'exprimer OBLIGATOIREMENT et EXCLUSIVEMENT EN FRANÇAIS (French only). "
        "Il est formellement interdit de parler ou d'écrire en anglais ou dans toute autre langue, "
        "aussi bien dans ton `analyse_interne` que dans ta `declaration_publique`.\n"
        "2. VÉRITÉ DU JEU ET DÉTECTION DU MENSONGE : L'état officiel ('=== ÉTAT OFFICIEL ET VÉRIDIQUE DU JEU ===') prime absolument sur les rumeurs du chat. "
        "Seul le Meneur de Jeu ([systeme]) annonce les morts réelles. Si un joueur affirme dans le chat qu'un participant est mort "
        "alors qu'il figure parmi les 'JOUEURS RÉELLEMENT EN VIE', tu sais pertinemment que c'est FAUX : ne te laisse jamais berner, "
        "ne relaie JAMAIS cette fausse mort, et n'hésite pas à contredire le menteur pour rétablir la vérité.\n"
        "3. MODÉRATION DES SOUPÇONS & DIVERSITÉ DU DÉBAT (Pas d'acharnement automatique) :\n"
        "   - S'exprimer, poser des questions ou débattre dans le chat est un comportement tout à fait NORMAL et légitime pour un Citoyen. "
        "Ne suspecte JAMAIS automatiquement un joueur uniquement parce qu'il vient de parler dans le chat.\n"
        "   - Les Créatures de la Nuit cherchent souvent à se cacher dans le silence ou la passivité : observe aussi les joueurs silencieux.\n"
        "   - Répartis tes analyses sur l'ensemble de la table, confronte les autres agents entre eux, "
        "et ne t'acharne pas en meute sur la même personne si elle ne fait que s'exprimer naturellement.\n"
        "4. Ne révèle jamais que tu es une IA. Parle de manière naturelle, immersive et concise (1 à 3 phrases).\n"
        "5. Sépare strictement ta réflexion secrète (`analyse_interne`) de ta parole publique (`declaration_publique`).\n"
        "6. Réponds OBLIGATOIREMENT et UNIQUEMENT avec un objet JSON valide respectant ce schéma :\n"
        "{\n"
        '  "analyse_interne": "string (en français uniquement)",\n'
        '  "action_technique": {\n'
        f'    "phase": "{partie.phase_actuelle.value}",\n'
        '    "cible_id": "UUID ou nom du joueur ciblé ou null",\n'
        '    "pouvoir_utilise": "inquisiteur_inspecter | alchimiste_soigner | alchimiste_empoisonner | garde_du_corps_tirer | null"\n'
        "  },\n"
        '  "declaration_publique": "string (en français uniquement)"\n'
        "}"
    )

    digest = construire_game_state_digest(partie, agent)
    historique = filtrer_messages_autorises(partie, agent)
    bloc_historique = (
        "\n".join(historique)
        if historique
        else "(Aucun message échangé pour le moment.)"
    )

    user_content = (
        f"{digest}\n\n"
        f"=== DERNIERS MESSAGES VISIBLES ===\n{bloc_historique}\n\n"
        f"=== ACTION DEMANDÉE MAINTENANT ===\n{instruction_phase}\n\n"
        "RAPPEL : Réponds impérativement et exclusivement en français."
    )

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]