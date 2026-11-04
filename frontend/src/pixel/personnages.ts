/**
 * Générateur de personnages chibi 32×32 en couches.
 * Chaque personnalité IA (par archétype) et le joueur humain ont une apparence fixe.
 */
import type { ArchetypeIA } from "../types/game";
import { GrillePixel, PALETTE, cuire, hacher, niveauxDeGris, nuancer, type Couleur } from "./moteur";

export type Coiffure = "courte" | "longue" | "chauve" | "herissee" | "chignon" | "aucune";
export type Accessoire = "barbe" | "lunettes" | "bouffon" | "voile" | "capuche" | "lanterne" | "chapeau_alu";
export type Humeur = "grognon" | "neutre" | "sourire" | "serein" | "inquiet";

export interface ApparencePersonnage {
  peau: Couleur;
  cheveux: Couleur;
  coiffure: Coiffure;
  tunique: Couleur;
  pantalon: Couleur;
  bottes: Couleur;
  humeur: Humeur;
  accessoires: Accessoire[];
  /** Couleur du voile / de la capuche. */
  tissu?: Couleur;
}

const E = PALETTE.encre;

// ─── Apparences de référence ────────────────────────────────────────────────

export const APPARENCES_ARCHETYPE: Record<ArchetypeIA, ApparencePersonnage> = {
  // Gérard le Râleur
  mauvais_joueur: {
    peau: "#e0a47a",
    cheveux: "#8a8a9a",
    coiffure: "chauve",
    tunique: "#8a3b2a",
    pantalon: "#4a3a2a",
    bottes: "#2e2018",
    humeur: "grognon",
    accessoires: ["barbe"],
  },
  // Elena la Stratège
  stratege: {
    peau: "#f0c8a0",
    cheveux: "#2b1d3a",
    coiffure: "longue",
    tunique: "#5b3f8c",
    pantalon: "#2a2350",
    bottes: "#1b1630",
    humeur: "neutre",
    accessoires: ["lunettes"],
  },
  // Bob le Rigolo
  drole: {
    peau: "#d89a6a",
    cheveux: "#6a3a1a",
    coiffure: "aucune",
    tunique: "#e07a2c",
    pantalon: "#3b6a3a",
    bottes: "#3a2418",
    humeur: "sourire",
    accessoires: ["bouffon"],
  },
  // Sœur Béatrice la Mystique
  mystique: {
    peau: "#f4dcc4",
    cheveux: "#2a2350",
    coiffure: "aucune",
    tunique: "#3b3a7a",
    pantalon: "#2a2350",
    bottes: "#1b1630",
    humeur: "serein",
    accessoires: ["voile"],
    tissu: "#24203f",
  },
  // Lucas le Paranoïaque
  paranoiaque: {
    peau: "#e8b890",
    cheveux: "#c96b2c",
    coiffure: "herissee",
    tunique: "#4a7a3a",
    pantalon: "#5a4a3a",
    bottes: "#2e2018",
    humeur: "inquiet",
    accessoires: ["chapeau_alu"],
  },
};

export const APPARENCE_HUMAIN: ApparencePersonnage = {
  peau: "#f0c090",
  cheveux: "#5a3218",
  coiffure: "courte",
  tunique: "#2f5aa8",
  pantalon: "#3a2e48",
  bottes: "#2a1a14",
  humeur: "neutre",
  accessoires: ["capuche", "lanterne"],
  tissu: "#7a2a3a",
};

/** Apparence de secours pour une personnalité inconnue (déterministe selon le nom). */
export function apparencePourNom(nom: string): ApparencePersonnage {
  const h = hacher(nom);
  const tuniques = ["#8a3b2a", "#2f7a6a", "#7a5a2a", "#5a3a7a", "#3a5a8a"];
  const cheveux = ["#2b1d1a", "#c96b2c", "#e8c860", "#6a3a1a", "#8a8a9a"];
  const coiffures: Coiffure[] = ["courte", "longue", "herissee", "chignon"];
  const humeurs: Humeur[] = ["neutre", "sourire", "grognon", "serein"];
  return {
    peau: ["#f0c8a0", "#e0a47a", "#c88a5a", "#8a5a3a"][h % 4] ?? "#f0c8a0",
    cheveux: cheveux[(h >> 3) % cheveux.length] ?? "#2b1d1a",
    coiffure: coiffures[(h >> 6) % coiffures.length] ?? "courte",
    tunique: tuniques[(h >> 9) % tuniques.length] ?? "#8a3b2a",
    pantalon: "#3a2e48",
    bottes: "#2a1a14",
    humeur: humeurs[(h >> 12) % humeurs.length] ?? "neutre",
    accessoires: [],
  };
}

