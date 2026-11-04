import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { JoueurPublic, RolePersonnage } from "../types/game";
import { apparenceJoueur } from "../game/libelles";
import { spritePersonnage, spriteTombe } from "../pixel/personnages";
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

interface PropsPersonnage {
  joueur: JoueurPublic;
  className?: string;
  /** Afficher une pierre tombale si le joueur est mort. */
  tombeSiMort?: boolean;
}

/** Sprite 32×32 d'un joueur, avec clignement des yeux aléatoire. */
export function SpritePersonnage({ joueur, className = "", tombeSiMort = true }: PropsPersonnage) {
  const apparence = apparenceJoueur(joueur);
  const cle = joueur.est_humain ? "humain" : (joueur.archetype ?? joueur.nom_affiche);
  const [yeuxFermes, setYeuxFermes] = useState(false);

  useEffect(() => {
    if (!joueur.est_vivant) return;
    let t: number;
    const programmer = () => {
      t = window.setTimeout(
        () => {
          setYeuxFermes(true);
          t = window.setTimeout(() => {
            setYeuxFermes(false);
            programmer();
          }, 140);
        },
        2500 + Math.random() * 4000,
      );
    };
    programmer();
    return () => window.clearTimeout(t);
  }, [joueur.est_vivant]);

  const src = useMemo(() => {
    if (!joueur.est_vivant && tombeSiMort) return spriteTombe();
    return spritePersonnage(cle, apparence, { yeuxFermes, fantome: !joueur.est_vivant });
  }, [apparence, cle, joueur.est_vivant, tombeSiMort, yeuxFermes]);

  // Décalage d'animation propre à chaque joueur pour éviter un balancement synchronisé
  const delai = `-${(hacher(joueur.id) % 2400) / 1000}s`;

  return (
    <ImagePixel
      src={src}
      alt={joueur.nom_affiche}
      className={`${joueur.est_vivant ? "animate-flotter" : ""} ${className}`}
      style={{ animationDelay: delai }}
    />
  );
}

export function IconeRole({ role, className = "" }: { role: RolePersonnage | null; className?: string }) {
  return <ImagePixel src={iconeRole(role)} alt={role ?? "rôle inconnu"} className={className} />;
}

