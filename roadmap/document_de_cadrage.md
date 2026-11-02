# Document de Cadrage et Architecture Technique
**Projet :** "Loup-Garou vs IA" (Client : Studio Lanterne)

## 1. Vision Globale et Réponse aux Besoins
La plateforme propose une expérience de jeu fluide, réactive et sécurisée, où un joueur humain affronte cinq agents IA aux personnalités distinctes. L'architecture a été pensée pour garantir un respect strict des règles (anti-triche), une maîtrise totale des coûts (low cost) et une conformité RGPD (AI Act), tout en assurant un déploiement automatisé et accessible.

## 2. Architecture de l'Application et Stack Technologique

*   **Frontend : React (TypeScript) et Tailwind CSS (via Lovable)**
    *   *Justification :* Permet de délivrer rapidement une interface "recherchée et sympathique" avec un chat en temps réel. TypeScript assure un typage strict évitant les erreurs de manipulation des données de jeu côté client, et l'approche par composants facilite l'intégration des animations (votes, phases de jour/nuit).
*   **Backend : Python avec FastAPI**
    *   *Justification :* Langage de référence pour l'intégration d'IA. FastAPI gère nativement le traitement asynchrone (indispensable pour interroger plusieurs agents simultanément sans bloquer le moteur) et les WebSockets pour un chat en temps réel fluide.
*   **Base de Données et Authentification : Supabase (PostgreSQL)**
    *   *Justification :* Fournit un système d'authentification robuste (JWT) pour les comptes sécurisés, respectant la demande du client. La base PostgreSQL permet de structurer efficacement les statistiques de parties (taux de victoire, rôles joués) et s'intègre parfaitement avec FastAPI, le tout dans une offre gratuite amplement suffisante.

## 3. Moteur d'Intelligence Artificielle et Observabilité

*   **Approche Multi-Fournisseurs : Groq (Llama 3), Google Gemini, et Mistral AI**
    *   *Justification :* L'utilisation de modèles distincts crée des personnalités naturellement différentes. Mistral AI apporte la conformité RGPD/AI Act (souveraineté européenne), Groq garantit une vitesse de réponse ultra-rapide (immersion), et Gemini gère les rôles nécessitant une grande mémoire contextuelle.
*   **Orchestration et Suivi des Coûts : LiteLLM**
    *   *Justification :* Cet outil unifie le code métier (une seule syntaxe Python pour appeler Groq, Gemini ou Mistral). Il intègre un suivi natif de la consommation des tokens pour chaque requête, permettant de prouver au client la maîtrise budgétaire et de mesurer l'impact des optimisations.

## 4. Moteur de Jeu et Dispositif Anti-Triche

*   **Cloisonnement Contextuel par le Backend**
    *   *Justification :* Les IA ne peuvent pas révéler des informations qu'elles ne possèdent pas, car c'est le serveur FastAPI qui filtre les données envoyées dans le *prompt*. Un agent Villageois ne recevra que l'historique du chat de jour, rendant techniquement impossible toute hallucination sur les discussions nocturnes des Loups-Garous.
*   **Extraction des Actions par Sortie Structurée (JSON Mode)**
    *   *Justification :* Pour éviter les plantages liés à la génération de texte libre, les IA sont contraintes de répondre via un format JSON strict comprenant trois champs : `pensees_secretes` (pour forcer la réflexion stratégique), `message_chat` (affiché au joueur), et `action_vote` (valeur exacte extraite de manière fiable par Python).

## 5. Assurance Qualité, Sécurité et Déploiement

*   **Tests et Versioning : Pytest et GitHub**
    *   *Justification :* Chaque règle du jeu et cas limite (égalité de votes, pouvoirs) est couvert par des tests unitaires validant l'intégrité de la partie. Le dépôt GitHub inclut un `.gitignore` rigoureux (excluant les clés API et `.env`).
*   **Déploiement Automatisé : GitHub Actions et Google Cloud Run (GCP)**
    *   *Justification :* L'intégration continue (CI/CD) déploie le backend automatiquement. Cloud Run fonctionne en mode *Serverless* : l'infrastructure s'adapte à la demande et tombe à un coût de zéro lorsque la plateforme n'est pas utilisée.

---

## 6. Schéma d'Architecture (Roadmap visuelle)

<p align="center">
  <img src="studio_lantern/Studio-Lanterne/roadmap/Gemini_Generated_Image_c9dltuc9dltuc9dl.jpg" alt="Plan d'Architecture" width="800">
</p>