/**
 * Types du jeu — calqués strictement sur les modèles Pydantic du backend
 * (`backend/app/models/enums.py`, `backend/app/models/game.py`) et sur la
 * sérialisation anti-triche `serialiser_partie_pour_humain` (`backend/app/api/routes.py`).
 */

// ─── Énumérations (StrEnum Python) ──────────────────────────────────────────

export const STATUTS_PARTIE = ["en_attente", "en_cours", "terminee", "abandonnee"] as const;
export type StatutPartie = (typeof STATUTS_PARTIE)[number];

export const PHASES_PARTIE = [
  "nuit",
  "debat_jour",
  "vote_jour",
  "tour_garde_du_corps",
  "tour_alchimiste",
  "terminee",
] as const;
export type PhasePartie = (typeof PHASES_PARTIE)[number];

export const ROLES_PERSONNAGE = [
  "citoyen",
  "creature",
  "inquisiteur",
  "alchimiste",
  "garde_du_corps",
] as const;
export type RolePersonnage = (typeof ROLES_PERSONNAGE)[number];

export type CampPartie = "citoyens" | "creatures" | "solo" | "egalite";

export const CANAUX_MESSAGE = ["village_public", "creature_secret", "chat_morts", "systeme"] as const;
export type CanalMessage = (typeof CANAUX_MESSAGE)[number];

export type TypeActionJeu =
  | "inquisiteur_inspecter"
  | "alchimiste_soigner"
  | "alchimiste_empoisonner"
  | "garde_du_corps_tirer";

export type ArchetypeIA = "mauvais_joueur" | "stratege" | "drole" | "mystique" | "paranoiaque";

/** Les UUID sont sérialisés en chaînes JSON. */
export type UUID = string;
/** Les datetime sont sérialisés en ISO 8601. */
export type DateISO = string;

// ─── Modèles exposés au client (vue filtrée anti-triche) ────────────────────

/** Joueur tel qu'exposé par `serialiser_partie_pour_humain` (rôle masqué si secret). */
export interface JoueurPublic {
  id: UUID;
  est_humain: boolean;
  nom_affiche: string;
  avatar_url: string;
  modele_ia: string | null;
  archetype: ArchetypeIA | null;
  /** `null` tant que le rôle est secret pour le joueur humain. */
  role: RolePersonnage | null;
  est_vivant: boolean;
  numero_siege: number;
  tour_mort: number | null;
  cause_mort: string | null;
}

/** `MessagePartie` (model_dump mode="json"). */
export interface MessagePartie {
  id: UUID;
  partie_id: UUID;
  joueur_emetteur_id: UUID | null;
  nom_emetteur: string;
  canal: CanalMessage;
  tour: number;
  phase: PhasePartie;
  contenu: string;
  est_ia: boolean;
  tokens_utilises: number;
  cree_le: DateISO;
}

/** `VotePartie`. */
export interface VotePartie {
  id: UUID;
  partie_id: UUID;
  tour: number;
  phase: PhasePartie;
  joueur_votant_id: UUID;
  joueur_cible_id: UUID;
  argumentation: string | null;
  cree_le: DateISO;
}

/** Informations secrètes propres au rôle du joueur humain. */
export interface InformationsRoleHumain {
  /** Inquisiteur : `{joueur_id: camp_decouvert}`. */
  inspections_inquisiteur?: Record<UUID, string>;
  /** Alchimiste. */
  potion_vie_disponible?: boolean;
  potion_mort_disponible?: boolean;
  victime_provisoire_nuit_id?: UUID | null;
  /** Garde du Corps. */
  doit_tirer?: boolean;
  /** Créature de la Nuit : cibles nocturnes actuelles. */
  ma_cible_nuit_id?: UUID | null;
  cible_allie_nuit_id?: UUID | null;
}

/** État de la partie filtré pour l'humain. */
export interface EtatPartiePublic {
  id: UUID;
  statut: StatutPartie;
  phase_actuelle: PhasePartie;
  tour_actuel: number;
  camp_vainqueur: CampPartie | null;
  tokens_total_utilises: number;
  cout_estime_usd: number;
  joueurs: JoueurPublic[];
  messages: MessagePartie[];
  informations_role_humain: InformationsRoleHumain;
  ia_en_cours_ids?: UUID[];
}

// ─── Requêtes / Réponses API ────────────────────────────────────────────────

export interface CreerPartieRequete {
  hote_id?: UUID;
  nom_humain: string;
  consentement_ai_act: boolean;
  role_humain_force?: RolePersonnage | null;
}

export interface EnvoyerMessageRequete {
  joueur_id: UUID;
  contenu: string;
  canal: CanalMessage;
}

export interface VoterRequete {
  votant_id: UUID;
  cible_id: UUID;
  argumentation?: string | null;
}

export interface ActionSpecialeRequete {
  acteur_id: UUID;
  type_action: TypeActionJeu;
  cible_id?: UUID | null;
}

export interface SimulerTourReponse {
  phase_executee: PhasePartie;
  nouvelle_phase?: PhasePartie;
  evenements: string[];
  etat: EtatPartiePublic;
}

export interface ProfilComplet {
  profil: {
    id: UUID;
    nom_utilisateur: string;
    avatar_url: string;
    consentement_ai_act: boolean;
    cree_le: string;
  } | null;
  statistiques: {
    joueur_id: UUID;
    parties_jouees: number;
    parties_gagnees: number;
    parties_perdues: number;
    victoires_citoyens: number;
    victoires_creatures: number;
    temps_de_jeu_total_secondes: number;
  };
  succes: Array<{
    id: UUID;
    code: string;
    titre: string;
    description: string;
    icone_badge: string;
    points: number;
    debloque: boolean;
    debloque_le?: string | null;
  }>;
}

// ─── Messages WebSocket (`/ws/parties/{id}`) ────────────────────────────────

export type MessageServeurWS =
  | { type: "etat_partie"; donnees: EtatPartiePublic }
  | {
      type: "message_ia";
      message: MessagePartie;
      tokens_total_utilises: number;
      cout_estime_usd: number;
    }
  | { type: "erreur"; detail: string };

export type CommandeClientWS = { commande: "lancer_tour_debat_ia" } | { commande: "rafraichir_etat" };

