import { useEffect, useMemo, useState } from "react";
import type { UUID } from "./types/game";
import { useJeu } from "./game/useJeu";
import { estPhaseNocturne } from "./game/libelles";
import { EcranTitre } from "./components/EcranTitre";
import { ScenePartie } from "./components/ScenePartie";
import { Chat } from "./components/Chat";
import { PanneauAction, calculerCiblage } from "./components/PanneauAction";
import { BannierePhase, CarteRole, FinDePartie, Hud, ListeJoueurs } from "./components/Interface";

export default function App() {
  const jeu = useJeu();
  const { partie, humain } = jeu;
  const [cibleId, setCibleId] = useState<UUID | null>(null);
  const [finMasquee, setFinMasquee] = useState(false);

  const ciblage = useMemo(
    () => (partie ? calculerCiblage(partie, humain, jeu.actionFaite) : { type: null, cibles: new Set<UUID>() }),
    [partie, humain, jeu.actionFaite],
  );

  // Réinitialise la sélection si la cible n'est plus valide
  useEffect(() => {
    if (cibleId && !ciblage.cibles.has(cibleId)) setCibleId(null);
  }, [ciblage, cibleId]);

  useEffect(() => setFinMasquee(false), [partie?.id]);

  if (jeu.chargementInitial) {
    return <div className="flex h-full items-center justify-center font-pixel text-[12px] text-lanterne">Chargement...</div>;
  }

  if (!partie) {
    return <EcranTitre occupe={jeu.operation !== null} erreur={jeu.erreur} onCommencer={(n, r) => void jeu.creerPartie(n, r)} />;
  }

  const messagesAffiches = partie.messages.slice(0, jeu.nbMessagesAffiches);
  const dernierMessage =
    [...messagesAffiches].reverse().find((m) => m.canal === "village_public" || m.canal === "creature_secret") ?? null;
  const dernier = messagesAffiches[messagesAffiches.length - 1];
  const bulle = dernier && dernier.id === dernierMessage?.id ? dernierMessage : null;

  // Pendant que le serveur interroge les IA, on montre qui « réfléchit »
  const quiParlent = new Set<UUID>(
    jeu.operation && !estPhaseNocturne(partie.phase_actuelle)
      ? partie.joueurs.filter((j) => !j.est_humain && j.est_vivant).map((j) => j.id)
      : [],
  );

  const cible = partie.joueurs.find((j) => j.id === cibleId) ?? null;
  const terminee = partie.phase_actuelle === "terminee" && !jeu.revelationEnCours;

  return (
    <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-5 p-4">
      <Hud partie={partie} onQuitter={jeu.quitter} />
      <BannierePhase phase={partie.phase_actuelle} tour={partie.tour_actuel} />

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="flex min-h-0 flex-col gap-5">
          <ScenePartie
            joueurs={partie.joueurs}
            nuit={estPhaseNocturne(partie.phase_actuelle)}
            campVainqueur={partie.camp_vainqueur}
            dernierMessage={bulle}
            ciblesPossibles={ciblage.cibles}
            cibleSelectionnee={cibleId}
            onSelection={setCibleId}
            inspections={partie.informations_role_humain.inspections_inquisiteur ?? {}}
            joueursQuiParlent={quiParlent}
          />
          <PanneauAction
            jeu={jeu}
            partie={partie}
            humain={humain}
            ciblage={ciblage}
            cible={cible}
            reinitialiserCible={() => setCibleId(null)}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <CarteRole partie={partie} humain={humain} />
            <ListeJoueurs joueurs={partie.joueurs} />
          </div>
        </main>

        <aside className="min-h-[480px] lg:min-h-0">
          <Chat
            partie={partie}
            humain={humain}
            nbMessagesAffiches={jeu.nbMessagesAffiches}
            occupe={jeu.operation !== null}
            onEnvoyer={jeu.envoyerMessage}
          />
        </aside>
      </div>

      {terminee && !finMasquee && (
        <FinDePartie partie={partie} humain={humain} onRejouer={jeu.quitter} onFermer={() => setFinMasquee(true)} />
      )}
    </div>
  );
}

