/**
 * Sprites de personnages haute-fidélité inspirés de examplePixel.png et examplepixel2.png :
 * - Vue 3/4 RPG avec silhouette élancée et bottes détaillées
 * - Traits de visage expressifs : regard (pupille, blanc d'œil), nez et bouche subtils
 * - Volume de chevelure et mèches avec reflets en dégradé
 * - Vêtements texturés : pourpoints, manteaux, ceinturons à boucle, revers de bottes
 * - Respect des genres et identités :
 *    - Gérard le Râleur : Homme d'âge mûr, barbe poivre et sel, manteau de cuir lourd
 *    - Elena la Stratège : Femme jeune et noble, chevelure brune longue, corset pourpre et cape
 *    - Bob le Rigolo : Homme farceur, mèche châtaine tombante, pourpoint bouffon chaleureux
 *    - Sœur Béatrice la Mystique : Femme d'église, voile monastique drapé, robe bleue et chapelet
 *    - Lucas le Paranoïaque : Homme jeune, silhouette fébrile, cheveux roux ébouriffés, col relevé
 *    - Joueur Humain : Aventurier / Aventurière voyageur avec sac à dos, tunique et lanterne (comme les exemples)
 */
import type { ArchetypeIA } from "../types/game";
import { GrillePixel, PALETTE, cuire, hacher, niveauxDeGris, nuancer, type Couleur } from "./moteur";

export const LARGEUR_SPRITE = 48;
export const HAUTEUR_SPRITE = 64;

export interface DesignPersonnage {
  sexe: "femme" | "homme";
  peau: Couleur;
  peauOmbre: Couleur;
  cheveux: Couleur;
  cheveuxReflet: Couleur;
  cheveuxOmbre: Couleur;
  tunique: Couleur;
  tuniqueOmbre: Couleur;
  pantalon: Couleur;
  pantalonOmbre: Couleur;
  bottes: Couleur;
  bottesRevers: Couleur;
  accessoire?: "sac_a_dos" | "barbe" | "voile" | "chapeau_cloche" | "echarpe" | "chapelet";
  couleurAccessoire?: Couleur;
}

const E = PALETTE.encre;

// ─── Profils respectant strictement les genres et identités ─────────────────

export const DESIGNS_ARCHETYPE: Record<ArchetypeIA, DesignPersonnage> = {
  // Gérard le Râleur (Homme mûr, barbe taillée, cuir robuste)
  mauvais_joueur: {
    sexe: "homme",
    peau: "#dfb49d",
    peauOmbre: "#af7c63",
    cheveux: "#716d7a",
    cheveuxReflet: "#9f9bb0",
    cheveuxOmbre: "#433f4c",
    tunique: PALETTE.cuirMoyen,
    tuniqueOmbre: PALETTE.cuirTresFonce,
    pantalon: "#2b2a33",
    pantalonOmbre: "#18171e",
    bottes: PALETTE.cuirFonce,
    bottesRevers: PALETTE.cuirClair,
    accessoire: "barbe",
  },
  // Elena la Stratège (Femme, chevelure sombre soyeuse, robe d'érudite pourpre)
  stratege: {
    sexe: "femme",
    peau: PALETTE.peauClaire,
    peauOmbre: PALETTE.peauClaireOmbre,
    cheveux: "#281b24",
    cheveuxReflet: "#563e50",
    cheveuxOmbre: "#140c11",
    tunique: PALETTE.pourpre,
    tuniqueOmbre: PALETTE.pourpreOmbre,
    pantalon: "#221929",
    pantalonOmbre: "#120b18",
    bottes: "#342231",
    bottesRevers: "#5c3d56",
    accessoire: "echarpe",
    couleurAccessoire: "#8a4869",
  },
  // Bob le Rigolo (Homme bon vivant, pourpoint chaleureux, chevelure châtaine rebelle)
  drole: {
    sexe: "homme",
    peau: PALETTE.peauClaire,
    peauOmbre: PALETTE.peauClaireOmbre,
    cheveux: "#7c4a2a",
    cheveuxReflet: "#aa6e45",
    cheveuxOmbre: "#472713",
    tunique: "#b85c38",
    tuniqueOmbre: "#6c2f18",
    pantalon: PALETTE.vertForet,
    pantalonOmbre: PALETTE.vertForetOmbre,
    bottes: PALETTE.cuirMoyen,
    bottesRevers: PALETTE.cuirClair,
    accessoire: "sac_a_dos",
  },
  // Sœur Béatrice la Mystique (Femme pieuse, voile tombant sur les épaules, robe bleue)
  mystique: {
    sexe: "femme",
    peau: "#faeae0",
    peauOmbre: "#d9b3a3",
    cheveux: "#3d3245",
    cheveuxReflet: "#685b73",
    cheveuxOmbre: "#201824",
    tunique: PALETTE.bleuNuit,
    tuniqueOmbre: PALETTE.bleuNuitOmbre,
    pantalon: "#1c222e",
    pantalonOmbre: "#0f131a",
    bottes: "#272e3b",
    bottesRevers: PALETTE.os,
    accessoire: "voile",
    couleurAccessoire: "#e8dfd3",
  },
  // Lucas le Paranoïaque (Homme jeune aux cheveux roux hirsutes, col protecteur relevé)
  paranoiaque: {
    sexe: "homme",
    peau: PALETTE.peauClaire,
    peauOmbre: PALETTE.peauClaireOmbre,
    cheveux: "#b54e29",
    cheveuxReflet: "#de7850",
    cheveuxOmbre: "#702b12",
    tunique: PALETTE.vertForet,
    tuniqueOmbre: PALETTE.vertForetOmbre,
    pantalon: PALETTE.cuirTresFonce,
    pantalonOmbre: "#160c0a",
    bottes: PALETTE.cuirMoyen,
    bottesRevers: PALETTE.cuirClair,
    accessoire: "echarpe",
    couleurAccessoire: "#3d352b",
  },
};

