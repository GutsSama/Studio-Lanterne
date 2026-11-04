/** Décor du village (256×144) en version jour et nuit, plus le feu de camp animé. */
import { GrillePixel, PALETTE, aleatoire, cuire, melanger, nuancer } from "./moteur";

export const LARGEUR_SCENE = 256;
export const HAUTEUR_SCENE = 144;
const HORIZON = 84;
const E = PALETTE.encre;

interface Ambiance {
  cielHaut: string;
  cielBas: string;
  collinesLoin: string;
  collinesPres: string;
  arbres: string;
  herbe: string;
  herbeSombre: string;
  terre: string;
  murs: string;
  toits: string;
  fenetres: string;
}

const NUIT: Ambiance = {
  cielHaut: "#07061a",
  cielBas: "#2e2a5e",
  collinesLoin: "#1d1b40",
  collinesPres: "#16142e",
  arbres: "#0f1a24",
  herbe: "#1f3a2e",
  herbeSombre: "#152a22",
  terre: "#3a2e3a",
  murs: "#4a4060",
  toits: "#2e2440",
  fenetres: PALETTE.lanterne,
};

const JOUR: Ambiance = {
  cielHaut: "#3d7fd1",
  cielBas: "#a8dcf0",
  collinesLoin: "#6aa8a0",
  collinesPres: "#4a8a5a",
  arbres: "#2e6a3a",
  herbe: "#5a9a3a",
  herbeSombre: "#4a8030",
  terre: "#a8845a",
  murs: "#e8d5a8",
  toits: "#b4402a",
  fenetres: "#3a4a6a",
};

