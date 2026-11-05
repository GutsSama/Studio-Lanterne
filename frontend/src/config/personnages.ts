import type { RolePersonnage } from '../types/database.types';

export const ASSETS_TAVERNE = {
  taverneJour: '/sprites/taverne-jour.jpg',
  taverneNuit: '/sprites/taverne-nuit.jpg',
  interludeAube: '/sprites/interlude-aube.jpg',
  interludeNuit: '/sprites/interlude-nuit.jpg',
  table: '/sprites/table.png',
  chaiseVide: '/sprites/chaise-vide.png',
  potion: '/sprites/potion.png',
} as const;

export interface ConfigPersonnage {
  id: string;
  nomDefaut: string;
  titre: string;
  spriteUrl: string;
  description: string;
  classeAura: string;
}

export const PERSONNAGES_TAVERNE: Record<string, ConfigPersonnage> = {
  humain: {
    id: 'humain',
    nomDefaut: 'Alain',
    titre: 'Le Voyageur',
    spriteUrl: '/sprites/humain.png',
    description: 'Le voyageur solitaire arrivé à la taverne à la nuit tombée.',
    classeAura: 'from-amber-500/20 to-amber-700/5',
  },
  gerard: {
    id: 'gerard',
    nomDefaut: 'Gérard',
    titre: 'Le Râleur',
    spriteUrl: '/sprites/gerard.png',
    description: 'Vieux vétéran bourru toujours prompt à accuser les nouveaux venus.',
    classeAura: 'from-orange-500/20 to-orange-700/5',
  },
  elena: {
    id: 'elena',
    nomDefaut: 'Elena',
    titre: 'La Stratège',
    spriteUrl: '/sprites/elena.png',
    description: 'Érudite attentive qui dissèque chaque parole et chaque silence.',
    classeAura: 'from-sky-500/20 to-blue-700/5',
  },
  bob: {
    id: 'bob',
    nomDefaut: 'Bob',
    titre: 'Le Rigolo',
    spriteUrl: '/sprites/bob.png',
    description: 'Barde insouciant qui use d’humour pour dissimuler ses doutes.',
    classeAura: 'from-yellow-500/20 to-amber-700/5',
  },
  beatrice: {
    id: 'beatrice',
    nomDefaut: 'Sœur Béatrice',
    titre: 'La Mystique',
    spriteUrl: '/sprites/beatrice.png',
    description: 'Dévote scrutant les signes et les murmures de la nuit.',
    classeAura: 'from-purple-500/20 to-indigo-700/5',
  },
  lucas: {
    id: 'lucas',
    nomDefaut: 'Lucas',
    titre: 'Le Paranoïaque',
    spriteUrl: '/sprites/lucas.png',
    description: 'Chasseur aux aguets qui voit des créatures dans chaque ombre.',
    classeAura: 'from-emerald-500/20 to-teal-700/5',
  },
};

/**
 * 6 emplacements calibrés autour et derrière la table ronde de la taverne :
 * - Sièges 1 & 6 : Premier plan latéral
 * - Sièges 2 & 5 : Deuxième plan intermédiaire
 * - Sièges 3 & 4 : Arrière-plan central
 */
export const SIEGES_TAVERNE = [
  { left: '12%', top: '44%', scale: 1.04, zIndex: 24 },
  { left: '26%', top: '33%', scale: 0.94, zIndex: 18 },
  { left: '41%', top: '27%', scale: 0.88, zIndex: 15 },
  { left: '59%', top: '27%', scale: 0.88, zIndex: 15 },
  { left: '74%', top: '33%', scale: 0.94, zIndex: 18 },
  { left: '88%', top: '44%', scale: 1.04, zIndex: 24 },
] as const;

export interface InfoRole {
  role: RolePersonnage;
  label: string;
  camp: 'citoyens' | 'creatures';
  rubanClasses: string;
  orbeClasses: string;
  description: string;
}

export const ROLES_OFFICIELS: Record<RolePersonnage, InfoRole> = {
  citoyen: {
    role: 'citoyen',
    label: 'Citoyen',
    camp: 'citoyens',
    rubanClasses: 'bg-stone-900/90 text-amber-100 border-amber-800/60',
    orbeClasses: 'bg-emerald-600 border-emerald-300 shadow-[0_0_8px_#059669]',
    description: 'Simple habitant du village sans pouvoir nocturne. Participe aux débats et aux votes du jour.',
  },
  creature: {
    role: 'creature',
    label: 'Créature de la Nuit',
    camp: 'creatures',
    rubanClasses: 'bg-red-950/90 text-red-200 border-red-600/70',
    orbeClasses: 'bg-red-600 border-red-300 shadow-[0_0_10px_#dc2626]',
    description: 'Chasse les villageois à la nuit tombée et complote pour dévorer la taverne.',
  },
  inquisiteur: {
    role: 'inquisiteur',
    label: 'Inquisiteur',
    camp: 'citoyens',
    rubanClasses: 'bg-sky-950/90 text-sky-200 border-sky-500/70',
    orbeClasses: 'bg-sky-500 border-sky-200 shadow-[0_0_10px_#38bdf8]',
    description: 'Inspecte chaque nuit l’aura d’un convive pour percer son allégeance secrète.',
  },
  alchimiste: {
    role: 'alchimiste',
    label: 'Alchimiste',
    camp: 'citoyens',
    rubanClasses: 'bg-emerald-950/90 text-emerald-200 border-emerald-500/70',
    orbeClasses: 'bg-emerald-500 border-emerald-200 shadow-[0_0_10px_#10b981]',
    description: 'Possède deux fioles uniques : la Potion de Vie pour sauver la victime, et la Potion de Mort pour éliminer un suspect.',
  },
  garde_du_corps: {
    role: 'garde_du_corps',
    label: 'Garde du Corps',
    camp: 'citoyens',
    rubanClasses: 'bg-amber-950/90 text-amber-200 border-amber-500/70',
    orbeClasses: 'bg-amber-500 border-amber-200 shadow-[0_0_10px_#fbbf24]',
    description: 'En cas d’élimination, dégaine une dernière balle pour emporter un suspect dans sa chute.',
  },
};

export function getBadgeRole(role: RolePersonnage | null) {
  if (role && ROLES_OFFICIELS[role]) {
    const info = ROLES_OFFICIELS[role];
    return {
      label: info.label,
      ruban: info.rubanClasses,
      orbe: info.orbeClasses,
    };
  }
  return {
    label: 'Secret',
    ruban: 'bg-black/85 text-amber-200/70 border-amber-900/50',
    orbe: 'bg-amber-800 border-amber-400 shadow-[0_0_6px_#b45309]',
  };
}
