import { AnimatePresence, motion } from 'framer-motion';
import {
  Crown,
  Flame,
  MessageSquare,
  Skull,
  Target,
} from 'lucide-react';
import {
  ASSETS_TAVERNE,
  getBadgeRole,
  SIEGES_TAVERNE,
} from '../config/personnages';
import {
  resoudreAvatarHumain,
  type JoueurPartie,
  type MessagePartie,
  type PhasePartie,
  type RolePersonnage,
} from '../types/database.types';

interface GameTableProps {
  joueurs: JoueurPartie[];
  phase: PhasePartie;
  tour: number;
  cibleSelectionneeId: string | null;
  onSelectCible: (joueurId: string) => void;
  dernierMessageParJoueur: Record<string, MessagePartie | undefined>;
}

function EmptyChair({
  nom,
  role,
}: {
  nom: string;
  role: RolePersonnage | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0.4, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex flex-col items-center select-none"
    >
      <img
        src={ASSETS_TAVERNE.chaiseVide}
        alt={`Chaise vide de ${nom}`}
        className="w-28 h-36 md:w-36 md:h-44 object-contain brightness-70 contrast-125 drop-shadow-[0_12px_25px_rgba(0,0,0,0.95)]"
      />
      {/* Plaque d'élimination fixée au dossier de la chaise vide */}
      <div className="absolute top-2 px-2.5 py-0.5 rounded-full bg-black/90 border border-red-900/80 text-stone-300 text-[10px] font-serif shadow-xl flex items-center gap-1.5 whitespace-nowrap">
        <Skull className="w-3 h-3 text-red-500 animate-pulse" />
        <span className="line-through text-stone-300 font-bold">{nom.split(' ')[0]}</span>
        {role && (
          <span className="text-red-400 font-semibold">({role.replaceAll('_', ' ')})</span>
        )}
      </div>
    </motion.div>
  );
}