/** Matrice de Bayer 4×4 pour des dégradés tramés façon 16 bits. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

function seuilBayer(x: number, y: number): number {
  return ((BAYER[y % 4]?.[x % 4] ?? 0) + 0.5) / 16;
}

function dessinerCiel(g: GrillePixel, a: Ambiance): void {
  const bandes = 6;
  const couleurs = Array.from({ length: bandes }, (_, i) => melanger(a.cielHaut, a.cielBas, i / (bandes - 1)));
  for (let y = 0; y < HORIZON; y++) {
    const t = (y / HORIZON) * (bandes - 1);
    const i = Math.floor(t);
    const frac = t - i;
    for (let x = 0; x < LARGEUR_SCENE; x++) {
      const c = frac > seuilBayer(x, y) ? couleurs[Math.min(i + 1, bandes - 1)] : couleurs[i];
      g.px(x, y, c ?? a.cielHaut);
    }
  }
}

function dessinerEtoilesEtLune(g: GrillePixel): void {
  const r = aleatoire(42);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(r() * LARGEUR_SCENE);
    const y = Math.floor(r() * (HORIZON - 20));
    const brillante = r() > 0.88;
    g.px(x, y, brillante ? "#ffffff" : r() > 0.5 ? "#a8a8d8" : "#6a6aa8");
    if (brillante) {
      g.px(x - 1, y, "#6a6aa8").px(x + 1, y, "#6a6aa8").px(x, y - 1, "#6a6aa8").px(x, y + 1, "#6a6aa8");
    }
  }
  // Halo + lune
  g.ellipse(212, 26, 17, 17, "#24224e").ellipse(212, 26, 14, 14, "#34326a");
  g.ellipse(212, 26, 11, 11, "#f2ead8");
  g.ellipse(215, 23, 11, 11, "#f2ead8");
  // Cratères
  g.ellipse(208, 22, 2, 2, "#d8ccb0").ellipse(215, 30, 3, 2, "#d8ccb0").px(205, 29, "#d8ccb0");
  g.points([[203, 20], [202, 22], [202, 24]], "#ffffff");
}

function dessinerSoleilEtNuages(g: GrillePixel): void {
  g.ellipse(44, 24, 14, 14, "#f8e8a0").ellipse(44, 24, 10, 10, PALETTE.lanterne).ellipse(42, 22, 5, 5, "#fff3b0");
  const nuage = (x: number, y: number, l: number) => {
    g.ellipse(x, y, l, 4, "#ffffff").ellipse(x - l / 2, y + 1, l / 2, 3, "#ffffff");
    g.ellipse(x + l / 2, y + 1, l / 2, 3, "#ffffff").ligneH(x - l, x + l, y + 4, "#d8e8f8");
  };
  nuage(120, 20, 12);
  nuage(190, 34, 9);
  nuage(80, 46, 7);
}

function dessinerCollines(g: GrillePixel, a: Ambiance): void {
  for (let x = 0; x < LARGEUR_SCENE; x++) {
    const loin = HORIZON - 14 - Math.round(Math.sin(x / 23) * 5 + Math.sin(x / 9 + 1) * 2);
    g.ligneV(x, loin, HORIZON + 4, a.collinesLoin);
    const pres = HORIZON - 4 - Math.round(Math.sin(x / 31 + 2) * 4);
    g.ligneV(x, pres, HORIZON + 6, a.collinesPres);
  }
}

function dessinerSapin(g: GrillePixel, x: number, base: number, h: number, c: string): void {
  for (let j = 0; j < h; j++) {
    const demi = Math.floor((j / h) * (h / 2.4)) + (j % 3 === 0 ? 1 : 0);
    g.ligneH(x - demi, x + demi, base - h + j, c);
  }
  g.ligneV(x, base, base + 2, nuancer(c, -0.3));
}

function dessinerForet(g: GrillePixel, a: Ambiance): void {
  const r = aleatoire(7);
  for (let x = -4; x < LARGEUR_SCENE + 4; x += 6 + Math.floor(r() * 5)) {
    if (x > 60 && x < 196) continue; // Le village occupe le centre
    dessinerSapin(g, x, HORIZON + 2, 12 + Math.floor(r() * 12), a.arbres);
  }
}

function dessinerMaison(g: GrillePixel, x: number, base: number, l: number, h: number, a: Ambiance, nuit: boolean): void {
  const murOmbre = nuancer(a.murs, -0.25);
  g.rect(x, base - h, l, h, a.murs);
  g.ligneV(x + l - 1, base - h, base - 1, murOmbre);
  // Colombages
  g.ligneH(x, x + l - 1, base - h, nuancer(a.murs, -0.5));
  g.ligneV(x + Math.floor(l / 2), base - h, base - 1, nuancer(a.murs, -0.45));
  // Toit
  const hauteurToit = Math.ceil(l / 2) + 1;
  for (let j = 0; j < hauteurToit; j++) {
    g.ligneH(x - 2 + j, x + l + 1 - j, base - h - 1 - j, j % 2 === 0 ? a.toits : nuancer(a.toits, -0.15));
  }
  // Cheminée
  g.rect(x + l - 5, base - h - hauteurToit, 2, 4, nuancer(a.murs, -0.4));
  // Porte + fenêtres
  g.rect(x + 2, base - 6, 3, 6, "#4a2e1e");
  g.rect(x + l - 6, base - h + 3, 3, 3, a.fenetres);
  if (nuit) {
    g.px(x + l - 5, base - h + 4, PALETTE.lanterneClair);
    // Lueur sous la fenêtre
    g.px(x + l - 6, base - h + 6, nuancer(a.murs, 0.15)).px(x + l - 4, base - h + 6, nuancer(a.murs, 0.15));
  } else {
    g.px(x + l - 5, base - h + 4, "#a8c8e8");
  }
  g.ligneH(x - 1, x + l, base, E);
}

function dessinerSol(g: GrillePixel, a: Ambiance): void {
  g.rect(0, HORIZON + 4, LARGEUR_SCENE, HAUTEUR_SCENE - HORIZON - 4, a.herbe);
  const r = aleatoire(99);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(r() * LARGEUR_SCENE);
    const y = HORIZON + 6 + Math.floor(r() * (HAUTEUR_SCENE - HORIZON - 6));
    g.px(x, y, a.herbeSombre);
    if (r() > 0.6) g.px(x, y - 1, a.herbeSombre);
  }
  // Place en terre battue autour du feu (ellipse tramée)
  const cx = 128;
  const cy = 116;
  for (let y = HORIZON + 8; y < HAUTEUR_SCENE; y++) {
    for (let x = 0; x < LARGEUR_SCENE; x++) {
      const d = ((x - cx) / 104) ** 2 + ((y - cy) / 30) ** 2;
      if (d < 0.85 || (d < 1 && seuilBayer(x, y) > (d - 0.85) / 0.15)) g.px(x, y, a.terre);
    }
  }
  // Cailloux
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(r() * LARGEUR_SCENE);
    const y = HORIZON + 10 + Math.floor(r() * 50);
    g.px(x, y, nuancer(a.terre, 0.2));
  }
}

function dessinerPuitsEtCloture(g: GrillePixel, a: Ambiance): void {
  // Clôture
  for (let x = 4; x < 56; x += 5) g.rect(x, HORIZON + 4, 1, 6, nuancer(a.murs, -0.5));
  g.ligneH(4, 56, HORIZON + 6, nuancer(a.murs, -0.4));
  for (let x = 200; x < 252; x += 5) g.rect(x, HORIZON + 4, 1, 6, nuancer(a.murs, -0.5));
  g.ligneH(200, 252, HORIZON + 6, nuancer(a.murs, -0.4));
}

export function dessinerVillage(nuit: boolean): GrillePixel {
  const a = nuit ? NUIT : JOUR;
  const g = new GrillePixel(LARGEUR_SCENE, HAUTEUR_SCENE);
  dessinerCiel(g, a);
  if (nuit) dessinerEtoilesEtLune(g);
  else dessinerSoleilEtNuages(g);
  dessinerCollines(g, a);
  dessinerForet(g, a);
  dessinerSol(g, a);
  // Village à l'arrière-plan
  dessinerMaison(g, 70, HORIZON + 4, 18, 12, a, nuit);
  dessinerMaison(g, 96, HORIZON + 2, 14, 10, a, nuit);
  // Clocher
  g.rect(122, HORIZON - 22, 12, 26, nuancer(a.murs, -0.1)).ligneV(133, HORIZON - 22, HORIZON + 3, nuancer(a.murs, -0.35));
  for (let j = 0; j < 9; j++) g.ligneH(121 + j, 134 - j, HORIZON - 23 - j, a.toits);
  g.rect(126, HORIZON - 16, 4, 5, nuit ? PALETTE.lanterne : "#3a4a6a");
  g.px(127, HORIZON - 33, E).px(127, HORIZON - 34, E).ligneH(126, 128, HORIZON - 35, E);
  dessinerMaison(g, 144, HORIZON + 3, 16, 11, a, nuit);
  dessinerMaison(g, 168, HORIZON + 4, 20, 13, a, nuit);
  dessinerPuitsEtCloture(g, a);
  return g;
}

export function spriteVillage(nuit: boolean): string {
  return cuire(`village:${nuit ? "nuit" : "jour"}`, () => dessinerVillage(nuit));
}

// ─── Feu de camp (24×24, 4 images) ─────────────────────────────────────────

export const IMAGES_FEU = 4;

export function spriteFeu(image: number): string {
  return cuire(`feu:${image}`, () => {
    const g = new GrillePixel(24, 24);
    const r = aleatoire(1000 + image * 17);
    // Flammes : colonnes de hauteur variable
    const couches: [string, number, number][] = [
      ["#b4202a", 7, 13],
      [PALETTE.braise, 5, 10],
      [PALETTE.lanterne, 3, 7],
      [PALETTE.lanterneClair, 1, 4],
    ];
    for (const [c, demi, hMax] of couches) {
      for (let dx = -demi; dx <= demi; dx++) {
        const h = Math.max(1, Math.round(hMax * (1 - Math.abs(dx) / (demi + 1)) + (r() * 3 - 1)));
        g.ligneV(12 + dx, 18 - h, 18, c);
      }
    }
    // Étincelles
    for (let i = 0; i < 3; i++) g.px(6 + Math.floor(r() * 12), 1 + Math.floor(r() * 5), PALETTE.lanterne);
    // Bûches
    g.ligne(4, 21, 19, 18, "#6a4a2a").ligne(4, 22, 19, 19, "#4a2e1e");
    g.ligne(5, 18, 20, 21, "#7a5a3a").ligne(5, 19, 20, 22, "#4a2e1e");
    // Pierres
    for (const x of [2, 7, 12, 17, 21]) g.rect(x, 21, 3, 2, x % 2 === 0 ? "#7a7590" : "#5a5570");
    return g;
  });
}

