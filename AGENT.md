# AGENT.md — Guide & Directives Techniques pour Agents IA

> **Projet :** "Créatures de la Nuit vs IA" — Client : **Studio Lanterne**  
> **Référence :** [`roadmap/document_de_cadrage.md`](roadmap/document_de_cadrage.md) & [`REGLELOUPGAROU.md`](REGLELOUPGAROU.md)

Ce fichier définit les conventions, l'architecture technique, la stack technologique et les garde-fous obligatoires à respecter lors de toute intervention sur le dépôt **Studio Lanterne**.

---

## 1. Stack Technologique & Rôles des Composants

| Couche | Technologies | Responsabilités & Règles d'Implémentation |
| :--- | :--- | :--- |
| **Frontend** | **React**, **TypeScript**, **Tailwind CSS** | Interface immersive, chat en temps réel (WebSockets), animations des cycles Jour/Nuit et des votes. **Typage TypeScript strict obligatoire** (aucun `any` implicite sur les états de jeu). |
| **Backend** | **Python >= 3.11**, **FastAPI**, **Pydantic v2**, **Uvicorn**, **uv** | Moteur de règles déterministe, API REST & WebSockets temps réel, cloisonnement contextuel anti-triche et interrogation asynchrone (`asyncio`) des agents IA. |
| **Base de Données & Auth** | **Supabase (PostgreSQL 17)**, **JWT**, **Row-Level Security (RLS)** | Authentification sécurisée, persistance des parties, statistiques joueurs, succès (*achievements*) et suivi des coûts/tokens. **Nomenclature SQL 100 % en français.** |
| **Orchestration IA** | **LiteLLM** (`acompletion`) | Interface unifiée d'appel aux LLM, gestion des timeouts/fallbacks et **calcul/suivi natif des tokens et coûts** à chaque requête. |
| **Fournisseurs LLM** | **Groq** (Llama 3), **Google Gemini**, **Mistral AI** | Multi-fournisseurs pour créer des personnalités distinctes : **Mistral AI** (conformité RGPD / souveraineté UE), **Groq** (faible latence / immersion), **Gemini** (grande fenêtre contextuelle). |
| **Qualité & CI/CD** | **Pytest** (`pytest-asyncio`), **Docker**, **GitHub Actions**, **Google Cloud Run** | Tests unitaires systématiques sur les règles métier et cas limites. Déploiement continu *serverless* sur GCP Cloud Run (scale-to-zero). |

---

## 2. Structure du Dépôt

```text
Studio-Lanterne/
├── AGENT.md                         # Directives pour les agents de code (ce fichier)
├── README.md                        # Documentation générale et MCD
├── REGLELOUPGAROU.md                # Règles officielles et rôles du jeu
├── roadmap/
│   └── document_de_cadrage.md       # Document de cadrage et choix d'architecture
├── supabase/
│   ├── migrations/                  # Schémas PostgreSQL, enums, triggers et politiques RLS
│   └── seed.sql                     # Données initiales (personnalités IA, succès)
└── backend/
    ├── pyproject.toml               # Dépendances Python gérées avec uv
    ├── Dockerfile                   # Image de production pour Google Cloud Run
    ├── .env.example                 # Modèle des variables d'environnement
    ├── app/
    │   ├── main.py                  # Point d'entrée FastAPI & CORS
    │   ├── config.py                # Configuration Pydantic Settings (.env)
    │   ├── models/                  # Modèles Pydantic (enums, game, ai_schema)
    │   ├── engine/                  # Moteur de jeu déterministe (fsm.py, rules.py)
    │   ├── agents/                  # Cloisonnement (context_builder.py) & LiteLLM (orchestrator.py)
    │   ├── api/                     # Endpoints REST (routes.py) & temps réel (websocket.py)
    │   └── services/                # Client et requêtes Supabase (supabase_service.py)
    └── tests/                       # Tests unitaires et fonctionnels Pytest
```

---

## 3. Règles d'Architecture Critiques (Garde-fous)

### 3.1. Dispositif Anti-Triche & Cloisonnement Contextuel
* **Filtrage strict côté Backend ([`backend/app/agents/context_builder.py`](backend/app/agents/context_builder.py)) :** Ne **jamais** envoyer l'état global de la partie ou les rôles cachés dans le prompt d'un agent IA.
  * Un agent **Citoyen** ne reçoit **que** l'historique des canaux `village_public` / `systeme` et les informations liées à son propre rôle.
  * Un agent **Créature de la Nuit** reçoit le canal `creature_secret` et connaît son coéquipier Créature.