export function GameTable({
  joueurs,
  phase,
  tour,
  cibleSelectionneeId,
  onSelectCible,
  dernierMessageParJoueur,
}: GameTableProps) {
  const estNuit = phase === 'nuit' || phase === 'tour_alchimiste';

  // Trouver qui a parlé le plus récemment pour lui donner l'animation d'orateur actif
  const idDernierOrateur = Object.values(dernierMessageParJoueur)
    .filter((m): m is MessagePartie => Boolean(m))
    .sort(
      (a, b) =>
        new Date(b.cree_le).getTime() - new Date(a.cree_le).getTime()
    )[0]?.joueur_emetteur_id;

  return (
    <div className="relative w-full rounded-2xl border-2 border-amber-900/70 bg-[#090503] shadow-[0_25px_85px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col select-none font-serif">
      {/* =====================================================================
          1. SCÈNE EN COUCHES (LAYERS) : TAVERNE EN VRAI DÉCOR HD + CHAISES + PERSONNAGES + TABLE AU PREMIER PLAN
         ===================================================================== */}
      <div className="relative w-full h-[28rem] md:h-[34rem] overflow-hidden">
        {/* COUCHE 0 : Décor intérieur authentique de la Taverne HD (Jour ou Nuit) */}
        <motion.img
          key={estNuit ? 'taverne-nuit' : 'taverne-jour'}
          src={estNuit ? ASSETS_TAVERNE.taverneNuit : ASSETS_TAVERNE.taverneJour}
          alt="Intérieur de la Taverne"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9 }}
          className="absolute inset-0 w-full h-full object-cover scale-100 transition-all duration-1000"
        />

        {/* Ambiance d'éclairage radial et feutré de taverne dark fantasy */}
        <div
          className={`absolute inset-0 transition-colors duration-1000 ${
            estNuit
              ? 'bg-[radial-gradient(circle_at_50%_45%,rgba(14,18,36,0.35)_0%,rgba(6,4,3,0.85)_72%,#040202_100%)]'
              : 'bg-[radial-gradient(circle_at_50%_45%,rgba(251,191,36,0.12)_0%,rgba(15,9,5,0.78)_72%,#070403_100%)]'
          }`}
        />

        {/* Particules d'étincelles / braises flottant doucement */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/3 w-1.5 h-1.5 rounded-full bg-amber-400/60 blur-[1px] animate-pulse" />
          <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-orange-400/50 blur-[1px] animate-ping" />
          <div className="absolute top-1/2 left-1/5 w-1 h-1 rounded-full bg-amber-300/70 animate-pulse" />
        </div>

        {/* Cartouche supérieur doré de Phase & Tour */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-amber-600/70 text-center shadow-[0_4px_25px_rgba(0,0,0,0.8)] flex items-center gap-2.5">
          <Flame
            className={`w-4 h-4 ${
              estNuit ? 'text-sky-300 animate-pulse' : 'text-amber-400'
            }`}
          />
          <span className="text-xs md:text-sm font-bold uppercase tracking-widest text-amber-100">
            Tour {tour} —{' '}
            {phase === 'debat_jour'
              ? 'Débat du Jour'
              : phase === 'vote_jour'
                ? 'Vote du Conseil'
                : phase === 'tour_alchimiste'
                  ? 'Tour de l’Alchimiste'
                  : phase === 'tour_garde_du_corps'
                    ? 'Dernier Souffle du Garde'
                    : 'Nuit des Créatures'}
          </span>
        </div>

        {/* COUCHE 1 & 2 : LES 6 SIÈGES DE LA TABLE (Chaise en bois `/sprites/chaise-vide.png` + Sprite Personnage HD) */}
        {joueurs.map((j, idx) => {
          const seat = SIEGES_TAVERNE[idx % SIEGES_TAVERNE.length];
          const estSelectionne = cibleSelectionneeId === j.id;
          const dernierMsg = dernierMessageParJoueur[j.id];
          const spriteUrl = resoudreAvatarHumain(j);
          const estEnTrainDeParler = idDernierOrateur === j.id;
          // Rééquilibrage morphologique de Lucas (+30% en CSS et recentrage)
          const estLucas = j.nom_affiche.toLowerCase().includes('lucas');

          return (
            <div
              key={j.id}
              style={{
                left: seat.left,
                top: seat.top,
                zIndex: estSelectionne ? 28 : estEnTrainDeParler ? 26 : seat.zIndex,
                transform: `translate(-50%, -50%) scale(${seat.scale})`,
              }}
              onClick={() => j.est_vivant && onSelectCible(j.id)}
              className={`absolute flex flex-col items-center ${
                j.est_vivant ? 'cursor-pointer group' : 'cursor-not-allowed'
              }`}
            >
              {/* Bulle de dialogue style parchemin au-dessus du personnage */}
              <AnimatePresence>
                {dernierMsg && j.est_vivant && (
                  <motion.div
                    key={dernierMsg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className={`mb-1 max-w-[14rem] px-3.5 py-2 rounded-xl backdrop-blur-md text-xs leading-snug shadow-[0_10px_30px_rgba(0,0,0,0.95)] z-40 border ${
                      estEnTrainDeParler
                        ? 'bg-[#18110b]/95 border-amber-400 text-amber-50 ring-2 ring-amber-500/40'
                        : 'bg-black/90 border-amber-800/70 text-amber-100'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-300 mb-0.5">
                      <MessageSquare className="w-2.5 h-2.5" />
                      <span>{j.nom_affiche.split(' ')[0]}</span>
                    </div>
                    <p className="line-clamp-2 italic font-serif">
                      « {dernierMsg.contenu} »
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Si le joueur est éliminé (`!j.est_vivant`) : le sprite disparaît et laisse `<EmptyChair />` */}
              {!j.est_vivant ? (
                <EmptyChair nom={j.nom_affiche} role={j.role} />
              ) : (
                <div className="relative flex flex-col items-center">
                  {/* Chaise en bois placée derrière le buste du personnage vivant */}
                  <img
                    src={ASSETS_TAVERNE.chaiseVide}
                    alt="Chaise"
                    className="absolute top-5 w-28 h-36 md:w-34 md:h-42 object-contain brightness-50 contrast-125 pointer-events-none"
                  />

                  {/* Halo de sélection ou d'orateur actif */}
                  {estSelectionne && (
                    <div className="absolute inset-2 rounded-full bg-red-600/50 blur-xl animate-pulse pointer-events-none" />
                  )}
                  {estEnTrainDeParler && !estSelectionne && (
                    <div className="absolute inset-1 rounded-full bg-amber-400/35 blur-xl animate-pulse pointer-events-none" />
                  )}

                  {/* Sprite PNG transparent HD du personnage assis à table */}
                  <motion.img
                    src={spriteUrl}
                    alt={j.nom_affiche}
                    animate={{
                      y: estLucas
                        ? estEnTrainDeParler
                          ? [-8, -13, -8]
                          : [-8, -11, -8]
                        : estEnTrainDeParler
                          ? [0, -5, 0]
                          : [0, -3, 0],
                      scale: estEnTrainDeParler ? 1.05 : 1.0,
                    }}
                    transition={{
                      duration: estEnTrainDeParler ? 2.2 : 3.5,
                      repeat: Infinity,
                      delay: idx * 0.35,
                      ease: 'easeInOut',
                    }}
                    className={`relative z-10 object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.95)] transition-all duration-300 ${
                      estLucas
                        ? 'w-42 h-52 md:w-58 md:h-70 -translate-y-5 scale-110'
                        : 'w-32 h-40 md:w-44 md:h-54'
                    } ${
                      estSelectionne
                        ? 'scale-115 brightness-115 ring-2 ring-red-500/80 rounded-full'
                        : 'group-hover:scale-105 group-hover:brightness-110'
                    }`}
                  />

                  {/* Badge du nom sous le buste avec couronne pour le joueur humain */}
                  <div
                    className={`-mt-6 relative z-20 px-3 py-0.5 rounded-full border text-[11px] font-bold shadow-xl flex items-center gap-1.5 whitespace-nowrap ${
                      estSelectionne
                        ? 'bg-red-900/95 border-amber-300 text-amber-100 ring-2 ring-red-500'
                        : j.est_humain
                          ? 'bg-amber-800/95 border-amber-400 text-amber-50 ring-1 ring-amber-400/50'
                          : 'bg-black/85 border-amber-800/80 text-amber-100'
                    }`}
                  >
                    {j.est_humain && (
                      <Crown className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    {estSelectionne && (
                      <Target className="w-3.5 h-3.5 text-red-300" />
                    )}
                    <span>{j.nom_affiche.split(' ')[0]}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* COUCHE 3 (PREMIER PLAN `z-30`) : LA VRAIE TABLE RONDE EN BOIS (`/sprites/table.png`) DEVANT LES CONVIVES */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 z-30 w-[36rem] md:w-[48rem] pointer-events-none flex flex-col items-center">
          {/* Lueur vacillante de bougie / lanterne au centre de la table */}
          <div
            className={`absolute top-12 left-1/2 -translate-x-1/2 w-60 h-36 rounded-full blur-3xl ${
              estNuit ? 'bg-amber-500/40 animate-pulse' : 'bg-amber-400/45'
            }`}
          />

          <img
            src={ASSETS_TAVERNE.table}
            alt="Table ronde en bois"
            className={`w-full h-auto object-contain drop-shadow-[0_-12px_40px_rgba(0,0,0,0.95)] transition-all duration-1000 ${
              estNuit ? 'brightness-80 contrast-120' : 'brightness-95 contrast-110'
            }`}
          />

          {/* Trace de sang sur le bois de la table si au moins un joueur est mort (Vignette 4) */}
          {joueurs.some((j) => !j.est_vivant) && (
            <div className="absolute top-[43%] left-[27%] w-32 h-12 rounded-full bg-red-950/80 blur-[2px] -rotate-6" />
          )}
        </div>
      </div>

      {/* =====================================================================
          2. GALERIE INFÉRIEURE : MÉDAILLONS RONDS AVEC `border-4 border-amber-900`, RUBANS & ORBES (Bas de la Vignette 4)
         ===================================================================== */}
      <div className="relative z-40 bg-gradient-to-t from-black via-[#110a06] to-[#180f09] border-t border-amber-900/60 px-4 py-3.5 flex items-center justify-center gap-4 md:gap-7 overflow-x-auto">
        {joueurs.map((j, idx) => {
          const spriteUrl = resoudreAvatarHumain(j);
          const estSelectionne = cibleSelectionneeId === j.id;
          const infoRole = getBadgeRole(j.role);

          const classeRuban = !j.est_vivant
            ? 'bg-stone-800/95 border-stone-600 text-stone-300'
            : j.est_humain || idx % 2 === 0
              ? 'bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 border-amber-400/80 text-amber-50'
              : 'bg-gradient-to-r from-sky-900 via-blue-800 to-sky-900 border-sky-400/80 text-sky-50';

          return (
            <button
              key={j.id}
              type="button"
              disabled={!j.est_vivant}
              onClick={() => j.est_vivant && onSelectCible(j.id)}
              className={`flex flex-col items-center group transition ${
                j.est_vivant
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-75'
              }`}
            >
              {/* Médaillon rond avec `border-4 border-amber-900` et portrait du personnage */}
              <div
                className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-4 ${
                  estSelectionne
                    ? 'border-red-500 ring-4 ring-red-500/50 scale-105'
                    : !j.est_vivant
                      ? 'border-stone-600'
                      : 'border-amber-900 group-hover:border-amber-500'
                } overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.95)] bg-[radial-gradient(circle_at_center,#3b2313_0%,#0c0705_100%)] transition-all`}
              >
                <img
                  src={spriteUrl}
                  alt={j.nom_affiche}
                  className={`w-full h-full object-cover object-top ${
                    j.nom_affiche.toLowerCase().includes('lucas')
                      ? 'scale-165 translate-y-3'
                      : 'scale-125 translate-y-1.5'
                  } ${
                    !j.est_vivant
                      ? 'grayscale contrast-150 brightness-50'
                      : ''
                  }`}
                />
              </div>

              {/* Ruban du nom chevauchant le bas du médaillon (Vignette 4) */}
              <div
                className={`-mt-2.5 relative z-10 px-3 py-0.5 rounded border text-xs font-bold tracking-wide shadow-md whitespace-nowrap ${classeRuban}`}
              >
                {j.nom_affiche.split(' ')[0]}
              </div>

              {/* Mention "Éliminé" ou Orbe de rôle officiel (Vignette 4) */}
              {!j.est_vivant ? (
                <span className="mt-1 text-xs italic text-stone-400">
                  Éliminé
                </span>
              ) : (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className={`w-3.5 h-3.5 rounded-full border ${infoRole.orbe}`}
                    title={infoRole.label}
                  />
                  {j.role && (
                    <span className="text-[10px] text-amber-200/80">
                      {infoRole.label}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
