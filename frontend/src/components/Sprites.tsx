import { useEffect, useState, type CSSProperties } from "react";
import type { ArchetypeIA, JoueurPublic, RolePersonnage } from "../types/game";
import { spriteTombeRpg } from "../pixel/personnages";
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

const FEUILLES_ARCHETYPE: Record<ArchetypeIA, string> = {
  mauvais_joueur: "/sprites/gerard_sheet.png",
  stratege: "/sprites/elena_sheet.png",
  drole: "/sprites/bob_sheet.png",
  mystique: "/sprites/beatrice_sheet.png",
  paranoiaque: "/sprites/lucas_sheet.png",
};

function obtenirFeuilleSprite(joueur: JoueurPublic): string {
  if (joueur.est_humain) return "/sprites/joueur_sheet.png";
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
  /** Afficher une pierre tombale si le joueur est mort. */
  tombeSiMort?: boolean;
  /** Mode portrait (cadré sur la tête/buste pour les miniatures de chat et liste). */
  portrait?: boolean;
}

/**
 * Sprite animé en 4 frames à partir des sprite sheets fournis (`*_sheet.png`).
 */
export function SpritePersonnage({
  joueur,
  className = "",
  tombeSiMort = true,
  portrait = false,
}: PropsPersonnage) {
  const [frame, setFrame] = useState(() => hacher(joueur.id) % 4);

  useEffect(() => {
    if (!joueur.est_vivant || portrait) return;
    // Rythme d'animation doux et désynchronisé entre chaque personnage (520 à 660 ms)
    const intervalle = 520 + (hacher(joueur.id) % 140);
    const t = window.setInterval(() => setFrame((f) => (f + 1) % 4), intervalle);
    return () => window.clearInterval(t);
  }, [joueur.est_vivant, joueur.id, portrait]);

  if (!joueur.est_vivant && tombeSiMort) {
    return <ImagePixel src={spriteTombeRpg()} alt={joueur.nom_affiche} className={className} />;
  }

  const feuille = obtenirFeuilleSprite(joueur);
  const posX = portrait ? "0%" : `${frame * 33.3333}%`;

  if (portrait) {
    return (
      <div
        role="img"
        aria-label={joueur.nom_affiche}
        className={`pixelise select-none overflow-hidden ${!joueur.est_vivant ? "grayscale opacity-65" : ""} ${className}`}
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
      className={`pixelise select-none ${!joueur.est_vivant ? "grayscale opacity-60" : ""} ${className}`}
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

export function IconeRole({ role, className = "" }: { role: RolePersonnage | null; className?: string }) {
  return <ImagePixel src={iconeRole(role)} alt={role ?? "rôle inconnu"} className={className} />;
}
