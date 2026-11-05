import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ASSETS_TAVERNE } from '../config/personnages';
import type { PhasePartie } from '../types/database.types';

interface PhaseTransitionProps {
  phase: PhasePartie | null;
  tour: number;
  onComplete: () => void;
}

/**
 * Vignettes 1 & 2 avec les vrais interludes HD :
 * - Aube (`debat_jour`) : `/sprites/interlude-aube.jpg` + "L'AUBE SE LÈVE..." + "Débat du Jour"
 * - Crépuscule / Nuit (`nuit` / `tour_alchimiste`) : `/sprites/interlude-nuit.jpg` + "LA NUIT TOMBE..." + "Fermez vos portes, les Créatures se réveillent."
 */
export function PhaseTransition({
  phase,
  tour,
  onComplete,
}: PhaseTransitionProps) {
  useEffect(() => {
    if (!phase) return;
    const timer = window.setTimeout(() => {
      onComplete();
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [phase, tour, onComplete]);

  if (!phase) return null;

  const estJour = phase === 'debat_jour';

  const bgImage = estJour
    ? ASSETS_TAVERNE.interludeAube
    : ASSETS_TAVERNE.interludeNuit;

  const titre = estJour
    ? "L'AUBE SE LÈVE..."
    : phase === 'tour_alchimiste'
      ? "L'ALCHIMISTE S'ÉVEILLE..."
      : phase === 'vote_jour'
        ? 'LE CONSEIL VOTE...'
        : phase === 'tour_garde_du_corps'
          ? 'DERNIER SOUFFLE...'
          : 'LA NUIT TOMBE...';

  const texteBarre = estJour
    ? 'Débat du Jour'
    : phase === 'tour_alchimiste'
      ? "L'Alchimiste choisit d'utiliser ses fioles de Vie ou de Mort."
      : phase === 'vote_jour'
        ? 'Désignez le suspect à éliminer autour de la table.'
        : phase === 'tour_garde_du_corps'
          ? 'Le Garde du Corps dégaine une dernière fois.'
          : 'Fermez vos portes, les Créatures se réveillent.';

  return (
    <AnimatePresence>
      <motion.div
        key={`${phase}-${tour}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        onClick={onComplete}
        className="fixed inset-0 z-50 flex flex-col items-center justify-between py-12 px-6 cursor-pointer select-none overflow-hidden font-serif bg-black"
      >
        {/* Image de fond HD `/sprites/aube.jpg` ou `/sprites/nuit.jpg` avec léger zoom cinématique */}
        <motion.img
          src={bgImage}
          alt={titre}
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 3.6, ease: 'easeOut' }}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Vignette radiale pour faire ressortir le titre doré exactement comme sur la maquette */}
        <div
          className={`absolute inset-0 ${
            estJour
              ? 'bg-[radial-gradient(circle_at_center,rgba(20,12,4,0.35)_0%,rgba(0,0,0,0.72)_100%)]'
              : 'bg-[radial-gradient(circle_at_center,rgba(10,14,28,0.42)_0%,rgba(0,0,0,0.82)_100%)]'
          }`}
        />

        <div className="relative z-10 text-xs uppercase tracking-[0.3em] text-amber-200/85 drop-shadow">
          Créatures de la Nuit • Tour {tour}
        </div>

        {/* Bandeau central avec ornements dorés (Vignettes 1 & 2) */}
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.94 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.55 }}
          className="relative z-10 flex flex-col items-center text-center my-auto px-8 py-6 rounded-3xl bg-black/35 backdrop-blur-[2px]"
        >
          {/* Filigrane supérieur */}
          <svg viewBox="0 0 400 28" className="w-72 md:w-96 h-7 mb-2">
            <line
              x1="10"
              y1="14"
              x2="165"
              y2="14"
              stroke="#eab308"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
            <polygon points="200,3 210,14 200,25 190,14" fill="#fde047" />
            <circle cx="178" cy="14" r="3" fill="#eab308" />
            <circle cx="222" cy="14" r="3" fill="#eab308" />
            <line
              x1="235"
              y1="14"
              x2="390"
              y2="14"
              stroke="#eab308"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
          </svg>

          <h2 className="text-4xl md:text-6xl font-bold uppercase tracking-widest text-amber-100 drop-shadow-[0_6px_24px_rgba(0,0,0,0.95)]">
            {titre}
          </h2>

          {/* Filigrane inférieur */}
          <svg viewBox="0 0 400 28" className="w-72 md:w-96 h-7 mt-2">
            <line
              x1="10"
              y1="14"
              x2="165"
              y2="14"
              stroke="#eab308"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
            <polygon points="200,5 208,14 200,23 192,14" fill="#eab308" />
            <circle cx="178" cy="14" r="3" fill="#fde047" />
            <circle cx="222" cy="14" r="3" fill="#fde047" />
            <line
              x1="235"
              y1="14"
              x2="390"
              y2="14"
              stroke="#eab308"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
          </svg>
        </motion.div>

        {/* Boîte inférieure sombre avec barre de progression dorée (Vignettes 1 & 2) */}
        <div className="relative z-10 w-full max-w-md bg-[#11131c]/90 backdrop-blur-md border border-amber-600/75 rounded shadow-[0_12px_40px_rgba(0,0,0,0.95)] overflow-hidden">
          <div className="px-6 py-3.5 text-center text-sm md:text-base text-amber-100 tracking-wide">
            {texteBarre}
          </div>
          <div className="h-1.5 w-full bg-stone-900">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 3.4, ease: 'linear' }}
              className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200 shadow-[0_0_12px_#fbbf24]"
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