// ─── Dessin ─────────────────────────────────────────────────────────────────

interface OptionsDessin {
  yeuxFermes?: boolean;
  fantome?: boolean;
}

function dessinerCorps(g: GrillePixel, a: ApparencePersonnage): void {
  const tuniqueOmbre = nuancer(a.tunique, -0.3);
  const tuniqueLumiere = nuancer(a.tunique, 0.18);

  // Jambes + bottes
  g.rect(12, 26, 3, 3, a.pantalon).rect(17, 26, 3, 3, nuancer(a.pantalon, -0.2));
  g.rect(11, 28, 4, 2, a.bottes).rect(17, 28, 4, 2, a.bottes);
  g.px(11, 28, nuancer(a.bottes, 0.25)).px(17, 28, nuancer(a.bottes, 0.25));

  // Torse
  g.rect(10, 18, 12, 9, a.tunique);
  g.ligneV(11, 19, 25, tuniqueLumiere);
  g.ligneV(21, 18, 26, tuniqueOmbre).ligneH(10, 21, 26, tuniqueOmbre);
  // Col en V
  g.points([[14, 18], [15, 19], [16, 19], [17, 18]], nuancer(a.peau, -0.1));
  // Ceinture
  g.ligneH(10, 21, 23, nuancer(a.tunique, -0.55));
  g.px(15, 23, PALETTE.lanterne).px(16, 23, nuancer(PALETTE.lanterne, -0.3));

  // Bras + mains
  g.rect(8, 19, 2, 5, tuniqueLumiere).rect(22, 19, 2, 5, tuniqueOmbre);
  g.rect(8, 24, 2, 2, a.peau).rect(22, 24, 2, 2, nuancer(a.peau, -0.2));

  // Cou
  g.rect(14, 17, 4, 1, nuancer(a.peau, -0.25));
}

function dessinerTete(g: GrillePixel, a: ApparencePersonnage, o: OptionsDessin): void {
  const peauOmbre = nuancer(a.peau, -0.18);
  g.rect(9, 6, 14, 11, a.peau);
  // Coins arrondis
  g.points([[9, 6], [22, 6], [9, 16], [22, 16]], null);
  // Ombrage
  g.ligneV(22, 7, 15, peauOmbre).ligneH(10, 21, 16, peauOmbre);
  g.px(10, 7, nuancer(a.peau, 0.2)).px(11, 7, nuancer(a.peau, 0.2));
  // Oreilles
  g.rect(8, 11, 1, 2, a.peau).rect(23, 11, 1, 2, peauOmbre);

  // Yeux
  if (o.yeuxFermes) {
    g.ligneH(12, 13, 12, E).ligneH(18, 19, 12, E);
  } else {
    g.rect(12, 11, 2, 2, E).rect(18, 11, 2, 2, E);
    g.px(12, 11, "#ffffff").px(18, 11, "#ffffff");
  }

  // Sourcils
  const s = nuancer(a.cheveux, -0.2);
  switch (a.humeur) {
    case "grognon":
      g.points([[11, 9], [12, 9], [13, 10], [20, 9], [19, 9], [18, 10]], s);
      break;
    case "inquiet":
      g.points([[11, 10], [12, 9], [13, 9], [20, 10], [19, 9], [18, 9]], s);
      // Cernes
      g.points([[12, 13], [13, 13], [18, 13], [19, 13]], nuancer(a.peau, -0.3));
      break;
    case "serein":
      break;
    default:
      g.ligneH(12, 13, 9, s).ligneH(18, 19, 9, s);
  }

  // Joues
  if (a.humeur === "sourire" || a.humeur === "serein") {
    g.px(11, 14, "#e8707a").px(20, 14, "#e8707a");
  }

  // Bouche
  const bouche = nuancer(a.peau, -0.55);
  switch (a.humeur) {
    case "sourire":
      g.points([[14, 14], [15, 15], [16, 15], [17, 14]], bouche);
      break;
    case "grognon":
      g.points([[14, 15], [15, 14], [16, 14], [17, 15]], bouche);
      break;
    case "serein":
      g.ligneH(15, 16, 14, nuancer(a.peau, -0.35));
      break;
    case "inquiet":
      g.rect(15, 14, 2, 2, bouche);
      break;
    default:
      g.ligneH(15, 16, 15, bouche);
  }
}

