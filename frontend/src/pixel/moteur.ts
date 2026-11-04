/**
 * Mini-moteur de pixel art : on dessine sur une grille de couleurs,
 * puis on « cuit » la grille en PNG (data URL) affiché avec `image-rendering: pixelated`.
 */

export type Couleur = string;

export const PALETTE = {
  encre: "#140c1c",
  nuit900: "#0d0b1e",
  nuit800: "#1b1630",
  nuit700: "#2a2350",
  nuit600: "#3b3a7a",
  parchemin: "#e8d5a8",
  parcheminSombre: "#c2a46e",
  lanterne: "#f4b41b",
  lanterneClair: "#fff3b0",
  braise: "#e06c2c",
  sang: "#b4202a",
  mousse: "#5a8a3a",
  os: "#f2ead8",
  pierre: "#7a7590",
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

/** Éclaircit (montant > 0) ou assombrit (montant < 0) avec un léger décalage de teinte façon pixel art. */
export function nuancer(hex: string, montant: number): string {
  const [r, g, b] = hexVersRgb(hex);
  if (montant >= 0) {
    // Les lumières tirent vers le jaune chaud
    return rgbVersHex(r + (255 - r) * montant, g + (245 - g) * montant, b + (200 - b) * montant * 0.8);
  }
  const m = -montant;
  // Les ombres tirent vers le violet
  return rgbVersHex(r * (1 - m) + 30 * m * 0.3, g * (1 - m), b * (1 - m) + 60 * m * 0.4);
}

export function melanger(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexVersRgb(a);
  const [r2, g2, b2] = hexVersRgb(b);
  return rgbVersHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function niveauxDeGris(hex: string): string {
  const [r, g, b] = hexVersRgb(hex);
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  return rgbVersHex(l * 0.9 + 20, l * 0.9 + 20, l + 30);
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

  /** Ligne de Bresenham. */
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

  /** Applique une fonction de couleur sur toutes les cellules remplies. */
  transformer(fn: (c: Couleur, x: number, y: number) => Couleur | null): this {
    for (let y = 0; y < this.hauteur; y++) {
      for (let x = 0; x < this.largeur; x++) {
        const c = this.lire(x, y);
        if (c !== null) this.px(x, y, fn(c, x, y));
      }
    }
    return this;
  }

  /** Contour automatique (4-voisinage) autour de toutes les cellules remplies. */
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

  /** Remplit uniquement les cellules vides (utile pour les ombres portées). */
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

  /** Dessine une carte ASCII : chaque caractère est une clé de palette ('.' = vide). */
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

