import { AnimatePresence, motion } from 'framer-motion';
import type { TypeActionJeu } from '../types/database.types';

export interface EvenementPotion {
  id: string;
  typeAction: Extract<
    TypeActionJeu,
    'alchimiste_soigner' | 'alchimiste_empoisonner'
  >;
  cibleNom: string;
}

interface PotionPopupProps {
  evenement: EvenementPotion | null;
  onClose: () => void;
}

/**
 * Vignette 5 : POP-UP DE LA POTION DE L'ALCHIMISTE (Effet d'action)
 * Utilise le sprite PNG transparent HD `/sprites/potion.png` (fiole dorée ciselée avec bouchon qui saute et fumée violette)
 * + encadré doré "POTION DE MORT UTILISÉE ! L'Alchimiste empoisonne [Cible]".
 */
export function PotionPopup({ evenement, onClose }: PotionPopupProps) {
  if (!evenement) return null;

  const estMort = evenement.typeAction === 'alchimiste_empoisonner';

  return (
    <AnimatePresence>
      <motion.div
        key={evenement.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer p-4 select-none font-serif"
      >
        <motion.div
          initial={{ scale: 0.78, y: 24, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 16 }}
          className="relative max-w-2xl w-full rounded-2xl bg-black/85 border border-amber-700/70 p-6 md:p-8 shadow-[0_0_110px_rgba(192,38,211,0.55)] flex flex-col sm:flex-row items-center gap-6 overflow-visible"
        >
          {/* Halo magique derrière la fiole */}
          <div
            className={`absolute left-12 top-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-3xl pointer-events-none ${
              estMort ? 'bg-fuchsia-600/35' : 'bg-emerald-500/35'
            }`}
          />

          {/* Sprite PNG transparent HD `/sprites/potion.png` */}
          <motion.img
            src="/sprites/potion.png"
            alt="Potion de l'Alchimiste"
            initial={{ rotate: -6, scale: 0.9 }}
            animate={{
              rotate: [-4, 2, -4],
              y: [0, -8, 0],
              scale: 1,
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className={`relative z-10 w-52 h-64 object-contain drop-shadow-[0_0_30px_rgba(232,121,249,0.65)] shrink-0 ${
              !estMort ? 'hue-rotate-[230deg]' : ''
            }`}
          />

          {/* Encadré ornemental doré de la Vignette 5 */}
          <div className="relative z-10 flex-1 border-2 border-amber-600/75 bg-[#0b070c]/95 rounded-lg p-6 text-center shadow-2xl">
            <span className="absolute top-1.5 left-2 text-amber-400 text-sm">
              ╔
            </span>
            <span className="absolute top-1.5 right-2 text-amber-400 text-sm">
              ╗
            </span>
            <span className="absolute bottom-1.5 left-2 text-amber-400 text-sm">
              ╚
            </span>
            <span className="absolute bottom-1.5 right-2 text-amber-400 text-sm">
              ╝
            </span>

            <h3 className="text-2xl md:text-3xl font-bold uppercase tracking-wider text-amber-100 leading-tight drop-shadow">
              {estMort ? 'POTION DE MORT' : 'POTION DE VIE'}
              <br />
              UTILISÉE !
            </h3>

            <div className="my-3 h-[1px] w-full bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />

            <p className="text-base md:text-xl text-amber-200/95 leading-snug">
              {estMort
                ? `L'Alchimiste empoisonne ${evenement.cibleNom}`
                : `L'Alchimiste sauve ${evenement.cibleNom}`}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
