# Synthèse de Cadrage Technique : Créatures de la Nuit (Déduction Sociale vs IA)
**Client :** Studio Lanterne | **Format :** 1 Joueur Humain vs 5 Agents IA

---

## 1. Vision & Règles du Jeu (6 Joueurs)
*   **Principe d'intégrité :** **« L'IA propose, le moteur valide. »** Le moteur Python arbitre l'état de la partie, les pouvoirs et les éliminations. Les LLM n'ont aucun accès direct à la logique de jeu.
*   **Camp des Citoyens (4) :**
    *   *Inquisiteur :* Inspecte l'alignement d'un joueur par nuit.
    *   *Alchimiste :* 1 potion de Vie (sauvetage) et 1 potion de Mort par partie.
    *   *Garde du Corps :* Élimine un joueur au choix lors de son élimination.
    *   *Citoyen :* Déduction et vote diurne.
*   **Camp des Créatures (2) :** Se connaissent, éliminent 1 citoyen chaque nuit et bluffent le jour.
*   **UI Humain selon rôle :**
    *   *Créature :* Canal secret de nuit avec son coéquipier IA.
    *   *Inquisiteur :* Modale d'inspection nocturne (résultat sécurisé).
    *   *Alchimiste :* Affichage de la victime nocturne + boutons d'action (Vie / Mort).

---

## 2. Moteur de Jeu & Machine à États (FSM)
*   **Cycle d'une manche :**  
    `NUIT` (Inquisiteur $\rightarrow$ Créatures $\rightarrow$ Alchimiste) $\rightarrow$ `AUBE` (Annonce morts & check victoire) $\rightarrow$ `JOUR` (Débat séquentiel) $\rightarrow$ `VOTE` (Élimination) $\rightarrow$ `CHECK VICTOIRE`.
*   **Victoire :** Citoyens gagnent si toutes les Créatures meurent ; Créatures gagnent si Créatures $\ge$ Citoyens vivants.
*   **Cas limites couverts par Pytest :**
    *   Égalité de votes au Conseil (aucun mort ou vote départagé).
    *   Ciblage invalide (joueur déjà mort, auto-sauvetage non autorisé).
    *   Timeout LLM (> 4s) : fallback automatique vers un vote blanc/aléatoire.
    *   Prompt injection du joueur (les secrets ne sont jamais dans le prompt d'un Citoyen).

---

## 3. Architecture IA & Débat Temps Réel
*   **Découplage Personnalité vs Modèle :**  
    Les personnalités sont pilotées à 100% par des **fiches de profil dans les Prompts Système** (ton, agressivité, crédulité, stratégie de bluff), et non par le modèle sous-jacent.
*   **Justification Technique du Multi-Fournisseurs (Groq, Mistral, Gemini) :**
    1.  *Diversité stylistique & Anti-mimétisme (« Groupthink ») :* Évite que les 5 agents partagent les mêmes tics de langage et biais d'alignement d'un modèle unique.
    2.  *Répartition de charge (Rate Limits Free Tier) :* Évite la saturation des quotas requêtes/min (RPM/TPM) d'un fournisseur unique lors des pics de débat.
    3.  *Résilience via LiteLLM :* Normalisation des sorties sous schéma Pydantic strict et isolation des timeouts (3,5 s max par appel avec fallback local).
*   **Répartition des 5 Agents IA :**

| Agent IA (`seed.sql`) | Archétype & Profil Psychologique | Modèle LiteLLM & Fournisseur | Rôle / Atout |
| :--- | :--- | :--- | :--- |
| **Gérard le Râleur** | `mauvais_joueur` (*Le Leader Agressif*) | `groq/llama-3.1-8b-instant` (**Groq**) | Vitesse (< 400ms), lance le débat |
| **Elena la Stratège** | `stratege` (*La Logicienne Méfiante*) | `mistral/mistral-small-latest` (**Mistral AI**) | Rigueur d'analyse, concision |
| **Bob le Rigolo** | `drole` (*Le Bluffeur Imperturbable*) | `gemini/gemini-1.5-flash` (**Google**) | Analyse synthétique du contexte |
| **Sœur Béatrice** | `mystique` (*La Diplomate Mystique*) | `mistral/mistral-small-latest` (**Mistral AI**) | Modération et ton solennel |
| **Lucas le Paranoïaque** | `paranoiaque` (*Le Suiveur Nerveux*) | `groq/llama-3.1-8b-instant` (**Groq**) | Réactivité pour rebondir en fin de tour |

*   **Débat diurne ordonné :**  
    Débat séquentiel en **2 tours de table**. Chaque agent reçoit les répliques émises juste avant lui pour rebondir et s'écouter réellement. En cas de timeout ou panne d'un modèle, seul l'agent concerné bascule sur un vote par défaut sans bloquer les autres.

---

## 4. Contexte & Sécurité des Données
*   **Construction du Prompt :**
    *   *Game State Digest :* Résumé structuré (vivants/morts, historique succinct) $\approx$ 150 tokens.
    *   *Fenêtre glissante :* 8 derniers messages du chat public uniquement.
    *   *Cloisonnement strict (Zero Information Leak) :* Aucun message de nuit n'est envoyé aux Citoyens.
*   **Format JSON Strict de Sortie :**
    ```json
    {
      "analyse_interne": "Raisonnement stratégique masqué (CoT)",
      "action_technique": { "phase": "vote_jour", "cible_id": "Joueur_3", "pouvoir_utilise": null },
      "declaration_publique": "Mon message visible dans le chat."
    }
    ```
*   **Sécurité d'`analyse_interne` :**  
    Conservé **exclusivement en mémoire vive backend** durant le tour. **Jamais** transmis via WebSocket au client web, ni exposé dans des logs publics.

---

## 5. Stack Technique & Infrastructure
*   **Frontend :** **React (TypeScript) + Tailwind CSS** (base générée via Lovable, logique d'état et WebSockets codés et maintenus par l'équipe).
*   **Backend :** **Python + FastAPI** (traitement asynchrone, WebSockets natifs).
*   **Hébergement & Persistance :** **Google Cloud Run** configuré avec `min-instances: 1` et *Session Affinity* (ou serveur persistant) pour préserver la mémoire vive de la partie et éliminer les *cold starts*.
*   **Base de Données & Auth :** **Supabase (PostgreSQL, UE)** pour l'authentification JWT et les statistiques globales.
*   **Tests & CI/CD :** **Pytest** + **GitHub Actions** pour le déploiement continu.

---

## 6. Budget Chiffré & Conformité
*   **Consommation estimée :** ~5 000 tokens/cycle $\times$ 4 cycles $\approx$ **20 000 à 25 000 tokens par partie**.
*   **Coût estimé :** **< 0,003 $ par partie** (avec Groq Llama 3.1 8B). Plafond d'urgence LiteLLM fixé à 50 000 tokens.
*   **RGPD :** Minimisation des données (pseudo + mot de passe hashé, pas d'email obligatoire, messages de chat éphémères non conservés).
*   **AI Act :** Notification transparente dans l'interface informant le joueur qu'il affronte 5 IA.