* **Autorité du Moteur ([`backend/app/engine/`](backend/app/engine/)) :** Le LLM propose une intention ; le backend valide systématiquement que l'agent est en vie, que la phase autorise l'action et que la cible est valide.

### 3.2. Sortie Structurée Obligatoire (JSON Mode)
Tous les appels LLM effectués via **LiteLLM** ([`backend/app/agents/orchestrator.py`](backend/app/agents/orchestrator.py)) doivent contraindre la sortie au schéma Pydantic [`ReponseAgentIA`](backend/app/models/ai_schema.py) contenant exactement trois clés :
```json
{
  "analyse_interne": "Réflexion stratégique privée (jamais exposée aux autres joueurs)",
  "action_technique": {
    "phase": "nuit | debat_jour | vote_jour | tour_alchimiste | tour_garde_du_corps",
    "cible_id": "uuid-ou-nom-du-joueur-cible-ou-null",
    "pouvoir_utilise": "inquisiteur_inspecter | alchimiste_soigner | alchimiste_empoisonner | garde_du_corps_tirer | null"
  },
  "declaration_publique": "Message affiché dans le chat"
}
```
* Toujours prévoir un **fallback** déterministe si un fournisseur LLM échoue, dépasse le `LLM_TIMEOUT_SECONDS` ou renvoie un JSON invalide, afin de ne jamais bloquer la boucle de jeu.

### 3.3. Maîtrise des Coûts (Low-Cost) & Observabilité
* Utiliser exclusivement **`litellm`** pour appeler Groq, Mistral et Gemini afin de conserver une syntaxe unique.
* Comptabiliser les tokens consommés (`tokens_utilises`, `tokens_total_utilises`, `cout_estime_usd`) à chaque requête et respecter les limites définies dans `.env` (`MAX_TOKENS_PER_GAME`, `SLIDING_WINDOW_MESSAGES`, `DEBATE_ROUNDS_PER_DAY`).
* Exécuter les appels aux agents en parallèle (`asyncio.gather`) lorsque plusieurs agents interviennent simultanément pour préserver la fluidité.

### 3.4. Conformité RGPD, AI Act & Sécurité
* **AI Act :** Le joueur humain doit être explicitement informé qu'il interagit avec des agents IA (`consentement_ai_act` dans la table `profils`).
* **Sécurité des secrets :** Ne jamais commiter de fichier `.env` ou de clés API (`GROQ_API_KEY`, `MISTRAL_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Mettre à jour [`backend/.env.example`](backend/.env.example) lors de l'ajout d'une variable de configuration.
* **Nomenclature :** Respecter les noms de tables, colonnes et énumérations en **français** (ex. `parties`, `joueurs_partie`, `messages_partie`, `votes_partie`, `actions_partie`, `personnalites_ia`).

---

## 4. Commandes de Développement & Tests

### Backend (avec `uv`)
```bash
# Se placer dans le dossier backend
cd backend

# Installer / synchroniser les dépendances
uv sync

# Lancer le serveur FastAPI en mode développement
uv run uvicorn app.main:app --reload --port 8000

# Exécuter la suite de tests unitaires (Pytest)
uv run pytest -v
```

### Règles de Test (Pytest)
* Toute modification des règles de jeu ([`rules.py`](backend/app/engine/rules.py)), de la machine à états ([`fsm.py`](backend/app/engine/fsm.py)), du cloisonnement contextuel ou du schéma JSON IA **doit** être accompagnée de tests unitaires dans [`backend/tests/`](backend/tests/) couvrant les cas nominaux et les cas limites (égalité de votes, immunités, potions de la sorcière, mémoire de la voyante, etc.).

## 5. Configuration & Environnement IA (Antigravity / IDE)

> **Note pour le développeur humain :** Ce fichier sert de contexte de base. Pour garantir des performances optimales sur des plateformes comme Antigravity Pro, Cursor ou Windsurf, suivez cette configuration :

1. **Inclusion :** Chargez toujours ce fichier `AGENT.md` dans le contexte principal de la session.
2. **Prompt Système à configurer dans l'interface :**
   *"Tu es l'Expert Frontend et UX/UI du projet 'Créatures de la Nuit vs IA'. Tes choix d'architecture doivent respecter à la lettre le fichier AGENT.md fourni en contexte. Tu interviens uniquement sur React, TypeScript et Tailwind CSS. Tu as l'interdiction d'utiliser des `any` implicites et tu dois calquer tes interfaces TypeScript sur les modèles Pydantic du backend."*