function dessinerCoiffure(g: GrillePixel, a: ApparencePersonnage): void {
  const c = a.cheveux;
  const lumiere = nuancer(c, 0.3);
  const ombre = nuancer(c, -0.3);

  const base = () => {
    g.rect(10, 4, 12, 2, c).rect(9, 5, 14, 3, c);
    g.rect(9, 8, 2, 3, c).rect(21, 8, 2, 3, ombre);
    g.points([[12, 8], [13, 8], [16, 8], [19, 8]], c);
    g.ligneH(12, 15, 5, lumiere);
  };

  switch (a.coiffure) {
    case "courte":
      base();
      break;
    case "longue":
      base();
      g.rect(8, 8, 2, 10, c).rect(22, 8, 2, 10, ombre);
      g.px(8, 18, ombre).px(23, 18, ombre);
      break;
    case "chauve":
      g.rect(8, 9, 2, 4, c).rect(22, 9, 2, 4, ombre);
      g.px(13, 7, nuancer(a.peau, 0.35)).px(14, 7, nuancer(a.peau, 0.35));
      break;
    case "herissee":
      base();
      for (let x = 9; x <= 21; x += 3) {
        g.px(x, 3, c).px(x + 1, 3, c).px(x, 2, c);
      }
      g.px(10, 2, lumiere).px(16, 2, lumiere);
      break;
    case "chignon":
      base();
      g.ellipse(16, 2, 2, 1.5, c).px(15, 1, lumiere);
      break;
    case "aucune":
      break;
  }
}

function dessinerAccessoires(g: GrillePixel, a: ApparencePersonnage): void {
  for (const acc of a.accessoires) {
    switch (acc) {
      case "barbe": {
        const b = a.cheveux;
        g.ligneH(13, 18, 13, b);
        g.rect(10, 15, 12, 3, b).rect(11, 18, 10, 1, b).rect(13, 19, 6, 1, nuancer(b, -0.2));
        g.ligneV(10, 13, 14, b).ligneV(21, 13, 14, b);
        g.ligneH(15, 16, 14, nuancer(a.peau, -0.55));
        g.px(12, 16, nuancer(b, 0.3)).px(14, 17, nuancer(b, 0.3));
        break;
      }
      case "lunettes": {
        const or = "#d8b04a";
        for (const x0 of [11, 17]) {
          g.ligneH(x0, x0 + 3, 10, or).ligneH(x0, x0 + 3, 13, or);
          g.ligneV(x0, 10, 13, or).ligneV(x0 + 3, 10, 13, or);
        }
        g.ligneH(15, 16, 11, or);
        break;
      }
      case "bouffon": {
        const rouge = "#c83a3a";
        const vert = "#3a8a4a";
        g.rect(9, 3, 7, 4, rouge).rect(16, 3, 7, 4, vert);
        // Pointes
        g.points([[8, 3], [7, 2], [6, 1], [8, 4], [7, 3]], rouge);
        g.points([[23, 3], [24, 2], [25, 1], [23, 4], [24, 3]], vert);
        g.px(5, 0, PALETTE.lanterne).px(26, 0, PALETTE.lanterne);
        g.px(5, 1, PALETTE.lanterne).px(26, 1, PALETTE.lanterne);
        // Bandeau
        g.ligneH(9, 22, 7, PALETTE.lanterne);
        g.px(12, 4, nuancer(rouge, 0.3)).px(18, 4, nuancer(vert, 0.3));
        break;
      }
      case "voile": {
        const t = a.tissu ?? PALETTE.nuit700;
        const tOmbre = nuancer(t, -0.3);
        g.rect(9, 2, 14, 5, t).rect(8, 4, 1, 3, t).rect(23, 4, 1, 3, tOmbre);
        g.rect(7, 6, 3, 13, t).rect(22, 6, 3, 13, tOmbre);
        g.rect(6, 12, 1, 8, t).rect(25, 12, 1, 8, tOmbre);
        g.ligneH(10, 21, 7, PALETTE.os);
        g.ligneH(11, 14, 3, nuancer(t, 0.25));
        // Croix
        g.points([[16, 20], [15, 21], [16, 21], [17, 21], [16, 22]], PALETTE.lanterne);
        break;
      }
      case "capuche": {
        const t = a.tissu ?? "#7a2a3a";
        const tOmbre = nuancer(t, -0.3);
        g.rect(9, 3, 14, 3, t).rect(8, 5, 2, 12, t).rect(22, 5, 2, 12, tOmbre);
        g.rect(7, 16, 3, 4, t).rect(22, 16, 3, 4, tOmbre);
        g.px(9, 3, null).px(22, 3, null);
        g.ligneH(11, 15, 3, nuancer(t, 0.25));
        // Mèche visible
        g.points([[11, 6], [12, 6], [13, 7], [18, 6], [19, 6]], a.cheveux);
        break;
      }
      case "lanterne": {
        g.px(25, 20, E).px(25, 21, "#8a7a5a");
        g.rect(24, 22, 3, 1, "#5a4a3a").rect(24, 26, 3, 1, "#5a4a3a");
        g.rect(24, 23, 3, 3, PALETTE.lanterne).px(25, 24, PALETTE.lanterneClair);
        break;
      }
      case "chapeau_alu": {
        const alu = "#c8cad8";
        const aluOmbre = "#8a8ca0";
        for (let j = 0; j < 6; j++) {
          g.ligneH(16 - j - 1, 16 + j, j, j % 2 === 0 ? alu : aluOmbre);
        }
        g.ligneH(9, 22, 6, aluOmbre);
        g.px(15, 1, "#ffffff").px(13, 3, "#ffffff");
        break;
      }
    }
  }
}