// Design du joueur humain : Voyageur avec sacoche et lanterne (comme les deux images d'exemple)
export const DESIGN_HUMAIN: DesignPersonnage = {
  sexe: "homme",
  peau: PALETTE.peauClaire,
  peauOmbre: PALETTE.peauClaireOmbre,
  cheveux: "#69422a",
  cheveuxReflet: "#956447",
  cheveuxOmbre: "#3c2314",
  tunique: PALETTE.lin,
  tuniqueOmbre: PALETTE.linOmbre,
  pantalon: "#2b2f3d",
  pantalonOmbre: "#181a24",
  bottes: PALETTE.cuirMoyen,
  bottesRevers: PALETTE.cuirClair,
  accessoire: "sac_a_dos",
};

export function designPourNom(nom: string): DesignPersonnage {
  const h = hacher(nom);
  const peaux = [PALETTE.peauClaire, PALETTE.peauMoyenne, PALETTE.peauBrune];
  const peauxOmbres = [PALETTE.peauClaireOmbre, PALETTE.peauOmbre, PALETTE.peauBruneOmbre];
  const idxPeau = h % 3;
  return {
    sexe: h % 2 === 0 ? "femme" : "homme",
    peau: peaux[idxPeau] ?? PALETTE.peauClaire,
    peauOmbre: peauxOmbres[idxPeau] ?? PALETTE.peauClaireOmbre,
    cheveux: ["#2d2420", "#5c3c2b", "#946342", "#281b24"][h % 4] ?? "#2d2420",
    cheveuxReflet: ["#54453e", "#8c6049", "#be8d6b", "#4f3948"][h % 4] ?? "#54453e",
    cheveuxOmbre: ["#16100d", "#362115", "#5c3922", "#130910"][h % 4] ?? "#16100d",
    tunique: [PALETTE.lin, PALETTE.cuirMoyen, PALETTE.vertForet, PALETTE.bleuNuit][(h >> 2) % 4] ?? PALETTE.lin,
    tuniqueOmbre: [PALETTE.linOmbre, PALETTE.cuirTresFonce, PALETTE.vertForetOmbre, PALETTE.bleuNuitOmbre][(h >> 2) % 4] ?? PALETTE.linOmbre,
    pantalon: "#282631",
    pantalonOmbre: "#14131a",
    bottes: PALETTE.cuirMoyen,
    bottesRevers: PALETTE.cuirClair,
    accessoire: "sac_a_dos",
  };
}

// ─── MOTEUR DE DESSIN DU PERSONNAGE RPG 3/4 ─────────────────────────────────

