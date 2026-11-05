import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ASSETS_TAVERNE } from '../config/personnages';
import {
  resoudreAvatarHumain,
  type JoueurPartie,
} from '../types/database.types';

interface BloodSplatterProps {
  victime: JoueurPartie | null;
  onDismiss: () => void;
}

/**
 * Vignette 3 : L'ÉLIMINATION TRAGIQUE D'UN PERSONNAGE (Mort cinématique)
 * Affiche le sprite transparent HD du personnage éliminé (`/sprites/gerard.png`, `/sprites/elena.png`, etc.)
 * dans la taverne sombre, traversé par une éclaboussure de sang en diagonale,
 * avec la bannière dorée "[NOM] A ÉTÉ ÉLIMINÉ" et "Il était [RÔLE]".
 */
export function BloodSplatter({ victime, onDismiss }: BloodSplatterProps) {
  useEffect(() => {
    if (!victime) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 4300);
    return () => window.clearTimeout(timer);
  }, [victime, onDismiss]);

  if (!victime) return null;

  const spriteUrl = resoudreAvatarHumain(victime);
  const roleAffiche = (victime.role || 'citoyen')
    .replaceAll('_', ' ')
    .toUpperCase();

  return (
    <AnimatePresence>
      <motion.div
        key={victime.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md cursor-pointer select-none overflow-hidden font-serif p-4"
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 190, damping: 18 }}
          className="relative w-full max-w-3xl h-[28rem] md:h-[34rem] rounded-2xl overflow-hidden border-2 border-red-900/80 bg-[#0d0607] shadow-[0_0_120px_rgba(185,28,28,0.9)] flex flex-col items-center justify-end"
        >
          {/* Fond de taverne sombre flouté */}
          <img
            src={ASSETS_TAVERNE.taverneNuit}
            alt="Taverne Sombre"
            className="absolute inset-0 w-full h-full object-cover blur-[3px] brightness-50 scale-105"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(127,29,29,0.35)_0%,rgba(0,0,0,0.92)_100%)]" />

          {/* Sprite HD du personnage éliminé en grand au centre */}
          <motion.img
            src={spriteUrl}
            alt={victime.nom_affiche}
            initial={{ scale: 1.08, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 h-[23rem] md:h-[28rem] object-contain contrast-125 brightness-90 drop-shadow-[0_15px_35px_rgba(0,0,0,0.95)]"
          />

          {/* Éclaboussure de sang diagonale plein cadre par-dessus le sprite (Vignette 3) */}
          <motion.svg
            viewBox="0 0 900 550"
            initial={{ scale: 0.35, opacity: 0 }}
            animate={{ scale: 1.05, opacity: 0.94 }}
            transition={{ duration: 0.32, type: 'spring', stiffness: 220 }}
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
          >
            <defs>
              <linearGradient id="slash-blood" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#450a0a" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#991b1b" stopOpacity="0.92" />
                <stop offset="100%" stopColor="#dc2626" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            {/* Grande traînée diagonale de gauche-haut vers droite-bas comme sur la Vignette 3 */}
            <path
              d="M-20,30 C180,95 450,240 880,480 L900,550 L640,550 C430,390 190,240 -20,160 Z"
              fill="url(#slash-blood)"
            />
            <path
              d="M60,10 C280,130 560,290 890,430 C810,470 530,320 140,110 Z"
              fill="#b91c1c"
              opacity="0.8"
            />
            {/* Projections de gouttes écarlates */}
            <circle cx="690" cy="340" r="28" fill="#991b1b" />
            <circle cx="750" cy="390" r="20" fill="#dc2626" />
            <circle cx="630" cy="270" r="14" fill="#7f1d1d" />
            <circle cx="240" cy="120" r="18" fill="#991b1b" />
            <circle cx="170" cy="165" r="12" fill="#dc2626" />
            <circle cx="540" cy="230" r="10" fill="#ef4444" />
          </motion.svg>

          {/* Bannière dorée inférieure "[NOM] A ÉTÉ ÉLIMINÉ" + "Il était [RÔLE]" (Vignette 3) */}
          <div className="relative z-30 w-full bg-gradient-to-t from-black via-black/95 to-transparent pt-10 pb-5 px-6 text-center">
            <div className="mx-auto max-w-lg border-y border-amber-500/80 py-3 bg-black/60 backdrop-blur-sm">
              <h3 className="text-2xl md:text-4xl font-bold uppercase tracking-widest text-amber-100 drop-shadow">
                {victime.nom_affiche.toUpperCase()} A ÉTÉ ÉLIMINÉ
              </h3>
            </div>
            <p className="mt-2.5 max-w-lg mx-auto text-right text-base md:text-xl text-amber-100/95 tracking-wide">
              Il était <strong className="text-amber-300">{roleAffiche}</strong>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
