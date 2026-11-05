import { useEffect, useState, type CSSProperties } from "react";
import type { ArchetypeIA, JoueurPublic, RolePersonnage } from "../types/game";
import { iconeRole } from "../pixel/icones";
import { hacher } from "../pixel/moteur";

interface PropsImage {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}

export function ImagePixel({ src, alt, className = "", style }: PropsImage) {
  return <img src={src} alt={alt} draggable={false} className={`pixelise select-none ${className}`} style={style} />;
}

export type GenreJoueur = "masculin" | "femme";
export const CLE_AVATAR_JOUEUR = "studio_lanterne_avatar_joueur";

export function obtenirGenreJoueur(): GenreJoueur {
  if (typeof window === "undefined") return "masculin";
  return (localStorage.getItem(CLE_AVATAR_JOUEUR) as GenreJoueur) || "masculin";
}

export function definirGenreJoueur(genre: GenreJoueur): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLE_AVATAR_JOUEUR, genre);
}

const FEUILLES_ARCHETYPE: Record<ArchetypeIA, string> = {
  mauvais_joueur: "/sprites/gerard_sheet.png",
  stratege: "/sprites/elena_sheet.png",
  drole: "/sprites/bob_sheet.png",
  mystique: "/sprites/beatrice_sheet.png",
  paranoiaque: "/sprites/lucas_sheet.png",
};

const FEUILLES_MORT_ARCHETYPE: Record<ArchetypeIA, string> = {
  mauvais_joueur: "/sprites/gerard_mort_sheet.png",
  stratege: "/sprites/elena_mort_sheet.png",
  drole: "/sprites/bob_mort_sheet.png",
  mystique: "/sprites/beatrice_mort_sheet.png",
  paranoiaque: "/sprites/lucas_mort_sheet.png",
};

const FEUILLES_VICTOIRE_ARCHETYPE: Record<ArchetypeIA, string> = {
  mauvais_joueur: "/sprites/gerard_victory_sheet.png",
  stratege: "/sprites/elena_victory_sheet.png",
  drole: "/sprites/bob_victory_sheet.png",
  mystique: "/sprites/beatrice_victory_sheet.png",
  paranoiaque: "/sprites/lucas_victory_sheet.png",
};

const FEUILLES_EFFRAYE_ARCHETYPE: Record<ArchetypeIA, string> = {
  mauvais_joueur: "/sprites/gerard_afraid_sheet.png",
  stratege: "/sprites/elena_afraid_sheet.png",
  drole: "/sprites/bob_afraid_sheet.png",
  mystique: "/sprites/beatrice_afraid_sheet.png",
  paranoiaque: "/sprites/lucas_afraid_sheet.png",
};

export function obtenirFeuilleSprite(
  joueur: JoueurPublic,
  etat: boolean | "normal" | "mort" | "victoire" | "effraye" = "normal",
): string {
  const estMort = etat === true || etat === "mort";
  const estVictoire = etat === "victoire";
  const estEffraye = etat === "effraye";

  if (estMort) {
    if (joueur.est_humain) {
      const genre = obtenirGenreJoueur();
      return genre === "femme" ? "/sprites/joueurfemme_mort_sheet.png" : "/sprites/joueurmasculin_mort_sheet.png";
    }
    if (joueur.archetype && FEUILLES_MORT_ARCHETYPE[joueur.archetype]) {
      return FEUILLES_MORT_ARCHETYPE[joueur.archetype];
    }
    const nom = joueur.nom_affiche.toLowerCase();
    if (nom.includes("gérard") || nom.includes("gerard")) return "/sprites/gerard_mort_sheet.png";
    if (nom.includes("elena")) return "/sprites/elena_mort_sheet.png";
    if (nom.includes("bob")) return "/sprites/bob_mort_sheet.png";
    if (nom.includes("béatrice") || nom.includes("beatrice")) return "/sprites/beatrice_mort_sheet.png";
    if (nom.includes("lucas")) return "/sprites/lucas_mort_sheet.png";
    return "/sprites/joueur_mort_sheet.png";
  }

  if (estVictoire) {
    if (joueur.est_humain) {
      const genre = obtenirGenreJoueur();
      return genre === "femme" ? "/sprites/joueurfemme_victory_sheet.png" : "/sprites/joueurmasculin_victory_sheet.png";
    }
    if (joueur.archetype && FEUILLES_VICTOIRE_ARCHETYPE[joueur.archetype]) {
      return FEUILLES_VICTOIRE_ARCHETYPE[joueur.archetype];
    }
    const nom = joueur.nom_affiche.toLowerCase();
    if (nom.includes("gérard") || nom.includes("gerard")) return "/sprites/gerard_victory_sheet.png";
    if (nom.includes("elena")) return "/sprites/elena_victory_sheet.png";
    if (nom.includes("bob")) return "/sprites/bob_victory_sheet.png";
    if (nom.includes("béatrice") || nom.includes("beatrice")) return "/sprites/beatrice_victory_sheet.png";
    if (nom.includes("lucas")) return "/sprites/lucas_victory_sheet.png";
    return "/sprites/joueur_victory_sheet.png";
  }

  if (estEffraye) {
    if (joueur.est_humain) {
      const genre = obtenirGenreJoueur();
      return genre === "femme" ? "/sprites/joueurfemme_afraid_sheet.png" : "/sprites/joueurmasculin_afraid_sheet.png";
    }
    if (joueur.archetype && FEUILLES_EFFRAYE_ARCHETYPE[joueur.archetype]) {
      return FEUILLES_EFFRAYE_ARCHETYPE[joueur.archetype];
    }
    const nom = joueur.nom_affiche.toLowerCase();
    if (nom.includes("gérard") || nom.includes("gerard")) return "/sprites/gerard_afraid_sheet.png";
    if (nom.includes("elena")) return "/sprites/elena_afraid_sheet.png";
    if (nom.includes("bob")) return "/sprites/bob_afraid_sheet.png";
    if (nom.includes("béatrice") || nom.includes("beatrice")) return "/sprites/beatrice_afraid_sheet.png";
    if (nom.includes("lucas")) return "/sprites/lucas_afraid_sheet.png";
    return "/sprites/joueur_afraid_sheet.png";
  }

  if (joueur.est_humain) {
    const genre = obtenirGenreJoueur();
    return genre === "femme" ? "/sprites/joueurfemme_sheet.png" : "/sprites/joueurmasculin_sheet.png";
  }
  if (joueur.archetype && FEUILLES_ARCHETYPE[joueur.archetype]) {
    return FEUILLES_ARCHETYPE[joueur.archetype];
  }
  const nom = joueur.nom_affiche.toLowerCase();
  if (nom.includes("gérard") || nom.includes("gerard")) return "/sprites/gerard_sheet.png";
  if (nom.includes("elena")) return "/sprites/elena_sheet.png";
  if (nom.includes("bob")) return "/sprites/bob_sheet.png";
  if (nom.includes("béatrice") || nom.includes("beatrice")) return "/sprites/beatrice_sheet.png";
  if (nom.includes("lucas")) return "/sprites/lucas_sheet.png";
  return "/sprites/joueur_sheet.png";
}

