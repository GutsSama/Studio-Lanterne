import type { ReactNode } from "react";
import type { EtatPartiePublic, JoueurPublic, UUID } from "../types/game";
import type { EtatJeu } from "../game/useJeu";
import { prenom } from "../game/libelles";

export type TypeCiblage = "inspecter" | "devorer" | "voter" | "empoisonner" | "tirer";

export interface Ciblage {
  type: TypeCiblage | null;
  cibles: ReadonlySet<UUID>;
}

/** Détermine si le joueur humain doit désigner une cible, et lesquelles sont valides. */
export function calculerCiblage(
  partie: EtatPartiePublic,
  humain: JoueurPublic | null,
  actionFaite: (t: string) => boolean,
): Ciblage {
  const vide: Ciblage = { type: null, cibles: new Set() };
  if (!humain) return vide;
  const autresVivants = partie.joueurs.filter((j) => j.est_vivant && j.id !== humain.id);
  const ids = (liste: JoueurPublic[]) => new Set(liste.map((j) => j.id));
  const phase = partie.phase_actuelle;
  const infos = partie.informations_role_humain;

  if (phase === "tour_garde_du_corps" && infos.doit_tirer && !actionFaite("garde_du_corps_tirer")) {
    return { type: "tirer", cibles: ids(autresVivants) };
  }
  if (!humain.est_vivant) return vide;

  if (phase === "nuit" && humain.role === "inquisiteur" && !actionFaite("inquisiteur_inspecter")) {
    const dejaInspectes = new Set(Object.keys(infos.inspections_inquisiteur ?? {}));
    return { type: "inspecter", cibles: ids(autresVivants.filter((j) => !dejaInspectes.has(j.id))) };
  }
  if (phase === "nuit" && humain.role === "creature" && !actionFaite("vote")) {
    return { type: "devorer", cibles: ids(autresVivants.filter((j) => j.role !== "creature")) };
  }
  if (phase === "vote_jour" && !actionFaite("vote")) {
    return { type: "voter", cibles: ids(autresVivants) };
  }
  if (
    phase === "tour_alchimiste" &&
    humain.role === "alchimiste" &&
    infos.potion_mort_disponible &&
    !actionFaite("alchimiste_empoisonner")
  ) {
    return { type: "empoisonner", cibles: ids(autresVivants) };
  }
  return vide;
}

interface Props {
  jeu: EtatJeu;
  partie: EtatPartiePublic;
  humain: JoueurPublic | null;
  ciblage: Ciblage;
  cible: JoueurPublic | null;
  reinitialiserCible: () => void;
}

function Consigne({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="font-pixel text-[10px] uppercase text-lanterne">{titre}</div>
      <div className="leading-tight text-os/90">{texte}</div>
    </div>
  );
}

