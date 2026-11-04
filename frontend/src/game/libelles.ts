import type { CampPartie, JoueurPublic, PhasePartie, RolePersonnage } from "../types/game";
import { APPARENCES_ARCHETYPE, APPARENCE_HUMAIN, apparencePourNom, type ApparencePersonnage } from "../pixel/personnages";

export const LIBELLES_ROLE: Record<RolePersonnage, { nom: string; description: string }> = {
  citoyen: { nom: "Citoyen", description: "Aucun pouvoir nocturne. Démasque les Créatures par la logique." },
  creature: { nom: "Créature de la Nuit", description: "Chaque nuit, dévore un Citoyen avec ton alliée Créature." },
  inquisiteur: { nom: "Inquisiteur", description: "Chaque nuit, inspecte un joueur et découvre son camp." },
  alchimiste: { nom: "Alchimiste", description: "Une potion de Vie pour sauver, une potion de Mort pour punir." },
  garde_du_corps: { nom: "Garde du Corps", description: "En tombant, tu emportes un joueur de ton choix." },
};

export const LIBELLES_PHASE: Record<PhasePartie, string> = {
  nuit: "La nuit tombe",
  tour_alchimiste: "L'Alchimiste s'éveille",
  debat_jour: "Débat du village",
  vote_jour: "Vote du Conseil",
  tour_garde_du_corps: "Dernier souffle",
  terminee: "Fin de partie",
};

export const LIBELLES_CAMP: Record<CampPartie, string> = {
  citoyens: "Les Citoyens triomphent !",
  creatures: "Les Créatures dévorent le village !",
  solo: "Victoire solitaire !",
  egalite: "Personne ne survit...",
};

export const LIBELLES_CAUSE_MORT: Record<string, string> = {
  attaque_creatures: "dévoré",
  vote_conseil: "exécuté",
  potion_mort_alchimiste: "empoisonné",
  tir_garde_du_corps: "abattu",
};

export function estPhaseNocturne(phase: PhasePartie): boolean {
  return phase === "nuit" || phase === "tour_alchimiste";
}

export function apparenceJoueur(j: JoueurPublic): ApparencePersonnage {
  if (j.est_humain) return APPARENCE_HUMAIN;
  if (j.archetype) return APPARENCES_ARCHETYPE[j.archetype];
  return apparencePourNom(j.nom_affiche);
}

/** « Gérard le Râleur » → « Gérard ». */
export function prenom(nom: string): string {
  const mots = nom.split(" ");
  if (mots[0] === "Sœur" && mots[1]) return `Sr ${mots[1]}`;
  return mots[0] ?? nom;
}

export function fournisseur(modele: string | null): string | null {
  if (!modele) return null;
  const p = modele.split("/")[0] ?? "";
  return { groq: "Groq", mistral: "Mistral", gemini: "Gemini" }[p] ?? p;
}