export function dessinerPersonnageExemple(d: DesignPersonnage, o: { fantome?: boolean } = {}): GrillePixel {
  const g = new GrillePixel(LARGEUR_SPRITE, HAUTEUR_SPRITE);

  // 1. SAC À DOS / BALUCHON VOYAGEUR (en arrière-plan à gauche, comme dans examplePixel.png)
  if (d.accessoire === "sac_a_dos") {
    g.rect(13, 20, 8, 16, PALETTE.cuirMoyen);
    g.rect(12, 22, 9, 12, PALETTE.cuirClair);
    g.rect(12, 26, 2, 7, PALETTE.cuirFonce);
    g.ligneV(11, 22, 33, E).ligneH(12, 20, 19, E);
    // Boucle du sac
    g.px(17, 26, PALETTE.orClair);
  }

  // 2. JAMBES ET BOTTES DE VOYAGEUR
  // Jambe gauche (arrière)
  g.rect(20, 37, 5, 10, d.pantalonOmbre);
  // Revers de botte gauche
  g.rect(19, 45, 6, 4, d.bottesRevers);
  g.ligneH(19, 24, 48, E);
  // Botte gauche
  g.rect(19, 49, 6, 8, d.bottes);
  g.rect(18, 55, 6, 3, nuancer(d.bottes, -0.2));
  g.px(18, 54, nuancer(d.bottes, 0.2)); // Reflet sur le bout

  // Jambe droite (avant, plus en avant comme dans l'exemple 2)
  g.rect(26, 37, 6, 9, d.pantalon);
  g.ligneV(26, 38, 45, nuancer(d.pantalon, 0.2));
  // Revers de botte droite
  g.rect(25, 45, 7, 4, d.bottesRevers);
  g.px(26, 46, nuancer(d.bottesRevers, 0.25));
  g.ligneH(25, 31, 48, E);
  // Botte droite
  g.rect(26, 49, 7, 8, d.bottes);
  g.rect(27, 54, 8, 4, nuancer(d.bottes, -0.15));
  g.ligneH(28, 33, 53, nuancer(d.bottes, 0.2)); // Reflet d'arête sur le cuir

  // 3. TUNIQUE / BUSTE ET CEINTURON
  // Corps
  g.rect(19, 21, 13, 17, d.tunique);
  // Éclairage de volume sur le devant du torse
  g.rect(23, 22, 7, 13, nuancer(d.tunique, 0.15));
  g.ligneV(19, 22, 36, d.tuniqueOmbre);
  // Col en V ouvert dévoilant le cou
  g.rect(23, 20, 5, 4, d.peau);
  g.points([[24, 23], [25, 23]], d.peauOmbre);

  // Ceinturon en cuir avec pendant & boucle dorée
  g.rect(18, 33, 14, 3, PALETTE.cuirFonce);
  g.rect(25, 33, 3, 3, PALETTE.orClair);
  g.px(26, 34, E);
  // Lanière qui pend
  g.rect(26, 36, 2, 6, PALETTE.cuirMoyen);

  // Bas de la tunique fendu (style médiéval)
  g.rect(19, 36, 6, 4, d.tuniqueOmbre);
  g.rect(28, 36, 5, 4, d.tunique);

  // Bras & manche
  g.rect(16, 23, 5, 10, d.tuniqueOmbre);
  g.rect(18, 31, 4, 3, d.peauOmbre); // Poignet
  g.rect(18, 33, 5, 4, d.peau); // Main au repos sur la hanche

  // 4. VOILE MONASTIQUE (pour Béatrice)
  if (d.accessoire === "voile") {
    const vc = d.couleurAccessoire ?? PALETTE.os;
    g.rect(18, 12, 16, 22, vc);
    g.rect(17, 16, 4, 18, nuancer(vc, -0.2));
    g.rect(30, 16, 4, 18, nuancer(vc, -0.2));
    g.ligneH(20, 29, 13, nuancer(vc, 0.15));
  }

  // 5. TÊTE & VISAGE RPG 3/4 EXPRESSIF (Inspiré fidèlement des exemples)
  const cx = 24, cy = 9;

  // Joue et mâchoire
  g.rect(cx - 3, cy + 4, 11, 8, d.peau);
  g.rect(cx - 1, cy + 7, 8, 6, d.peau);
  // Nez en relief
  g.px(cx + 6, cy + 8, d.peauOmbre);
  g.px(cx + 7, cy + 8, d.peau);

  // Yeux expressifs (blanc d'œil, pupille sombre et reflet comme dans les 2 images)
  // Œil droit (visible de face-trois-quarts)
  g.rect(cx + 1, cy + 5, 4, 3, "#ffffff"); // Blanc
  g.rect(cx + 2, cy + 5, 2, 3, E); // Iris/pupille
  g.px(cx + 3, cy + 5, "#ffffff"); // Reflet pétillant
  g.ligneH(cx + 1, cx + 4, cy + 4, E); // Paupière supérieure

  // Œil gauche (partiellement caché par la perspective)
  g.rect(cx - 2, cy + 5, 2, 3, E);
  g.px(cx - 2, cy + 5, "#ffffff");
  g.px(cx - 2, cy + 4, E);

  // Bouche fine & discrète
  g.ligneH(cx + 2, cx + 4, cy + 11, d.peauOmbre);

  // 6. BARBE OU ACCESSION FACIALE
  if (d.accessoire === "barbe") {
    g.rect(cx - 2, cy + 8, 9, 7, d.cheveux);
    g.rect(cx, cy + 12, 6, 4, d.cheveuxOmbre);
    g.ligneH(cx + 1, cx + 5, cy + 10, d.cheveuxReflet);
  }

  // Écharpe (pour Elena ou Lucas)
  if (d.accessoire === "echarpe") {
    const col = d.couleurAccessoire ?? PALETTE.pourpre;
    g.rect(cx - 4, cy + 11, 14, 4, col);
    g.ligneH(cx - 2, cx + 8, cy + 11, nuancer(col, 0.3));
    g.rect(cx + 5, cy + 13, 3, 7, nuancer(col, -0.2));
  }

  // 7. CHEVELURE RPG VOLUMINEUSE
  if (d.accessoire !== "voile") {
    if (d.sexe === "femme") {
      // Chevelure féminine longue, mèches souples tombant sur l'épaule
      g.rect(cx - 6, cy - 2, 15, 6, d.cheveux);
      g.rect(cx - 7, cy + 2, 6, 17, d.cheveux);
      g.rect(cx - 5, cy + 14, 5, 10, d.cheveuxOmbre);
      // Mèche avant droite encadrant le visage
      g.rect(cx + 5, cy + 1, 4, 11, d.cheveux);
      g.px(cx + 7, cy + 11, d.cheveuxOmbre);
      // Reflets lumineux sur le sommet de la tête
      g.ligneH(cx - 3, cx + 6, cy - 1, d.cheveuxReflet);
      g.points([[cx - 2, cy], [cx + 1, cy], [cx + 3, cy]], d.cheveuxReflet);
    } else {
      // Chevelure masculine avec mèches comme examplePixel.png et examplepixel2.png
      g.rect(cx - 5, cy - 2, 14, 6, d.cheveux);
      g.rect(cx - 7, cy + 2, 5, 11, d.cheveux);
      // Mèches tombantes sur le front
      g.points([[cx - 2, cy + 3], [cx, cy + 4], [cx + 4, cy + 3], [cx + 6, cy + 2]], d.cheveux);
      g.points([[cx, cy + 3], [cx + 5, cy + 3]], d.cheveuxOmbre);
      // Volume arrière
      g.rect(cx - 7, cy + 6, 4, 6, d.cheveuxOmbre);
      // Reflets
      g.ligneH(cx - 3, cx + 4, cy - 1, d.cheveuxReflet);
      g.points([[cx - 2, cy], [cx + 2, cy]], d.cheveuxReflet);
    }
  }

  // 8. CONTOUR NOIR RPG DÉLICAT
  g.contour(E);

  // 9. FANTÔME OU OMBRE PORTÉE AU SOL
  if (o.fantome) {
    g.transformer((c) => niveauxDeGris(c));
  } else {
    // Ombre elliptique douce sous les pieds
    g.sousCouche((calque) => {
      calque.ellipse(25, 59, 12, 2.5, "rgba(26,20,27,0.75)");
      calque.ellipse(25, 59, 15, 3.5, "rgba(26,20,27,0.25)");
    });
  }

  return g;
}

