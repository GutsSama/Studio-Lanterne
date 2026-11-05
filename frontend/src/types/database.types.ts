/**
 * Types TypeScript strictement alignés sur le schéma SQL de `FRONTEND.md` et `REGLELOUPGAROU.md`.
 * Rôles strictement limités à : 'citoyen' | 'creature' | 'inquisiteur' | 'alchimiste' | 'garde_du_corps'.
 */

export type StatutPartie =
  | 'en_attente'
  | 'en_cours'
  | 'terminee'
  | 'abandonnee';

export type PhasePartie =
  | 'nuit'
  | 'debat_jour'
  | 'vote_jour'
  | 'tour_garde_du_corps'
  | 'tour_alchimiste'
  | 'terminee';

export type RolePersonnage =
  | 'citoyen'
  | 'creature'
  | 'inquisiteur'
  | 'alchimiste'
  | 'garde_du_corps';

export type CampPartie = 'citoyens' | 'creatures' | 'solo' | 'egalite';

export type CanalMessage =
  | 'village_public'
  | 'creature_secret'
  | 'chat_morts'
  | 'systeme';

export type TypeActionJeu =
  | 'inquisiteur_inspecter'
  | 'alchimiste_soigner'
  | 'alchimiste_empoisonner'
  | 'garde_du_corps_tirer';

export interface PartieRow {
  id: string;
  statut: StatutPartie;
  phase_actuelle: PhasePartie;
  tour_actuel: number;
  camp_vainqueur?: CampPartie | null;
  tokens_total_utilises?: number;
  cout_estime_usd?: number;
}

export interface JoueurPartie {
  id: string;
  partie_id?: string;
  nom_affiche: string;
  avatar_url: string;
  est_humain: boolean;
  est_vivant: boolean;
  sexe?: 'homme' | 'femme';
  numero_siege: number;
  role: RolePersonnage | null;
  cause_mort: string | null;
  potion_vie_utilisee?: boolean;
  potion_mort_utilisee?: boolean;
}

export interface MessagePartie {
  id: string;
  partie_id: string;
  joueur_emetteur_id: string | null;
  nom_emetteur: string | null;
  canal: CanalMessage;
  tour: number;
  phase: PhasePartie;
  contenu: string;
  est_ia: boolean;
  tokens_utilises: number;
  cree_le: string;
}

export interface ActionPartieRow {
  id: string;
  partie_id: string;
  tour: number;
  joueur_acteur_id: string;
  type_action: TypeActionJeu;
  joueur_cible_id: string | null;
  details_resultat: Record<string, unknown>;
}

export interface EtatPartieClient {
  id: string;
  statut: StatutPartie;
  phase_actuelle: PhasePartie;
  tour_actuel: number;
  camp_vainqueur: CampPartie | null;
  tokens_total_utilises: number;
  cout_estime_usd: number;
  joueurs: JoueurPartie[];
  messages: MessagePartie[];
}

export interface PersonnaliteIA {
  id: string;
  nom: string;
  archetype: string;
  avatar_url: string;
  prompt_systeme: string;
  modele_par_defaut: string;
  temperature: number;
}

export interface ReponseSimulationTour {
  partie_id: string;
  ancienne_phase: PhasePartie;
  nouvelle_phase: PhasePartie;
  tour_actuel: number;
  evenements: string[];
  camp_vainqueur: CampPartie | null;
  etat: EtatPartieClient;
}

/**
 * Sprites PNG transparents Haute Définition fournis dans `/public/sprites/`.
 */
export const SPRITES_PERSONNAGES: Record<string, string> = {
  humain: '/sprites/humain.png',
  humaine: '/sprites/humaine.png',
  gerard: '/sprites/gerard.png',
  elena: '/sprites/elena.png',
  bob: '/sprites/bob.png',
  beatrice: '/sprites/beatrice.png',
  lucas: '/sprites/lucas.png',
};

const LISTE_SPRITES = [
  SPRITES_PERSONNAGES.humain,
  SPRITES_PERSONNAGES.gerard,
  SPRITES_PERSONNAGES.elena,
  SPRITES_PERSONNAGES.bob,
  SPRITES_PERSONNAGES.beatrice,
  SPRITES_PERSONNAGES.lucas,
];

export function resoudreAvatarHumain(joueur: {
  nom_affiche?: string | null;
  avatar_url?: string | null;
  est_humain?: boolean;
  sexe?: 'homme' | 'femme';
  numero_siege?: number;
}): string {
  const nom = (joueur.nom_affiche || '').toLowerCase();
  if (joueur.est_humain) {
    if (
      joueur.sexe === 'femme' ||
      joueur.avatar_url?.includes('humaine') ||
      joueur.avatar_url?.includes('femme')
    ) {
      return SPRITES_PERSONNAGES.humaine;
    }
    return SPRITES_PERSONNAGES.humain;
  }
  if (nom.includes('gérard') || nom.includes('gerard'))
    return SPRITES_PERSONNAGES.gerard;
  if (nom.includes('elena')) return SPRITES_PERSONNAGES.elena;
  if (nom.includes('bob')) return SPRITES_PERSONNAGES.bob;
  if (nom.includes('béatrice') || nom.includes('beatrice'))
    return SPRITES_PERSONNAGES.beatrice;
  if (nom.includes('lucas')) return SPRITES_PERSONNAGES.lucas;

  const idx = ((joueur.numero_siege ?? 1) - 1) % LISTE_SPRITES.length;
  return LISTE_SPRITES[idx];
}