interface PropsPersonnage {
  joueur: JoueurPublic;
  className?: string;
  /** Afficher le sprite de mort (corps à terre) si le joueur est mort. */
  mortSiMort?: boolean;
  /** Alias rétrocompatible. */
  tombeSiMort?: boolean;
  /** Mode portrait (cadré sur la tête/buste pour les miniatures de chat et liste). */
  portrait?: boolean;
  /** Animation de victoire (célébration des citoyens survivants). */
  victoire?: boolean;
  /** Animation d'effroi / défaite (quand les loups gagnent et qu'un citoyen survit). */
  effraye?: boolean;
  /** Remplacer le sprite par le loup-garou victorieux si le joueur est une créature. */
  loupSiCreature?: boolean;
}

/**
 * Sprite animé en 4 frames à partir des sprite sheets fournis (`*_sheet.png`, `*_mort_sheet.png`, `*_victory_sheet.png`, `*_afraid_sheet.png`).
 */
export function SpritePersonnage({
  joueur,
  className = "",
  mortSiMort = true,
  tombeSiMort,
  portrait = false,
  victoire = false,
  effraye = false,
  loupSiCreature = false,
}: PropsPersonnage) {
  const [frame, setFrame] = useState(() => hacher(joueur.id) % 4);

  const afficherMort = tombeSiMort !== undefined ? tombeSiMort : mortSiMort;
  const estMort = !joueur.est_vivant && afficherMort;
  const devientLoup = joueur.est_vivant && (loupSiCreature || (victoire && joueur.role === "creature")) && joueur.role === "creature";

  useEffect(() => {
    if (portrait || estMort) return;
    // Rythme d'animation : plus vif lors de la victoire ou effroi (380-480 ms) vs normal (520-660 ms)
    const base = victoire || effraye ? 400 : 520;
    const intervalle = base + (hacher(joueur.id) % (victoire || effraye ? 100 : 140));
    const t = window.setInterval(() => setFrame((f) => (f + 1) % 4), intervalle);
    return () => window.clearInterval(t);
  }, [joueur.id, estMort, portrait, victoire, effraye]);

  let feuille: string;
  if (estMort) {
    feuille = obtenirFeuilleSprite(joueur, "mort");
  } else if (devientLoup) {
    feuille = "/sprites/loup_sheet.png";
  } else if (victoire) {
    feuille = obtenirFeuilleSprite(joueur, "victoire");
  } else if (effraye) {
    feuille = obtenirFeuilleSprite(joueur, "effraye");
  } else {
    feuille = obtenirFeuilleSprite(joueur, "normal");
  }

  const posX = portrait || estMort ? "0%" : `${frame * 33.3333}%`;

  if (portrait) {
    return (
      <div
        role="img"
        aria-label={joueur.nom_affiche}
        className={`pixelise select-none overflow-hidden ${!joueur.est_vivant ? "opacity-75" : ""} ${className}`}
        style={{
          backgroundImage: `url(${feuille})`,
          backgroundSize: "440% auto",
          backgroundPosition: "4% 8%",
          backgroundRepeat: "no-repeat",
        }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={joueur.nom_affiche}
      className={`pixelise select-none ${className}`}
      style={{
        aspectRatio: "165 / 350",
        backgroundImage: `url(${feuille})`,
        backgroundSize: "400% 100%",
        backgroundPosition: `${posX} 0%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

export function LoupAnime({ className = "" }: { className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    // Animation cyclique du loup (debout, grondement, hurlement, rugissement)
    const t = window.setInterval(() => setFrame((f) => (f + 1) % 4), 500);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div
      role="img"
      aria-label="Loup-garou victorieux"
      className={`pixelise select-none ${className}`}
      style={{
        aspectRatio: "165 / 350",
        backgroundImage: "url(/sprites/loup_sheet.png)",
        backgroundSize: "400% 100%",
        backgroundPosition: `${frame * 33.3333}% 0%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

export function IconeRole({ role, className = "" }: { role: RolePersonnage | null; className?: string }) {
  return <ImagePixel src={iconeRole(role)} alt={role ?? "rôle inconnu"} className={className} />;
}
