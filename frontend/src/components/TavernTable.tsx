import { motion } from 'framer-motion';
import {
  Crown,
  Eye,
  Flame,
  FlaskConical,
  Shield,
  Skull,
  Sparkles,
  Swords,
  User,
} from 'lucide-react';
import type {
  JoueurPartie,
  MessagePartie,
  PhasePartie,
  RolePersonnage,
} from '../types/database.types';
import { FantasyPortrait, obtenirIdentiteVisuelle } from './FantasyPortrait';

interface TavernTableProps {
  joueurs: JoueurPartie[];
  phase: PhasePartie;
  tour: number;
  cibleSelectionneeId: string | null;
  onSelectCible: (joueurId: string) => void;
  dernierMessageParJoueur: Record<string, MessagePartie | undefined>;
}

const COORDONNEES_SIEGES: {
  top: string;
  left: string;
  candleOffset: { x: string; y: string };
}[] = [
  { top: '83%', left: '50%', candleOffset: { x: '0px', y: '-68px' } }, // Siège 1 : Joueur Humain (Bas centre)
  { top: '64%', left: '15%', candleOffset: { x: '58px', y: '-22px' } }, // Siège 2 : Bas gauche
  { top: '24%', left: '16%', candleOffset: { x: '58px', y: '22px' } }, // Siège 3 : Haut gauche
  { top: '12%', left: '50%', candleOffset: { x: '0px', y: '68px' } }, // Siège 4 : Haut centre
  { top: '24%', left: '84%', candleOffset: { x: '-58px', y: '22px' } }, // Siège 5 : Haut droite
  { top: '64%', left: '85%', candleOffset: { x: '-58px', y: '-22px' } }, // Siège 6 : Bas droite
];

const PARTICULES_LUCIOLES = [
  { id: 1, left: '18%', top: '75%', delay: 0, size: 5 },
  { id: 2, left: '32%', top: '42%', delay: 0.8, size: 4 },
  { id: 3, left: '68%', top: '38%', delay: 1.5, size: 6 },
  { id: 4, left: '80%', top: '70%', delay: 0.4, size: 4 },
  { id: 5, left: '48%', top: '28%', delay: 2.1, size: 5 },
  { id: 6, left: '25%', top: '20%', delay: 1.2, size: 3 },
  { id: 7, left: '74%', top: '18%', delay: 2.6, size: 5 },
];

export function badgeRole(role: RolePersonnage | null) {
  switch (role) {
    case 'creature':
      return {
        label: 'Créature de la Nuit',
        color:
          'bg-gradient-to-r from-red-950 via-red-900 to-stone-950 text-red-200 border-red-500/80 shadow-[0_0_12px_rgba(220,38,38,0.5)]',
        Icone: Flame,
      };
    case 'inquisiteur':
      return {
        label: 'Grand Inquisiteur',
        color:
          'bg-gradient-to-r from-sky-950 via-blue-900 to-stone-950 text-sky-200 border-sky-400/70 shadow-[0_0_12px_rgba(56,189,248,0.4)]',
        Icone: Eye,
      };
    case 'alchimiste':
      return {
        label: 'Maître Alchimiste',
        color:
          'bg-gradient-to-r from-emerald-950 via-teal-900 to-stone-950 text-emerald-200 border-emerald-400/70 shadow-[0_0_12px_rgba(16,185,129,0.4)]',
        Icone: FlaskConical,
      };
    case 'garde_du_corps':
      return {
        label: 'Garde Royal',
        color:
          'bg-gradient-to-r from-amber-950 via-yellow-900 to-stone-950 text-amber-200 border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.45)]',
        Icone: Shield,
      };
    case 'citoyen':
      return {
        label: 'Franc-Citoyen',
        color:
          'bg-stone-900/95 text-amber-100/90 border-amber-700/50',
        Icone: User,
      };
    default:
      return {
        label: 'Blason Voilé',
        color:
          'bg-stone-950/90 text-stone-400 border-stone-700/70',
        Icone: Sparkles,
      };
  }
}

