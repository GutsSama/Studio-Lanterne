import { useEffect, useRef, useState } from 'react';
import { Flame, ShieldCheck, Sparkles } from 'lucide-react';
import {
  resoudreAvatarHumain,
  type RolePersonnage,
} from '../types/database.types';

interface AiActDialogProps {
  ouvert: boolean;
  onLancerPartie: (
    nomHumain: string,
    consentementAiAct: boolean,
    roleForce: RolePersonnage | null,
    sexe: 'homme' | 'femme'
  ) => Promise<void>;
}

const CONVIVES_IA_TAVERNE = [
  'Gérard le Râleur',
  'Elena la Stratège',
  'Bob le Rigolo',
  'Sœur Béatrice la Mystique',
  'Lucas le Paranoïaque',
];

/**
 * Modale d'entrée utilisant l'élément HTML natif `<dialog>` (Modern Web Guidance : dialog).
 * Applique le style Glassmorphism sombre (`bg-black/60 backdrop-blur-md`, `border-amber-900/50`, `font-serif`, `text-amber-100`)
 * et les portraits humains ronds (`border-4 border-amber-900`).
 */
export function AiActDialog({ ouvert, onLancerPartie }: AiActDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [nomHumain, setNomHumain] = useState('');
  const [sexe, setSexe] = useState<'homme' | 'femme'>('homme');
  const [roleForce, setRoleForce] = useState<RolePersonnage | ''>('');
  const [consentement, setConsentement] = useState(true);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (ouvert && !dialog.open) {
      dialog.showModal();
    } else if (!ouvert && dialog.open) {
      dialog.close();
    }
  }, [ouvert]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentement) {
      setErreur(
        'Vous devez accepter la notice de transparence IA (AI Act) pour rejoindre la table.'
      );
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      await onLancerPartie(
        nomHumain.trim(),
        consentement,
        roleForce === '' ? null : roleForce,
        sexe
      );
    } catch (err) {
      setErreur(
        err instanceof Error
          ? err.message
          : 'Impossible de lancer la partie. Vérifiez que le backend FastAPI tourne sur le port 8000.'
      );
    } finally {
      setChargement(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        if (ouvert) e.preventDefault();
      }}
      className="m-auto max-w-3xl w-[96%] rounded-3xl border-2 border-amber-600/70 bg-[#0d0705]/95 backdrop-blur-xl text-amber-100 font-serif p-0 shadow-[0_35px_120px_rgba(0,0,0,0.98),0_0_80px_rgba(217,119,6,0.3)] overflow-hidden"
    >
      <div className="p-6 md:p-10 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="p-4 rounded-full bg-amber-950/90 border-2 border-amber-500 text-amber-400 mb-3 shadow-[0_0_25px_rgba(245,158,11,0.4)]">
            <Flame className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-widest text-amber-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            Créatures de la Nuit
          </h1>
          <p className="text-sm md:text-base text-amber-200/80 italic mt-2">
            Prenez place à la table de la taverne face à 5 convives IA.
          </p>
        </div>

        {/* Aperçu des 5 portraits des convives IA */}
        <div className="p-4 rounded-2xl bg-black/70 border border-amber-900/60 shadow-inner">
          <div className="text-[11px] uppercase tracking-widest text-amber-300/80 text-center font-bold mb-3">
            Les 5 Convives autour de la table
          </div>
          <div className="grid grid-cols-5 gap-3 md:gap-4">
            {CONVIVES_IA_TAVERNE.map((nom, i) => {
              const estLucasNom = nom.toLowerCase().includes('lucas');
              return (
                <div key={nom} className="flex flex-col items-center text-center">
                  <div className="relative w-14 h-14 md:w-18 md:h-18 rounded-full border-4 border-amber-900 overflow-hidden bg-[radial-gradient(circle_at_center,#3b2313_0%,#0c0705_100%)] shadow-lg">
                    <img
                      src={resoudreAvatarHumain({
                        nom_affiche: nom,
                        est_humain: false,
                        numero_siege: i + 2,
                      })}
                      alt={nom}
                      className={`w-full h-full object-cover object-top ${
                        estLucasNom
                          ? 'scale-160 translate-y-2'
                          : 'scale-125 translate-y-1'
                      }`}
                    />
                  </div>
                  <span className="mt-1.5 text-xs font-semibold text-amber-200 truncate w-full">
                    {nom.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sélection du Sexe / Avatar du joueur sous forme de deux grandes cartes immersives */}
          <div>
            <label className="block text-xs md:text-sm uppercase tracking-wider text-amber-300 font-bold mb-2.5">
              1. Choisissez votre Avatar (Sexe / Apparence)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSexe('homme')}
                className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left cursor-pointer ${
                  sexe === 'homme'
                    ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.35)]'
                    : 'bg-black/60 border-amber-900/60 hover:bg-black/80 hover:border-amber-700/60'
                }`}
              >
                <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-amber-700 overflow-hidden bg-black/90 shrink-0 shadow-lg">
                  <img
                    src="/sprites/humain.png"
                    alt="Voyageur"
                    className="w-full h-full object-cover object-top scale-120 translate-y-1.5"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base md:text-lg font-bold text-amber-100">
                    🧝‍♂️ Voyageur (Homme)
                  </div>
                  <p className="text-xs text-amber-200/70 mt-1 italic leading-snug">
                    Le voyageur solitaire arrivé à la taverne à la nuit tombée.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSexe('femme')}
                className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left cursor-pointer ${
                  sexe === 'femme'
                    ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.35)]'
                    : 'bg-black/60 border-amber-900/60 hover:bg-black/80 hover:border-amber-700/60'
                }`}
              >
                <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-amber-700 overflow-hidden bg-black/90 shrink-0 shadow-lg">
                  <img
                    src="/sprites/humaine.png"
                    alt="Voyageuse"
                    className="w-full h-full object-cover object-top scale-120 translate-y-1.5"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base md:text-lg font-bold text-amber-100">
                    🧝‍♀️ Voyageuse (Femme)
                  </div>
                  <p className="text-xs text-amber-200/70 mt-1 italic leading-snug">
                    La voyageuse intrépide venue percer les mystères de la taverne.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs md:text-sm uppercase tracking-wider text-amber-300 font-bold mb-2">
                2. Votre Nom autour de la table
              </label>
              <input
                type="text"
                value={nomHumain}
                onChange={(e) => setNomHumain(e.target.value)}
                placeholder="Entrez votre prénom ou titre..."
                className="w-full rounded-2xl bg-black/80 border-2 border-amber-900/70 px-4 py-3.5 text-base md:text-lg text-amber-100 focus:outline-none focus:border-amber-500 shadow-inner"
                minLength={2}
                maxLength={30}
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs md:text-sm uppercase tracking-wider text-amber-300 font-bold mb-2">
                3. Rôle à la table (Strictement conforme au Backend)
              </label>
              <select
                value={roleForce}
                onChange={(e) =>
                  setRoleForce(e.target.value as RolePersonnage | '')
                }
                className="w-full rounded-2xl bg-black/80 border-2 border-amber-900/70 px-4 py-3.5 text-base text-amber-100 focus:outline-none focus:border-amber-500 shadow-inner cursor-pointer"
              >
                <option value="">🎲 Tirage Aléatoire (Recommandé)</option>
                <option value="citoyen">Citoyen (citoyen)</option>
                <option value="creature">Créature de la Nuit (creature)</option>
                <option value="inquisiteur">Inquisiteur (inquisiteur)</option>
                <option value="alchimiste">Alchimiste (alchimiste)</option>
                <option value="garde_du_corps">
                  Garde du Corps (garde_du_corps)
                </option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/60 border border-amber-900/60 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs md:text-sm font-bold uppercase tracking-wider">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>Transparence IA (AI Act Art. 50)</span>
            </div>
            <label className="flex items-center gap-3 cursor-pointer text-xs md:text-sm text-amber-100/90">
              <input
                type="checkbox"
                checked={consentement}
                onChange={(e) => setConsentement(e.target.checked)}
                className="w-4 h-4 rounded border-amber-700 text-amber-600 focus:ring-amber-500"
              />
              <span>
                Je comprends que j’interagis avec 5 agents d’Intelligence
                Artificielle générative.
              </span>
            </label>
          </div>

          {erreur && (
            <div className="p-4 rounded-2xl bg-red-950/90 border-2 border-red-700 text-red-200 text-xs md:text-sm">
              {erreur}
            </div>
          )}

          <button
            type="submit"
            disabled={chargement}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 text-amber-50 font-extrabold text-base md:text-lg uppercase tracking-wider border-2 border-amber-400/80 shadow-[0_0_35px_rgba(217,119,6,0.6)] flex items-center justify-center gap-2.5 transition cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            <span>
              {chargement
                ? 'Préparation de la Table...'
                : 'S’asseoir à la Table de la Taverne'}
            </span>
          </button>
        </form>
      </div>
    </dialog>
  );
}
