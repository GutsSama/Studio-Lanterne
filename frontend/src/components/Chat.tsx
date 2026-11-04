import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { CanalMessage, EtatPartiePublic, JoueurPublic, MessagePartie } from "../types/game";
import { SpritePersonnage } from "./Sprites";

type Onglet = "village" | "secret" | "morts";

const CANAUX_ONGLET: Record<Onglet, ReadonlyArray<CanalMessage>> = {
  village: ["village_public", "systeme"],
  secret: ["creature_secret"],
  morts: ["chat_morts"],
};

const CANAL_ENVOI: Record<Onglet, CanalMessage> = {
  village: "village_public",
  secret: "creature_secret",
  morts: "chat_morts",
};

interface Props {
  partie: EtatPartiePublic;
  humain: JoueurPublic | null;
  nbMessagesAffiches: number;
  occupe: boolean;
  onEnvoyer: (contenu: string, canal: CanalMessage) => Promise<void>;
}

function LigneMessage({ m, emetteur }: { m: MessagePartie; emetteur: JoueurPublic | undefined }) {
  if (m.canal === "systeme") {
    return (
      <div className="animate-apparaitre my-2 px-2 text-center text-lanterne">
        <span className="text-parchemin-sombre">✦ </span>
        {m.contenu}
        <span className="text-parchemin-sombre"> ✦</span>
      </div>
    );
  }
  const estHumain = emetteur?.est_humain ?? !m.est_ia;
  const secret = m.canal === "creature_secret";
  return (
    <div className={`animate-apparaitre my-1.5 flex items-end gap-2 ${estHumain ? "flex-row-reverse" : ""}`}>
      <div className="h-10 w-10 shrink-0 overflow-hidden bg-nuit-900">
        {emetteur && <SpritePersonnage joueur={emetteur} tombeSiMort={false} portrait className="h-full w-full" />}
      </div>
      <div
        className={`max-w-[80%] px-2 py-1 leading-tight ${
          secret ? "bg-sang/30 text-os" : estHumain ? "bg-lanterne text-encre" : "bg-nuit-700 text-os"
        }`}
      >
        <div className={`font-pixel text-[8px] ${estHumain ? "text-encre/70" : "text-parchemin-sombre"}`}>
          {m.nom_emetteur}
          {m.phase === "vote_jour" && " · vote"}
        </div>
        <div>{m.contenu}</div>
      </div>
    </div>
  );
}

export function Chat({ partie, humain, nbMessagesAffiches, occupe, onEnvoyer }: Props) {
  const [onglet, setOnglet] = useState<Onglet>("village");
  const [saisie, setSaisie] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  const estCreature = humain?.role === "creature";
  const estMort = humain ? !humain.est_vivant : false;
  const onglets: Onglet[] = ["village", ...(estCreature ? (["secret"] as const) : []), ...(estMort ? (["morts"] as const) : [])];

  const parId = useMemo(() => new Map(partie.joueurs.map((j) => [j.id, j])), [partie.joueurs]);
  const visibles = partie.messages
    .slice(0, nbMessagesAffiches)
    .filter((m) => CANAUX_ONGLET[onglet].includes(m.canal));

  const nonLus = (o: Onglet) =>
    o !== onglet && partie.messages.slice(0, nbMessagesAffiches).some((m) => CANAUX_ONGLET[o].includes(m.canal) && m.tour === partie.tour_actuel);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visibles.length, onglet]);

  const phase = partie.phase_actuelle;
  const peutEcrire =
    !!humain &&
    !occupe &&
    ((onglet === "village" && humain.est_vivant && phase === "debat_jour") ||
      (onglet === "secret" && humain.est_vivant && phase === "nuit") ||
      (onglet === "morts" && !humain.est_vivant));

  const indice =
    onglet === "village"
      ? humain?.est_vivant
        ? phase === "debat_jour"
          ? "Accuse, défends-toi, bluffe..."
          : "Le village ne parle que pendant le débat."
        : "Les morts ne parlent plus au village."
      : onglet === "secret"
        ? phase === "nuit"
          ? "Murmure à ton alliée Créature..."
          : "Le canal secret s'ouvre la nuit."
        : "Parle aux autres fantômes...";

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    const texte = saisie.trim();
    if (!texte || !peutEcrire) return;
    setSaisie("");
    await onEnvoyer(texte, CANAL_ENVOI[onglet]);
  };

  const libelles: Record<Onglet, string> = { village: "Village", secret: "Créatures", morts: "Au-delà" };

  return (
    <div className="panneau flex h-full min-h-0 flex-col">
      <div className="flex gap-1 border-b-4 border-encre px-2 pt-2">
        {onglets.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOnglet(o)}
            className={`relative px-3 py-2 font-pixel text-[9px] uppercase ${
              o === onglet ? "bg-nuit-600 text-lanterne" : "bg-nuit-900 text-parchemin-sombre hover:text-os"
            } ${o === "secret" ? "text-sang" : ""}`}
          >
            {libelles[o]}
            {nonLus(o) && <span className="absolute -right-1 -top-1 h-2 w-2 bg-sang" />}
          </button>
        ))}
      </div>

      <div className="defilement min-h-0 flex-1 overflow-y-auto px-3 py-2 text-[19px]">
        {visibles.length === 0 && (
          <div className="mt-8 text-center text-parchemin-sombre/60">Le silence règne...</div>
        )}
        {visibles.map((m) => (
          <LigneMessage key={m.id} m={m} emetteur={m.joueur_emetteur_id ? parId.get(m.joueur_emetteur_id) : undefined} />
        ))}
        <div ref={finRef} />
      </div>

      <form onSubmit={soumettre} className="flex gap-3 border-t-4 border-encre p-3">
        <input
          className="champ min-w-0 flex-1"
          value={saisie}
          maxLength={500}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={indice}
          disabled={!peutEcrire}
        />
        <button type="submit" className="bouton" disabled={!peutEcrire || !saisie.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