export function TavernTable({
  joueurs,
  phase,
  tour,
  cibleSelectionneeId,
  onSelectCible,
  dernierMessageParJoueur,
}: TavernTableProps) {
  const estNuit = phase === 'nuit' || phase === 'tour_alchimiste';
  const estVote = phase === 'vote_jour';

  return (
    <div className="relative w-full h-[38rem] md:h-[42rem] flex items-center justify-center select-none overflow-hidden rounded-3xl got-frame bg-[#0a060e]">
      {/* Fond architectural de salle de taverne en pierre & poutres médiévales */}
      <div
        className={`absolute inset-0 transition-all duration-1000 pointer-events-none ${
          estNuit
            ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(88,28,135,0.28)_0%,rgba(15,10,30,0.88)_55%,#040208_100%)]'
            : estVote
              ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(185,28,28,0.28)_0%,rgba(28,10,12,0.88)_55%,#080304_100%)]'
              : 'bg-[radial-gradient(circle_at_50%_50%,rgba(217,119,6,0.25)_0%,rgba(30,18,10,0.88)_58%,#090504_100%)]'
        }`}
      />

      {/* Dallage circulaire médiéval en pierre gravée */}
      <svg
        viewBox="0 0 600 600"
        className="absolute w-[36rem] h-[36rem] md:w-[44rem] md:h-[44rem] opacity-15 pointer-events-none"
      >
        <circle cx="300" cy="300" r="280" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="8 6" />
        <circle cx="300" cy="300" r="235" fill="none" stroke="#d97706" strokeWidth="1" />
        <path d="M300 20 L300 580 M20 300 L580 300 M102 102 L498 498 M498 102 L102 498" stroke="#f59e0b" strokeWidth="0.8" />
      </svg>

      {/* 4 Braseros muraux d'angle (style château Game of Thrones) */}
      {[
        'top-4 left-4',
        'top-4 right-4',
        'bottom-4 left-4',
        'bottom-4 right-4',
      ].map((pos, i) => (
        <div
          key={i}
          className={`
            ${pos}
            pointer-events-none absolute flex items-center justify-center w-10 h-10 rounded-full border border-amber-700/50 bg-stone-950/90 shadow-[0_0_25px_rgba(245,158,11,0.45)]
          `}
        >
          <Flame
            className={`w-5 h-5 animate-pulse ${
              estNuit ? 'text-purple-400' : 'text-amber-400'
            }`}
          />
        </div>
      ))}

      {/* Particules magiques / Braises dorées flottantes (touche féerique Disney) */}
      {PARTICULES_LUCIOLES.map((p) => (
        <motion.div
          key={p.id}
          style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
          animate={{
            y: [0, -28, 0],
            opacity: [0.2, 0.9, 0.2],
            scale: [0.8, 1.3, 0.8],
          }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
          className={`absolute rounded-full pointer-events-none blur-[0.5px] ${
            estNuit
              ? 'bg-purple-300 shadow-[0_0_12px_#c084fc]'
              : 'bg-amber-300 shadow-[0_0_12px_#fbbf24]'
          }`}
        />
      ))}

      {/* GRANDE TABLE RONDE EN CHÊNE MASSIF & FER FORGÉ */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-72 h-72 md:w-96 md:h-96 rounded-full border-[10px] border-[#271409] tavern-oak-surface shadow-[0_0_110px_rgba(217,119,6,0.28),inset_0_0_65px_rgba(0,0,0,0.92)] flex flex-col items-center justify-center text-center p-6"
      >
        {/* Cerclage de fer clouté et runes d'or (Game of Thrones) */}
        <div className="absolute inset-2 rounded-full border-2 border-amber-500/35 pointer-events-none" />
        <div className="absolute inset-6 rounded-full border border-dashed border-amber-400/30 pointer-events-none" />

        {/* Rose des vents et arabesques gravées sur le bois */}
        <svg
          viewBox="0 0 200 200"
          className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] opacity-25 pointer-events-none"
        >
          <polygon
            points="100,8 118,76 188,76 132,116 152,184 100,142 48,184 68,116 12,76 82,76"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.2"
          />
          <circle cx="100" cy="100" r="62" fill="none" stroke="#f59e0b" strokeWidth="1" />
        </svg>

        {/* Objets de taverne posés sur la table : Chopes d'hydromel, Parchemin Royal, Dague */}
        <div
          className="absolute top-7 left-12 text-lg drop-shadow pointer-events-none"
          title="Chope d'hydromel"
        >
          🍺
        </div>
        <div
          className="absolute bottom-8 right-12 text-lg drop-shadow pointer-events-none"
          title="Parchemin du Conseil"
        >
          📜
        </div>
        <div
          className="absolute top-10 right-11 text-base drop-shadow pointer-events-none"
          title="Fiole alchimique"
        >
          🧪
        </div>
        <div
          className="absolute bottom-9 left-12 text-base drop-shadow pointer-events-none"
          title="Dague de serment"
        >
          🗡️
        </div>

        {/* Lanterne Enchantée Centrale (Coeur du Studio Lanterne) */}
        <div className="relative flex items-center justify-center">
          <div
            className={`absolute w-36 h-36 rounded-full blur-2xl animate-lantern ${
              estNuit
                ? 'bg-purple-500/50'
                : estVote
                  ? 'bg-red-500/50'
                  : 'bg-amber-400/55'
            }`}
          />
          <div className="relative z-10 w-18 h-18 rounded-full bg-gradient-to-b from-stone-900 via-stone-950 to-black border-2 border-amber-400/80 flex items-center justify-center shadow-[0_0_35px_rgba(245,158,11,0.65)]">
            <Flame
              className={`w-9 h-9 ${
                estNuit
                  ? 'text-purple-300 drop-shadow-[0_0_12px_#a855f7]'
                  : estVote
                    ? 'text-red-400 drop-shadow-[0_0_12px_#ef4444]'
                    : 'text-amber-300 drop-shadow-[0_0_14px_#fbbf24]'
              }`}
            />
          </div>
        </div>

        {/* Cartouche Héraldique du Tour & Phase */}
        <div className="mt-3 px-3 py-0.5 rounded-full bg-black/65 border border-amber-500/40 text-[10px] font-crest uppercase tracking-[0.22em] text-amber-300">
          Acte {tour} • Table du Conseil
        </div>
        <div className="mt-1 text-base md:text-lg font-got font-bold text-amber-100 uppercase tracking-wider drop-shadow">
          {estNuit
            ? 'Veillée des Ombres'
            : estVote
              ? 'Tribunal du Sang'
              : 'Grand Conseil de la Taverne'}
        </div>
        <p className="text-xs font-story italic text-amber-200/80 mt-0.5 max-w-[14rem]">
          « Choisissez un convive autour du chêne pour l’accuser, le sonder ou le protéger. »
        </p>
      </motion.div>

      {/* LES 6 CONVIVES AUTOUR DE LA TABLE (Blasons Game of Thrones × Portraits Expressifs Disney) */}
      {joueurs.map((j, idx) => {
        const pos = COORDONNEES_SIEGES[idx % COORDONNEES_SIEGES.length];
        const estSelectionne = cibleSelectionneeId === j.id;
        const infoRole = badgeRole(j.role);
        const IconeRole = infoRole.Icone;
        const dernierMsg = dernierMessageParJoueur[j.id];
        const identite = obtenirIdentiteVisuelle(j.nom_affiche, j.est_humain);

        return (
          <motion.div
            key={j.id}
            style={{ top: pos.top, left: pos.left }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: idx * 0.08, type: 'spring', stiffness: 160 }}
            onClick={() => j.est_vivant && onSelectCible(j.id)}
            className={`-translate-x-1/2 -translate-y-1/2 absolute flex flex-col items-center group z-20 ${
              j.est_vivant ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
            }`}
          >
            {/* Bougie personnelle du convive sur le bord de la table */}
            <div
              style={{
                transform: `translate(${pos.candleOffset.x}, ${pos.candleOffset.y})`,
              }}
              className="absolute pointer-events-none flex flex-col items-center"
            >
              {j.est_vivant ? (
                <div className="relative flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-amber-300 blur-[3px] animate-ping opacity-60 absolute -top-1" />
                  <Flame className="w-3.5 h-3.5 text-amber-300 drop-shadow-[0_0_6px_#f59e0b]" />
                  <div className="w-1.5 h-3 bg-amber-100 rounded-xs border border-amber-800/50" />
                </div>
              ) : (
                <div
                  className="text-[10px] text-stone-500 italic"
                  title="Bougie éteinte"
                >
                  💨
                </div>
              )}
            </div>

            {/* Bulle de dialogue sur parchemin enluminé (Style Conte Disney / Parchemin Royal) */}
            {dernierMsg && j.est_vivant && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mb-2.5 max-w-[14.5rem] px-3.5 py-2 rounded-2xl parchment-card text-[#231206] text-xs leading-snug font-story border-2 border-amber-700/80 relative z-30"
              >
                <p className="line-clamp-2 italic font-semibold">
                  « {dernierMsg.contenu} »
                </p>
                {/* Pointe de bulle */}
                <div className="w-3 h-3 rotate-45 bg-[#ebd19e] border-r-2 border-b-2 border-amber-700/80 absolute -bottom-1.5 left-1/2 -translate-x-1/2" />
              </motion.div>
            )}

            {/* Médaillon Héraldique Forgé (Game of Thrones) contenant le Portrait Illustré (Disney) */}
            <div className="relative">
              {/* Halo derrière le médaillon quand sélectionné ou quand il parle */}
              {estSelectionne && (
                <div className="absolute -inset-2 rounded-full bg-red-600/45 blur-md animate-pulse pointer-events-none" />
              )}

              <div
                className={`relative w-18 h-18 md:w-22 md:h-22 rounded-full p-1 transition-all duration-300 bg-gradient-to-b ${identite.couleurBlason} ${
                  estSelectionne
                    ? 'ring-4 ring-red-500 scale-110 shadow-[0_0_35px_rgba(239,68,68,0.9)]'
                    : j.est_humain
                      ? 'ring-3 ring-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.6)] group-hover:scale-105'
                      : 'ring-2 ring-amber-600/60 group-hover:ring-amber-300 group-hover:scale-105 shadow-[0_10px_25px_rgba(0,0,0,0.85)]'
                }`}
              >
                {/* Anneau d'or ciselé intérieur */}
                <div className="w-full h-full rounded-full p-0.5 bg-gradient-to-tr from-amber-900 via-amber-400 to-amber-100">
                  <FantasyPortrait
                    nomAffiche={j.nom_affiche}
                    estHumain={j.est_humain}
                    estVivant={j.est_vivant}
                  />
                </div>

                {/* Épées croisées de ciblage (Game of Thrones) */}
                {estSelectionne && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-br from-red-600 to-red-900 text-amber-100 p-1.5 rounded-full border border-amber-300 shadow-lg">
                    <Swords className="w-4 h-4" />
                  </div>
                )}

                {/* Couronne Royale du Joueur Humain */}
                {j.est_humain && j.est_vivant && (
                  <div className="absolute -top-2.5 -left-2 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-stone-950 p-1.5 rounded-full border border-amber-100 shadow-lg">
                    <Crown className="w-4 h-4" />
                  </div>
                )}

                {/* Sceau de Mort & Griffures Cramoisies si éliminé */}
                {!j.est_vivant && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-950/75 rounded-full border-2 border-red-700">
                    <Skull className="w-9 h-9 text-red-200 drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]" />
                  </div>
                )}
              </div>
            </div>

            {/* Cartouche de Nom en Bronze & Or Ciselé */}
            <div className="mt-1.5 px-3.5 py-0.5 rounded-full bg-gradient-to-b from-stone-900 to-black border border-amber-500/60 text-xs font-crest font-bold text-amber-100 shadow-[0_4px_12px_rgba(0,0,0,0.9)] whitespace-nowrap flex items-center gap-1.5">
              <span>{j.nom_affiche}</span>
              {j.est_humain && (
                <span className="text-[10px] font-ui font-extrabold text-amber-400">
                  (Vous)
                </span>
              )}
            </div>

            {/* Titre de Maison Féodale */}
            <div className="text-[10px] font-story italic text-amber-300/85 drop-shadow">
              {identite.surnomMaison}
            </div>

            {/* Blason de Rôle (visible pour soi-même, allié Créature ou joueur mort) */}
            <div
              className={`mt-0.5 px-2.5 py-0.5 rounded-full border text-[10px] font-crest uppercase tracking-wider flex items-center gap-1 ${infoRole.color}`}
            >
              <IconeRole className="w-3 h-3" />
              <span>{infoRole.label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
