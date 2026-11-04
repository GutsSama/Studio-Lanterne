/**
 * Mini-moteur de pixel art : on dessine sur une grille de couleurs,
 * puis on « cuit » la grille en PNG (data URL) affiché avec `image-rendering: pixelated`.
 */

export type Couleur = string;

export const PALETTE = {
  // Encrage et contours noirs chauds (comme dans les exemples)
  encre: "#1a141b",
  encreOmbre: "#100914",
  
  // Teintes peaux & visages RPG
  peauClaire: "#f6ceba",
  peauClaireOmbre: "#d9a18b",
  peauMoyenne: "#e2b298",
  peauOmbre: "#b78079",
  peauBrune: "#ad7658",
  peauBruneOmbre: "#794c35",
  
  // Tissus & cuirs chauds
  lin: "#ded5c3",
  linOmbre: "#9c8f7d",
  cuirClair: "#9a6b46",
  cuirMoyen: "#6c4533",
  cuirFonce: "#442721",
  cuirTresFonce: "#291816",
  
  // Tissus colorés (robes, capes, pourpoints)
  pourpre: "#5c324c",
  pourpreOmbre: "#361b2c",
  bleuNuit: "#2e3b52",
  bleuNuitOmbre: "#192231",
  vertForet: "#3a4c33",
  vertForetOmbre: "#212d1c",
  bordeaux: "#7c222b",
  bordeauxOmbre: "#491219",
  
  // Métaux, armes & armures
  acierClair: "#b8c4d2",
  acier: "#738294",
  acierOmbre: "#414c5c",
  orClair: "#f2cf6b",
  or: "#be943a",
  orOmbre: "#694f1c",

  // Éléments d'ambiance
  parchemin: "#e4d3b4",
  lanterne: "#e89a17",
  lanterneClair: "#fff0aa",
  braise: "#bd4a17",
  sang: "#9a1824",
  os: "#f0e7d8",
} as const;

// ─── Couleurs ───────────────────────────────────────────────────────────────

function hexVersRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbVersHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function nuancer(hex: string, montant: number): string {
  const [r, g, b] = hexVersRgb(hex);
  if (montant >= 0) {
    return rgbVersHex(r + (255 - r) * montant, g + (245 - g) * montant * 0.95, b + (220 - b) * montant * 0.75);
  }
  const m = -montant;
  return rgbVersHex(r * (1 - m) + 20 * m * 0.3, g * (1 - m) + 12 * m * 0.2, b * (1 - m) + 24 * m * 0.4);
}

export function melanger(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexVersRgb(a);
  const [r2, g2, b2] = hexVersRgb(b);
  return rgbVersHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function niveauxDeGris(hex: string): string {
  const [r, g, b] = hexVersRgb(hex);
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  return rgbVersHex(l * 0.75 + 15, l * 0.75 + 15, l * 0.85 + 25);
}

// ─── Générateur pseudo-aléatoire déterministe ──────────────────────────────

export function aleatoire(graine: number): () => number {
  let s = graine >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function hacher(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ─── Grille ─────────────────────────────────────────────────────────────────

export class GrillePixel {
  readonly largeur: number;
  readonly hauteur: number;
  private readonly cellules: (Couleur | null)[];

  constructor(largeur: number, hauteur: number) {
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.cellules = new Array<Couleur | null>(largeur * hauteur).fill(null);
  }

  dans(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.largeur && y < this.hauteur;
  }

  lire(x: number, y: number): Couleur | null {
    return this.dans(x, y) ? (this.cellules[y * this.largeur + x] ?? null) : null;
  }

  px(x: number, y: number, c: Couleur | null): this {
    if (this.dans(x, y)) this.cellules[y * this.largeur + x] = c;
    return this;
  }

  points(liste: ReadonlyArray<readonly [number, number]>, c: Couleur | null): this {
    for (const [x, y] of liste) this.px(x, y, c);
    return this;
  }

  rect(x: number, y: number, l: number, h: number, c: Couleur | null): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + l; i++) this.px(i, j, c);
    return this;
  }

  ligneH(x1: number, x2: number, y: number, c: Couleur | null): this {
    for (let i = Math.min(x1, x2); i <= Math.max(x1, x2); i++) this.px(i, y, c);
    return this;
  }

  ligneV(x: number, y1: number, y2: number, c: Couleur | null): this {
    for (let j = Math.min(y1, y2); j <= Math.max(y1, y2); j++) this.px(x, j, c);
    return this;
  }

  ligne(x0: number, y0: number, x1: number, y1: number, c: Couleur | null): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Couleur | null): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.35);
        const ny = (y - cy) / (ry + 0.35);
        if (nx * nx + ny * ny <= 1) this.px(x, y, c);
      }
    }
    return this;
  }

  transformer(fn: (c: Couleur, x: number, y: number) => Couleur | null): this {
    for (let y = 0; y < this.hauteur; y++) {
      for (let x = 0; x < this.largeur; x++) {
        const c = this.lire(x, y);
        if (c !== null) this.px(x, y, fn(c, x, y));
      }
    }
    return this;
  }

  contour(c: Couleur): this {
    const aPeindre: [number, number][] = [];
    for (let y = 0; y < this.hauteur; y++) {
      for (let x = 0; x < this.largeur; x++) {
        if (this.lire(x, y) !== null) continue;
        if (
          this.lire(x - 1, y) !== null ||
          this.lire(x + 1, y) !== null ||
          this.lire(x, y - 1) !== null ||
          this.lire(x, y + 1) !== null
        ) {
          aPeindre.push([x, y]);
        }
      }
    }
    return this.points(aPeindre, c);
  }

  sousCouche(dessin: (g: GrillePixel) => void): this {
    const calque = new GrillePixel(this.largeur, this.hauteur);
    dessin(calque);
    for (let y = 0; y < this.hauteur; y++) {
      for (let x = 0; x < this.largeur; x++) {
        const c = calque.lire(x, y);
        if (c !== null && this.lire(x, y) === null) this.px(x, y, c);
      }
    }
    return this;
  }

  ascii(x0: number, y0: number, lignes: readonly string[], palette: Readonly<Record<string, Couleur>>): this {
    lignes.forEach((ligne, j) => {
      [...ligne].forEach((ch, i) => {
        const c = palette[ch];
        if (c !== undefined) this.px(x0 + i, y0 + j, c);
      });
    });
    return this;
  }

  versCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.largeur;
    canvas.height = this.hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    for (let y = 0; y < this.hauteur; y++) {
      for (let x = 0; x < this.largeur; x++) {
        const c = this.lire(x, y);
        if (c === null) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }

  versDataUrl(): string {
    return this.versCanvas().toDataURL("image/png");
  }
}

// ─── Cache des sprites cuits ────────────────────────────────────────────────

const cache = new Map<string, string>();

export function cuire(cle: string, dessin: () => GrillePixel): string {
  const existant = cache.get(cle);
  if (existant) return existant;
  const url = dessin().versDataUrl();
  cache.set(cle, url);
  return url;
}