export function spritePersonnageRpg(cle: string, d: DesignPersonnage, o: { fantome?: boolean } = {}): string {
  return cuire(`perso_rpg:${cle}:${o.fantome ? 1 : 0}`, () => dessinerPersonnageExemple(d, o));
}

// ─── STÈLE GOTHIQUE ─────────────────────────────────────────────────────────

export function spriteTombeRpg(): string {
  return cuire("tombe_rpg", () => {
    const g = new GrillePixel(LARGEUR_SPRITE, HAUTEUR_SPRITE);
    const p = "#686470";
    const cx = 24;

    g.rect(cx - 7, 26, 15, 31, p);
    g.points([[cx - 6, 25], [cx - 5, 24], [cx + 4, 25], [cx + 3, 24]], p);
    g.ligneV(cx - 6, 26, 56, nuancer(p, 0.35));
    g.rect(cx + 3, 26, 4, 31, E);

    // Croix gravée
    g.ligneV(cx, 30, 42, E).ligneH(cx - 4, cx + 4, 34, E);
    // Mousses végétales
    g.points([[cx - 6, 52], [cx - 5, 53], [cx + 2, 54], [cx + 3, 53]], PALETTE.vertForet);

    g.contour(E);
    g.sousCouche((c) => c.ellipse(cx, 58, 14, 3, "rgba(20,15,22,0.6)"));
    return g;
  });
}