export function PanneauAction({ jeu, partie, humain, ciblage, cible, reinitialiserCible }: Props) {
  const occupe = jeu.operation !== null;
  const nomCible = cible ? prenom(cible.nom_affiche) : "...";
  const phase = partie.phase_actuelle;
  const infos = partie.informations_role_humain;

  if (occupe) {
    return (
      <div className="panneau flex items-center gap-4 px-5 py-4">
        <div className="font-pixel text-[11px] text-lanterne">
          {jeu.operation}
          <span className="point-attente">.</span>
          <span className="point-attente [animation-delay:0.2s]">.</span>
          <span className="point-attente [animation-delay:0.4s]">.</span>
        </div>
        <div className="ml-auto text-parchemin-sombre/70">Les IA réfléchissent (Groq · Mistral · Gemini)</div>
      </div>
    );
  }

  const boutonAvancer = (libelle: string, style = "bouton") => (
    <button type="button" className={style} disabled={jeu.revelationEnCours} onClick={() => void jeu.avancer()}>
      {libelle}
    </button>
  );

  const passerRevelation = jeu.revelationEnCours && (
    <button type="button" className="bouton bouton-nuit" onClick={jeu.toutAfficher}>
      Passer ⏩
    </button>
  );

  let contenu: ReactNode;

  switch (ciblage.type) {
    case "inspecter":
      contenu = (
        <>
          <Consigne titre="Pouvoir de l'Inquisiteur" texte="Clique sur un joueur pour découvrir son camp cette nuit." />
          <button
            type="button"
            className="bouton bouton-nuit"
            disabled={!cible}
            onClick={() => cible && void jeu.agir("inquisiteur_inspecter", cible.id).then(reinitialiserCible)}
          >
            Inspecter {nomCible}
          </button>
          {boutonAvancer("Passer", "bouton bouton-nuit")}
        </>
      );
      break;
    case "devorer":
      contenu = (
        <>
          <Consigne titre="Chasse nocturne" texte="Choisis la proie que ta meute dévorera cette nuit." />
          <button
            type="button"
            className="bouton bouton-sang"
            disabled={!cible}
            onClick={() => cible && void jeu.voter(cible.id, false).then(reinitialiserCible)}
          >
            Dévorer {nomCible}
          </button>
          {boutonAvancer("Laisser faire l'alliée", "bouton bouton-nuit")}
        </>
      );
      break;
    case "voter":
      contenu = (
        <>
          <Consigne titre="Vote du Conseil" texte="Désigne le joueur que tu soupçonnes d'être une Créature." />
          {passerRevelation}
          <button
            type="button"
            className="bouton bouton-sang"
            disabled={!cible || jeu.revelationEnCours}
            onClick={() => cible && void jeu.voter(cible.id, true).then(reinitialiserCible)}
          >
            Voter contre {nomCible}
          </button>
        </>
      );
      break;
    case "tirer":
      contenu = (
        <>
          <Consigne titre="Dernier souffle" texte="Tu tombes... mais tu peux emporter un joueur avec toi." />
          <button
            type="button"
            className="bouton bouton-sang"
            disabled={!cible}
            onClick={() =>
              cible &&
              void jeu
                .agir("garde_du_corps_tirer", cible.id)
                .then(reinitialiserCible)
            }
          >
            Tirer sur {nomCible}
          </button>
        </>
      );
      break;
    case "empoisonner": {
      const victime = partie.joueurs.find((j) => j.id === infos.victime_provisoire_nuit_id);
      contenu = (
        <>
          <Consigne
            titre="Laboratoire de l'Alchimiste"
            texte={victime ? `Les Créatures ont attaqué ${prenom(victime.nom_affiche)}.` : "Personne n'a été attaqué cette nuit."}
          />
          {victime && infos.potion_vie_disponible && !jeu.actionFaite("alchimiste_soigner") && (
            <button type="button" className="bouton bouton-mousse" onClick={() => void jeu.agir("alchimiste_soigner", victime.id)}>
              Sauver {prenom(victime.nom_affiche)}
            </button>
          )}
          <button
            type="button"
            className="bouton bouton-sang"
            disabled={!cible}
            onClick={() => cible && void jeu.agir("alchimiste_empoisonner", cible.id).then(reinitialiserCible)}
          >
            Empoisonner {nomCible}
          </button>
          {boutonAvancer("Laisser l'aube venir", "bouton bouton-nuit")}
        </>
      );
      break;
    }
    case null:
      switch (phase) {
        case "nuit":
        case "tour_alchimiste":
          contenu = (
            <>
              <Consigne
                titre="La nuit"
                texte={
                  humain?.est_vivant
                    ? humain.role === "citoyen" || humain.role === "garde_du_corps"
                      ? "Tu dors... Des ombres se faufilent entre les maisons."
                      : "Ton action est faite. Attends l'aube."
                    : "Tu observes le village depuis l'au-delà."
                }
              />
              {passerRevelation}
              {boutonAvancer("Attendre l'aube ☀")}
            </>
          );
          break;
        case "debat_jour":
          contenu = (
            <>
              <Consigne
                titre="Débat du village"
                texte={
                  humain?.est_vivant
                    ? "Écris dans le chat pour accuser ou te défendre, puis laisse les IA répondre."
                    : "Les vivants débattent de ton sort passé..."
                }
              />
              {passerRevelation}
              {boutonAvancer("Donner la parole aux IA")}
            </>
          );
          break;
        case "vote_jour":
          contenu = (
            <>
              <Consigne
                titre="Vote du Conseil"
                texte={humain?.est_vivant ? "Ton vote est enregistré." : "Les vivants votent sans toi."}
              />
              {passerRevelation}
              {boutonAvancer("Dépouiller les votes", "bouton bouton-sang")}
            </>
          );
          break;
        case "tour_garde_du_corps":
          contenu = (
            <>
              <Consigne titre="Dernier souffle" texte="Le Garde du Corps tombé s'apprête à tirer..." />
              {boutonAvancer("Voir le tir")}
            </>
          );
          break;
        case "terminee":
          contenu = <Consigne titre="Fin de partie" texte="Le destin du village est scellé." />;
          break;
      }
      break;
  }

  return (
    <div className="panneau flex flex-wrap items-center gap-4 px-5 py-4">
      {contenu}
      {jeu.erreur && (
        <button type="button" onClick={jeu.effacerErreur} className="w-full bg-sang/30 px-2 py-1 text-left text-os">
          ⚠ {jeu.erreur} <span className="text-parchemin-sombre">(fermer)</span>
        </button>
      )}
    </div>
  );
}
