import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ErreurApi } from "../api/client";
import type {
  CanalMessage,
  EtatPartiePublic,
  JoueurPublic,
  RolePersonnage,
  TypeActionJeu,
  UUID,
} from "../types/game";

const CLE_STOCKAGE = "lanterne:partie_id";
const DELAI_MESSAGE_IA_MS = 900;
const DELAI_MESSAGE_SYSTEME_MS = 450;

export interface EtatJeu {
  partie: EtatPartiePublic | null;
  humain: JoueurPublic | null;
  /** Nombre de messages déjà révélés à l'écran (révélation progressive façon RPG). */
  nbMessagesAffiches: number;
  revelationEnCours: boolean;
  chargementInitial: boolean;
  /** Libellé de l'opération serveur en cours, ou `null`. */
  operation: string | null;
  erreur: string | null;
  evenements: string[];
  actionFaite: (type: string) => boolean;
  creerPartie: (nom: string, roleForce: RolePersonnage | null) => Promise<void>;
  avancer: () => Promise<void>;
  envoyerMessage: (contenu: string, canal: CanalMessage) => Promise<void>;
  voter: (cibleId: UUID, puisAvancer: boolean) => Promise<void>;
  agir: (type: TypeActionJeu, cibleId: UUID | null) => Promise<void>;
  quitter: () => void;
  effacerErreur: () => void;
  toutAfficher: () => void;
}

function messageErreur(e: unknown): string {
  if (e instanceof ErreurApi) return e.message;
  if (e instanceof Error) return `Connexion au serveur impossible (${e.message}).`;
  return "Erreur inconnue.";
}

export function useJeu(): EtatJeu {
  const [partie, setPartie] = useState<EtatPartiePublic | null>(null);
  const [nbMessagesAffiches, setNbMessagesAffiches] = useState(0);
  const [chargementInitial, setChargementInitial] = useState(true);
  const [operation, setOperation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [evenements, setEvenements] = useState<string[]>([]);
  const [actionsFaites, setActionsFaites] = useState<ReadonlySet<string>>(new Set());
  const partieRef = useRef<EtatPartiePublic | null>(null);
  partieRef.current = partie;

  const humain = useMemo(() => partie?.joueurs.find((j) => j.est_humain) ?? null, [partie]);

  const cleAction = useCallback(
    (type: string) => (partie ? `${partie.tour_actuel}:${partie.phase_actuelle}:${type}` : type),
    [partie],
  );

  const marquerAction = useCallback(
    (type: string) => setActionsFaites((s) => new Set(s).add(cleAction(type))),
    [cleAction],
  );

  const actionFaite = useCallback((type: string) => actionsFaites.has(cleAction(type)), [actionsFaites, cleAction]);

  // ─── Reprise d'une partie existante ───
  useEffect(() => {
    const id = localStorage.getItem(CLE_STOCKAGE);
    if (!id) {
      setChargementInitial(false);
      return;
    }
    api
      .obtenirPartie(id)
      .then((p) => {
        setPartie(p);
        setNbMessagesAffiches(p.messages.length);
      })
      .catch(() => localStorage.removeItem(CLE_STOCKAGE))
      .finally(() => setChargementInitial(false));
  }, []);

  // ─── Révélation progressive des messages ───
  const total = partie?.messages.length ?? 0;
  useEffect(() => {
    if (!partie || nbMessagesAffiches >= total) return;
    const prochain = partie.messages[nbMessagesAffiches];
    const delai = prochain?.canal === "systeme" ? DELAI_MESSAGE_SYSTEME_MS : DELAI_MESSAGE_IA_MS;
    const t = window.setTimeout(() => setNbMessagesAffiches((n) => n + 1), delai);
    return () => window.clearTimeout(t);
  }, [partie, nbMessagesAffiches, total]);

  const executer = useCallback(async (libelle: string, fn: () => Promise<void>) => {
    setOperation(libelle);
    setErreur(null);
    try {
      await fn();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOperation(null);
    }
  }, []);

  const rafraichir = useCallback(async (afficherTout: boolean) => {
    const p = partieRef.current;
    if (!p) return;
    const maj = await api.obtenirPartie(p.id);
    setPartie(maj);
    if (afficherTout) setNbMessagesAffiches(maj.messages.length);
  }, []);

  const creerPartie = useCallback(
    (nom: string, roleForce: RolePersonnage | null) =>
      executer("Le village se prépare", async () => {
        const p = await api.creerPartie({
          nom_humain: nom,
          consentement_ai_act: true,
          role_humain_force: roleForce,
        });
        localStorage.setItem(CLE_STOCKAGE, p.id);
        setActionsFaites(new Set());
        setEvenements([]);
        setNbMessagesAffiches(0);
        setPartie(p);
      }),
    [executer],
  );

  const avancer = useCallback(() => {
    const p = partieRef.current;
    if (!p) return Promise.resolve();
    const libelles: Partial<Record<string, string>> = {
      nuit: "Les créatures rôdent dans l'ombre",
      tour_alchimiste: "L'aube se lève",
      debat_jour: "Les villageois débattent",
      vote_jour: "Le Conseil dépouille les votes",
      tour_garde_du_corps: "Un coup de feu retentit",
    };
    return executer(libelles[p.phase_actuelle] ?? "Le destin se joue", async () => {
      const rep = await api.simulerTour(p.id);
      setEvenements(rep.evenements);
      setPartie(rep.etat);
    });
  }, [executer]);

  const envoyerMessage = useCallback(
    (contenu: string, canal: CanalMessage) =>
      executer("Envoi", async () => {
        const p = partieRef.current;
        if (!p || !humain) return;
        await api.envoyerMessage(p.id, { joueur_id: humain.id, contenu, canal });
        await rafraichir(true);
      }),
    [executer, humain, rafraichir],
  );

  const voter = useCallback(
    async (cibleId: UUID, puisAvancer: boolean) => {
      const p = partieRef.current;
      if (!p || !humain) return;
      let ok = false;
      await executer("Vote", async () => {
        await api.voter(p.id, { votant_id: humain.id, cible_id: cibleId });
        marquerAction("vote");
        ok = true;
      });
      if (ok && puisAvancer) await avancer();
    },
    [avancer, executer, humain, marquerAction],
  );

  const agir = useCallback(
    (type: TypeActionJeu, cibleId: UUID | null) =>
      executer("Pouvoir", async () => {
        const p = partieRef.current;
        if (!p || !humain) return;
        await api.agir(p.id, { acteur_id: humain.id, type_action: type, cible_id: cibleId });
        marquerAction(type);
        await rafraichir(true);
      }),
    [executer, humain, marquerAction, rafraichir],
  );

  const quitter = useCallback(() => {
    localStorage.removeItem(CLE_STOCKAGE);
    setPartie(null);
    setNbMessagesAffiches(0);
    setEvenements([]);
    setErreur(null);
  }, []);

  return {
    partie,
    humain,
    nbMessagesAffiches,
    revelationEnCours: nbMessagesAffiches < total,
    chargementInitial,
    operation,
    erreur,
    evenements,
    actionFaite,
    creerPartie,
    avancer,
    envoyerMessage,
    voter,
    agir,
    quitter,
    effacerErreur: () => setErreur(null),
    toutAfficher: () => setNbMessagesAffiches(total),
  };
}

