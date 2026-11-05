import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Coins,
  Cpu,
  Eye,
  Flame,
  FlaskConical,
  Moon,
  Play,
  RotateCcw,
  Scale,
  Shield,
  Skull,
  Sparkles,
  Sun,
  Trophy,
  Wand2,
} from 'lucide-react';
import { AiActDialog } from './components/AiActDialog';
import { BloodSplatter } from './components/BloodSplatter';
import { ChatPanel } from './components/ChatPanel';
import { GameTable } from './components/GameTable';
import { PhaseTransition } from './components/PhaseTransition';
import { PotionPopup, type EvenementPotion } from './components/PotionPopup';
import { ASSETS_TAVERNE } from './config/personnages';
import { useGameRealtime } from './hooks/useGameRealtime';
import {
  creerNouvellePartie,
  envoyerMessageJoueur,
  executerActionSpeciale,
  simulerTourIA,
  voterContreJoueur,
} from './services/api';
import type {
  CanalMessage,
  EtatPartieClient,
  JoueurPartie,
  MessagePartie,
  PhasePartie,
  RolePersonnage,
  TypeActionJeu,
} from './types/database.types';

export function App() {
  const [partie, setPartie] = useState<EtatPartieClient | null>(null);
  // La modale de saisie du nom s'ouvre dès le début du jeu
  const [dialogOuvert, setDialogOuvert] = useState(true);
  const [cibleId, setCibleId] = useState<string | null>(null);
  const [phaseTransition, setPhaseTransition] = useState<PhasePartie | null>(
    null
  );
  const [victimeCinematique, setVictimeCinematique] =
    useState<JoueurPartie | null>(null);
  const [evenementPotion, setEvenementPotion] =
    useState<EvenementPotion | null>(null);
  const [simulationEnCours, setSimulationEnCours] = useState(false);
  const [banniereInfo, setBanniereInfo] = useState<string | null>(null);
  const [outilsDemoOuvert, setOutilsDemoOuvert] = useState(false);
  const [modalFinPartieFermee, setModalFinPartieFermee] = useState(false);

  const vivantsPrecedentsRef = useRef<Set<string>>(new Set());

  const joueurHumain = useMemo(
    () => partie?.joueurs.find((j) => j.est_humain) ?? null,
    [partie]
  );

  const cibleSelectionnee = useMemo(
    () => partie?.joueurs.find((j) => j.id === cibleId) ?? null,
    [partie, cibleId]
  );

  const dernierMessageParJoueur = useMemo(() => {
    const map: Record<string, MessagePartie | undefined> = {};
    if (!partie) return map;
    for (const m of partie.messages) {
      if (m.joueur_emetteur_id && m.canal !== 'systeme') {
        map[m.joueur_emetteur_id] = m;
      }
    }
    return map;
  }, [partie]);

  const handleRealtimePhaseChange = useCallback(
    (nouvellePhase: PhasePartie) => {
      setPhaseTransition(nouvellePhase);
    },
    []
  );

  const handleRealtimePlayerEliminated = useCallback(
    (victime: JoueurPartie) => {
      setVictimeCinematique(victime);
    },
    []
  );

  const handleRealtimePotion = useCallback((evt: EvenementPotion) => {
    setEvenementPotion(evt);
  }, []);

  const handleRealtimeNewMessage = useCallback((msg: MessagePartie) => {
    setPartie((prev) => {
      if (!prev) return prev;
      if (prev.messages.some((m) => m.id === msg.id)) return prev;
      return { ...prev, messages: [...prev.messages, msg] };
    });
  }, []);

  useGameRealtime({
    partie,
    onPhaseChange: handleRealtimePhaseChange,
    onPlayerEliminated: handleRealtimePlayerEliminated,
    onPotionAction: handleRealtimePotion,
    onNewMessage: handleRealtimeNewMessage,
  });

  const handleLancerPartie = useCallback(
    async (
      nomHumain: string,
      consentementAiAct: boolean,
      roleForce: RolePersonnage | null,
      sexe: 'homme' | 'femme' = 'homme'
    ) => {
      const nouvelEtat = await creerNouvellePartie(
        nomHumain,
        consentementAiAct,
        roleForce
      );
      // Associer le sexe choisi au joueur humain
      nouvelEtat.joueurs = nouvelEtat.joueurs.map((j) =>
        j.est_humain ? { ...j, sexe } : j
      );
      vivantsPrecedentsRef.current = new Set(
        nouvelEtat.joueurs.filter((j) => j.est_vivant).map((j) => j.id)
      );
      setPartie(nouvelEtat);
      setDialogOuvert(false);
      setModalFinPartieFermee(false);
      setCibleId(null);
      setBanniereInfo(
        `Table de la Taverne prête pour ${nomHumain} (${sexe === 'femme' ? 'Voyageuse' : 'Voyageur'}, Rôle : ${
          nouvelEtat.joueurs.find((j) => j.est_humain)?.role ?? 'citoyen'
        }). Cliquez sur « Faire jouer les 5 Agents IA » ou échangez dans le chat !`
      );
    },
    []
  );

  function appliquerNouvelEtat(
    nouvelEtat: EtatPartieClient,
    anciennePhase?: PhasePartie,
    evenementsTexte: string[] = []
  ) {
    for (const txt of evenementsTexte) {
      const lower = txt.toLowerCase();
      if (lower.includes('empoisonn')) {
        setEvenementPotion({
          id: crypto.randomUUID(),
          typeAction: 'alchimiste_empoisonner',
          cibleNom: txt,
        });
      } else if (lower.includes('potion de vie') || lower.includes('sauv')) {
        setEvenementPotion({
          id: crypto.randomUUID(),
          typeAction: 'alchimiste_soigner',
          cibleNom: txt,
        });
      }
    }

    const nouveauxMorts = nouvelEtat.joueurs.filter(
      (j) => !j.est_vivant && vivantsPrecedentsRef.current.has(j.id)
    );
    vivantsPrecedentsRef.current = new Set(
      nouvelEtat.joueurs.filter((j) => j.est_vivant).map((j) => j.id)
    );

    if (nouveauxMorts.length > 0) {
      setVictimeCinematique(nouveauxMorts[0]);
    } else if (anciennePhase && anciennePhase !== nouvelEtat.phase_actuelle) {
      setPhaseTransition(nouvelEtat.phase_actuelle);
    }

    setPartie(nouvelEtat);
  }

  async function handleSimulerTourIA() {
    if (!partie || simulationEnCours) return;
    setSimulationEnCours(true);
    setBanniereInfo('Les 5 convives IA délibèrent autour de la table...');
    try {
      const anciennePhase = partie.phase_actuelle;
      const res = await simulerTourIA(partie.id);
      appliquerNouvelEtat(res.etat, anciennePhase, res.evenements);
      setBanniereInfo(
        res.evenements.length > 0
          ? res.evenements.join(' • ')
          : `Transition vers ${res.nouvelle_phase.replaceAll('_', ' ')}`
      );
    } catch (err) {
      setBanniereInfo(
        err instanceof Error ? err.message : 'Erreur lors du tour IA.'
      );
    } finally {
      setSimulationEnCours(false);
    }
  }

  async function handleSendMessage(contenu: string, canal: CanalMessage) {
    if (!partie || !joueurHumain) return;

    const messageLocalId = crypto.randomUUID();
    const nouveauMsg: MessagePartie = {
      id: messageLocalId,
      partie_id: partie.id,
      joueur_emetteur_id: joueurHumain.id,
      nom_emetteur: joueurHumain.nom_affiche,
      canal,
      tour: partie.tour_actuel,
      phase: partie.phase_actuelle,
      contenu,
      est_ia: false,
      tokens_utilises: 0,
      cree_le: new Date().toISOString(),
    };

    // Affichage immédiat du message du joueur
    setPartie((prev) =>
      prev ? { ...prev, messages: [...prev.messages, nouveauMsg] } : null
    );

    try {
      const res = await envoyerMessageJoueur(
        partie.id,
        joueurHumain.id,
        contenu,
        canal
      );

      // Si l'IA a répondu en direct (Option 1)
      if (res && res.reponse_ia) {
        setPartie((prev) => {
          if (!prev) return null;
          if (prev.messages.some((m) => m.id === res.reponse_ia?.id)) return prev;
          return {
            ...prev,
            messages: [...prev.messages, res.reponse_ia!],
            tokens_total_utilises:
              prev.tokens_total_utilises + (res.reponse_ia?.tokens_utilises || 0),
          };
        });
      }
    } catch (err) {
      setBanniereInfo(
        err instanceof Error ? err.message : 'Erreur d’envoi du message.'
      );
    }
  }

  async function handleVoterHumain() {
    if (!partie || !joueurHumain || !cibleSelectionnee) return;
    try {
      await voterContreJoueur(partie.id, joueurHumain.id, cibleSelectionnee.id);
      setBanniereInfo(
        `Votre vote contre ${cibleSelectionnee.nom_affiche} est enregistré ! Cliquez sur « Faire jouer les 5 Agents IA » pour dépouiller.`
      );
    } catch (err) {
      setBanniereInfo(err instanceof Error ? err.message : 'Vote refusé.');
    }
  }

  async function handlePouvoirHumain(typeAction: TypeActionJeu) {
    if (!partie || !joueurHumain) return;
    try {
      const res = await executerActionSpeciale(
        partie.id,
        joueurHumain.id,
        typeAction,
        cibleSelectionnee?.id ?? null
      );

      if (
        typeAction === 'alchimiste_soigner' ||
        typeAction === 'alchimiste_empoisonner'
      ) {
        setEvenementPotion({
          id: crypto.randomUUID(),
          typeAction,
          cibleNom: cibleSelectionnee?.nom_affiche || 'Gérard le Râleur',
        });
      }

      const details = (res.details_resultat as Record<string, string>) || {};
      if (details.alignement_decouvert) {
        setBanniereInfo(
          `🔮 Inspection de l’Inquisiteur : ${details.cible_nom} appartient au camp « ${details.alignement_decouvert.toUpperCase()} » !`
        );
      } else {
        setBanniereInfo(
          `✨ Action « ${typeAction.replaceAll('_', ' ')} » exécutée avec succès !`
        );
      }
    } catch (err) {
      setBanniereInfo(err instanceof Error ? err.message : 'Action refusée.');
    }
  }

  function handleDemoMortEtChaiseVide() {
    if (!partie) return;
    const victime =
      cibleSelectionnee ||
      partie.joueurs.find((j) => !j.est_humain && j.est_vivant) ||
      partie.joueurs[1];
    if (!victime) return;

    const victimeMiseAJour: JoueurPartie = {
      ...victime,
      est_vivant: false,
      role: victime.role || 'citoyen',
      cause_mort: 'creatures',
    };

    setVictimeCinematique(victimeMiseAJour);
    setPartie({
      ...partie,
      joueurs: partie.joueurs.map((j) =>
        j.id === victime.id ? victimeMiseAJour : j
      ),
    });
  }

  const estNuit =
    partie?.phase_actuelle === 'nuit' ||
    partie?.phase_actuelle === 'tour_alchimiste';

  return (
    <div
      style={{
        backgroundImage: `url('${estNuit ? ASSETS_TAVERNE.taverneNuit : ASSETS_TAVERNE.taverneJour}')`,
      }}
      className="min-h-screen bg-cover bg-center bg-fixed text-amber-100 font-serif relative transition-all duration-1000"
    >
      <div className="min-h-screen w-full bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0.94)_100%)] backdrop-blur-[4px] flex flex-col">
        <AiActDialog
          ouvert={dialogOuvert}
          onLancerPartie={handleLancerPartie}
        />

        {/* 1 & 2. Interlude Cinématique Plein Écran (<PhaseTransition />) */}
        <PhaseTransition
          phase={phaseTransition}
          tour={partie?.tour_actuel ?? 1}
          onComplete={() => setPhaseTransition(null)}
        />

        {/* 3. Cinématique de Mort Plein Écran (<BloodSplatter />) */}
        <BloodSplatter
          victime={victimeCinematique}
          onDismiss={() => setVictimeCinematique(null)}
        />

        {/* 5. Pop-up de la Potion de l'Alchimiste (<PotionPopup />) */}
        <PotionPopup
          evenement={evenementPotion}
          onClose={() => setEvenementPotion(null)}
        />

        {/* Modale de Fin de Partie / Révélation des Rôles */}
        {partie && (partie.phase_actuelle === 'terminee' || partie.camp_vainqueur) && !modalFinPartieFermee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none">
            <div className="max-w-xl w-full rounded-2xl bg-[#0e0705] border-2 border-amber-600/80 p-6 md:p-8 shadow-[0_0_120px_rgba(217,119,6,0.6)] text-center space-y-6">
              <div className="flex flex-col items-center">
                <div className="p-3.5 rounded-full bg-amber-950/80 border-2 border-amber-500 text-amber-300 mb-3 animate-bounce">
                  <Trophy className="w-8 h-8" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wider text-amber-100">
                  {partie.camp_vainqueur === 'citoyens'
                    ? 'Victoire des Citoyens !'
                    : 'Victoire des Créatures !'}
                </h2>
                <p className="text-xs md:text-sm text-amber-200/80 italic mt-1">
                  {partie.camp_vainqueur === 'citoyens'
                    ? 'Le mal a été purgé de la taverne aux premières lueurs de l’aube.'
                    : 'Les ombres ont dévoré les convives jusqu’au dernier.'}
                </p>
              </div>

              {/* Révélation de tous les rôles */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-black/60 border border-amber-900/50">
                {partie.joueurs.map((j) => (
                  <div key={j.id} className="flex flex-col items-center text-center p-2 rounded-lg bg-black/40">
                    <img
                      src={j.avatar_url || (j.est_humain ? '/sprites/humain.png' : '/sprites/gerard.png')}
                      alt={j.nom_affiche}
                      className="w-12 h-12 rounded-full border-2 border-amber-700 object-cover mb-1"
                    />
                    <span className="text-xs font-bold text-amber-100 truncate w-full">
                      {j.nom_affiche.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-amber-300/80 uppercase">
                      {j.role?.replaceAll('_', ' ') ?? 'citoyen'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalFinPartieFermee(true)}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-xs transition cursor-pointer"
                >
                  Voir la table
                </button>
                <button
                  type="button"
                  onClick={() => setDialogOuvert(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 border border-amber-400 text-amber-50 font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer"
                >
                  Nouvelle Partie
                </button>
              </div>
            </div>
          </div>
        )}

        {/* En-tête Glassmorphism sombre */}
        <header className="border-b border-amber-900/50 bg-black/70 backdrop-blur-md px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-900/50 text-amber-400 shadow-md">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold tracking-wider text-amber-100 uppercase">
                Créatures de la Nuit — La Taverne
              </h1>
              <p className="text-xs text-amber-200/75 italic">
                1 Joueur Humain face à 5 Convives IA • Ambiance Dark Fantasy & Décors HD
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {partie && (
              <>
                <div className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-amber-900/50 flex items-center gap-1.5 text-amber-200">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>{partie.tokens_total_utilises} tok</span>
                </div>

                <div className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-amber-900/50 flex items-center gap-1.5 text-amber-300">
                  <Coins className="w-3.5 h-3.5" />
                  <span>${partie.cout_estime_usd.toFixed(4)}</span>
                </div>
              </>
            )}

            {/* Bouton de tiroir pour les Vignettes de Démonstration */}
            <button
              type="button"
              onClick={() => setOutilsDemoOuvert(!outilsDemoOuvert)}
              className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-200 flex items-center gap-1.5 transition cursor-pointer"
              title="Tester les Cinématiques des Vignettes 1 à 5"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Vignettes Cinématiques</span>
              {outilsDemoOuvert ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setDialogOuvert(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-800 to-amber-700 hover:from-amber-700 hover:to-amber-600 border border-amber-500/70 text-amber-100 flex items-center gap-1.5 font-bold shadow-md transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Nouvelle Partie</span>
            </button>
          </div>
        </header>

        {/* Tiroir déroulant pour tester directement les 5 Vignettes cinématiques */}
        {outilsDemoOuvert && (
          <div className="border-b border-amber-900/60 bg-black/85 backdrop-blur-md px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2 duration-200">
            <span className="text-[11px] uppercase tracking-wider text-amber-400/90 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Démonstration Cinématique (Vignettes 1 à 5) :
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (partie) {
                    setPartie({ ...partie, phase_actuelle: 'debat_jour' });
                  }
                  setPhaseTransition('debat_jour');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-700/60 text-amber-100 flex items-center gap-1 transition cursor-pointer"
                title="Vignette 1 : Interlude Cinématique de l'Aube"
              >
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                <span>1. L'Aube</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (partie) {
                    setPartie({ ...partie, phase_actuelle: 'nuit' });
                  }
                  setPhaseTransition('nuit');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-100 flex items-center gap-1 transition cursor-pointer"
                title="Vignette 2 : Interlude Cinématique du Crépuscule"
              >
                <Moon className="w-3.5 h-3.5 text-sky-300" />
                <span>2. La Nuit</span>
              </button>

              <button
                type="button"
                onClick={handleDemoMortEtChaiseVide}
                className="px-2.5 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-700/60 text-red-100 flex items-center gap-1 transition cursor-pointer"
                title="Vignettes 3 & 4 : Élimination Tragique + Remplacement par la Chaise Vide"
              >
                <Skull className="w-3.5 h-3.5 text-red-400" />
                <span>3 & 4. Mort & Chaise Vide</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setEvenementPotion({
                    id: crypto.randomUUID(),
                    typeAction: 'alchimiste_empoisonner',
                    cibleNom:
                      cibleSelectionnee?.nom_affiche || 'Gérard le Râleur',
                  })
                }
                className="px-2.5 py-1.5 rounded-lg bg-fuchsia-950/70 hover:bg-fuchsia-900 border border-fuchsia-700/60 text-fuchsia-100 flex items-center gap-1 transition cursor-pointer"
                title="Vignette 5 : Pop-up de la Potion de l'Alchimiste"
              >
                <FlaskConical className="w-3.5 h-3.5 text-fuchsia-300" />
                <span>5. Potion</span>
              </button>
            </div>
          </div>
        )}

        {/* Contenu principal */}
        {partie && (
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-4">
            {banniereInfo && (
              <div className="px-4 py-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-amber-900/50 text-amber-100 text-xs md:text-sm flex items-center justify-between gap-4">
                <span className="italic">🕯️ {banniereInfo}</span>
                {partie.camp_vainqueur && (
                  <span className="px-3 py-1 rounded-full bg-amber-600 text-stone-950 font-bold uppercase text-xs">
                    Victoire : {partie.camp_vainqueur}
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <GameTable
                  joueurs={partie.joueurs}
                  phase={partie.phase_actuelle}
                  tour={partie.tour_actuel}
                  cibleSelectionneeId={cibleId}
                  onSelectCible={setCibleId}
                  dernierMessageParJoueur={dernierMessageParJoueur}
                />

                <div className="p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-amber-900/50 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs text-amber-100/80">
                      Cible sélectionnée :{' '}
                      <strong className="text-amber-300">
                        {cibleSelectionnee
                          ? cibleSelectionnee.nom_affiche
                          : 'Aucune (cliquez sur un personnage)'}
                      </strong>
                    </span>

                    {joueurHumain?.est_vivant &&
                      (partie.phase_actuelle === 'vote_jour' ||
                        (partie.phase_actuelle === 'nuit' &&
                          joueurHumain.role === 'creature')) && (
                        <button
                          type="button"
                          disabled={!cibleSelectionnee}
                          onClick={handleVoterHumain}
                          className="px-3.5 py-2 rounded-xl bg-red-900/90 hover:bg-red-800 disabled:opacity-40 text-amber-100 border border-red-600/50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Scale className="w-4 h-4" />
                          <span>Voter contre cette cible</span>
                        </button>
                      )}

                    {joueurHumain?.est_vivant &&
                      partie.phase_actuelle === 'nuit' &&
                      joueurHumain.role === 'inquisiteur' && (
                        <button
                          type="button"
                          disabled={!cibleSelectionnee}
                          onClick={() =>
                            handlePouvoirHumain('inquisiteur_inspecter')
                          }
                          className="px-3.5 py-2 rounded-xl bg-sky-900/90 hover:bg-sky-800 disabled:opacity-40 text-amber-100 border border-sky-500/50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Inspecter (Inquisiteur)</span>
                        </button>
                      )}

                    {joueurHumain?.est_vivant &&
                      (partie.phase_actuelle === 'nuit' ||
                        partie.phase_actuelle === 'tour_alchimiste') &&
                      joueurHumain.role === 'alchimiste' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handlePouvoirHumain('alchimiste_soigner')
                            }
                            className="px-3.5 py-2 rounded-xl bg-emerald-900/90 hover:bg-emerald-800 text-amber-100 border border-emerald-500/50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <FlaskConical className="w-4 h-4" />
                            <span>Potion de Vie</span>
                          </button>
                          <button
                            type="button"
                            disabled={!cibleSelectionnee}
                            onClick={() =>
                              handlePouvoirHumain('alchimiste_empoisonner')
                            }
                            className="px-3.5 py-2 rounded-xl bg-purple-900/90 hover:bg-purple-800 disabled:opacity-40 text-amber-100 border border-purple-500/50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Potion de Mort</span>
                          </button>
                        </>
                      )}

                    {partie.phase_actuelle === 'tour_garde_du_corps' &&
                      joueurHumain?.role === 'garde_du_corps' && (
                        <button
                          type="button"
                          disabled={!cibleSelectionnee}
                          onClick={() =>
                            handlePouvoirHumain('garde_du_corps_tirer')
                          }
                          className="px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 border border-amber-500/50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Shield className="w-4 h-4" />
                          <span>Tir du Garde du Corps</span>
                        </button>
                      )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      simulationEnCours || partie.phase_actuelle === 'terminee'
                    }
                    onClick={handleSimulerTourIA}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-red-800 hover:from-amber-600 hover:to-red-700 disabled:opacity-40 text-amber-50 border border-amber-400/60 font-bold text-xs md:text-sm flex items-center gap-2 shadow-xl transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {simulationEnCours
                        ? 'Les 5 IA délibèrent...'
                        : 'Faire jouer les 5 Agents IA (Phase suivante)'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-1">
                <ChatPanel
                  messages={partie.messages}
                  roleHumain={joueurHumain?.role ?? null}
                  humainVivant={joueurHumain?.est_vivant ?? true}
                  onSendMessage={handleSendMessage}
                />
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

export default App;
