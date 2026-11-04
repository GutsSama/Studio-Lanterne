/** Icônes 12×12 des rôles, dessinées à la main en ASCII. */
import type { RolePersonnage } from "../types/game";
import { GrillePixel, PALETTE, cuire } from "./moteur";

const E = PALETTE.encre;

const ICONES: Record<RolePersonnage | "inconnu", { lignes: string[]; palette: Record<string, string> }> = {
  creature: {
    lignes: [
      "#..........#",
      "##........##",
      "#g#......#g#",
      "#gg######gg#",
      "#gggggggggg#",
      "#gyyggggyyg#",
      "#gggggggggg#",
      ".#gggkkggg#.",
      ".#gggggggg#.",
      "..#wgwwgw#..",
      "...#gggg#...",
      "....####....",
    ],
    palette: { "#": E, g: "#5a5470", y: "#ff4040", k: E, w: PALETTE.os },
  },
  inquisiteur: {
    lignes: [
      "............",
      "............",
      "...######...",
      "..#wwwwww#..",
      ".#wwbbbbww#.",
      "#wwbbkkbbww#",
      "#wwbbkkbbww#",
      ".#wwbbbbww#.",
      "..#wwwwww#..",
      "...######...",
      "............",
      "............",
    ],
    palette: { "#": E, w: PALETTE.os, b: "#3a8ad8", k: E },
  },
  alchimiste: {
    lignes: [
      "....####....",
      "....#cc#....",
      ".....##.....",
      "....#ww#....",
      "....#ww#....",
      "...#wwww#...",
      "..#wwwwww#..",
      ".#rrrrrrrr#.",
      ".#rlrrrrrr#.",
      ".#rrrrrrrr#.",
      "..#rrrrrr#..",
      "...######...",
    ],
    palette: { "#": E, c: "#8a5a3a", w: "#cfe8f0", r: "#9a4ad8", l: "#e8c8ff" },
  },
  garde_du_corps: {
    lignes: [
      ".##########.",
      "#ssssyyssss#",
      "#ssssyyssss#",
      "#ssssyyssss#",
      "#syyyyyyyys#",
      "#syyyyyyyys#",
      ".#sssyysss#.",
      ".#sssyysss#.",
      "..#ssyyss#..",
      "..#ssyyss#..",
      "...#ssss#...",
      "....####....",
    ],
    palette: { "#": E, s: "#3b5dc9", y: PALETTE.lanterne },
  },
  citoyen: {
    lignes: [
      ".....##.....",
      "....#rr#....",
      "...#rrrr#...",
      "..#rrrrrr#..",
      ".#rrrrrrrr#.",
      "############",
      ".#bbbbbbbb#.",
      ".#bwwbbddb#.",
      ".#bwwbbddb#.",
      ".#bbbbbddb#.",
      ".#bbbbbddb#.",
      ".##########.",
    ],
    palette: { "#": E, r: "#c83a3a", b: "#e8d5a8", w: PALETTE.lanterne, d: "#6a4a2a" },
  },
  inconnu: {
    lignes: [
      "...######...",
      "..#pppppp#..",
      ".#pp####pp#.",
      ".#p#....#p#.",
      "..#....#pp#.",
      "......#pp#..",
      ".....#pp#...",
      ".....#pp#...",
      "......##....",
      ".....####...",
      ".....#pp#...",
      "......##....",
    ],
    palette: { "#": E, p: PALETTE.parchemin },
  },
};

export function iconeRole(role: RolePersonnage | null): string {
  const cle = role ?? "inconnu";
  return cuire(`icone:${cle}`, () => {
    const def = ICONES[cle];
    return new GrillePixel(12, 12).ascii(0, 0, def.lignes, def.palette);
  });
}

/** Petite icône 8×8 : lune / soleil pour le HUD. */
export function iconeLune(): string {
  return cuire("icone:lune", () =>
    new GrillePixel(8, 8).ascii(
      0,
      0,
      ["..####..", ".#oo##..", "#oo#....", "#oo#....", "#oo#....", "#ooo#...", ".#ooo###", "..#####."],
      { "#": E, o: PALETTE.os },
    ),
  );
}

export function iconeSoleil(): string {
  return cuire("icone:soleil", () =>
    new GrillePixel(8, 8).ascii(
      0,
      0,
      ["y..y..y.", ".y####y.", ".#oooo#.", "y#oooo#y", ".#oooo#.", ".y####y.", "y..y..y.", "........"],
      { "#": "#c87a1a", o: PALETTE.lanterne, y: PALETTE.lanterne },
    ),
  );
}