export function dessinerPersonnage(a: ApparencePersonnage, o: OptionsDessin = {}): GrillePixel {
  const g = new GrillePixel(32, 32);
  dessinerCorps(g, a);
  dessinerTete(g, a, o);
  dessinerCoiffure(g, a);
  dessinerAccessoires(g, a);
  g.contour(E);
  if (o.fantome) {
    g.transformer((c) => niveauxDeGris(c));
  } else {
    // Ombre portée sous les pieds
    g.sousCouche((calque) => calque.ellipse(16, 30.5, 7, 1.2, "rgba(10,6,20,0.45)"));
  }
  return g;
}

export function spritePersonnage(cle: string, a: ApparencePersonnage, o: OptionsDessin = {}): string {
  return cuire(`perso:${cle}:${o.yeuxFermes ? 1 : 0}:${o.fantome ? 1 : 0}`, () => dessinerPersonnage(a, o));
}

// ─── Pierre tombale ─────────────────────────────────────────────────────────

export function spriteTombe(): string {
  return cuire("tombe", () => {
    const g = new GrillePixel(32, 32);
    const p = PALETTE.pierre;
    g.ellipse(16, 13, 7, 6, p).rect(9, 13, 15, 14, p);
    g.ligneV(22, 10, 26, nuancer(p, -0.3)).ligneV(23, 13, 26, nuancer(p, -0.3));
    g.ligneV(10, 11, 25, nuancer(p, 0.25));
    // Croix gravée
    g.ligneV(16, 11, 21, nuancer(p, -0.45)).ligneH(13, 19, 14, nuancer(p, -0.45));
    // Fissure + mousse
    g.points([[19, 22], [20, 23], [19, 24]], nuancer(p, -0.5));
    g.points([[9, 25], [10, 25], [10, 24], [22, 25], [23, 24]], PALETTE.mousse);
    g.contour(E);
    // Terre + herbe
    g.sousCouche((c) => {
      c.ellipse(16, 28.5, 11, 2, "#3a2a20");
      c.points([[5, 27], [6, 26], [26, 27], [27, 26], [8, 28], [24, 28]], PALETTE.mousse);
    });
    return g;
  });
}

