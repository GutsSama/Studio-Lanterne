import { useEffect, useRef, useState } from "react";
import type { EtatPartiePublic, JoueurPublic, PhasePartie } from "../types/game";
import { LIBELLES_CAMP, LIBELLES_PHASE, LIBELLES_ROLE, estPhaseNocturne, fournisseur, prenom } from "../game/libelles";
import { iconeLune, iconeSoleil } from "../pixel/icones";
import { IconeRole, ImagePixel, LoupAnime, SpritePersonnage } from "./Sprites";
import { audio } from "../game/audio";
import { ModalProfil } from "./ModalProfil";

// ─── HUD supérieur ──────────────────────────────────────────────────────────

function formaterTimer(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Hud({
  partie,
  secondesRestantes = null,
  onQuitter,
  onOuvrirProfil,
}: {
  partie: EtatPartiePublic;
  secondesRestantes?: number | null;
  onQuitter: () => void;
  onOuvrirProfil?: () => void;
}) {
  const [muet, setMuet] = useState(audio.estMuet());
  const nuit = estPhaseNocturne(partie.phase_actuelle);
  const urgent = secondesRestantes !== null && secondesRestantes <= 10;

  const basculerSon = () => {
    setMuet(audio.basculerMuet());
  };

  return (
    <header className="panneau flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
      <div className="font-pixel text-[11px] leading-relaxed text-lanterne">
        Créatures de la Nuit <span className="text-os/60">vs</span> IA
      </div>
      <div className="flex items-center gap-2">
        <ImagePixel src={nuit ? iconeLune() : iconeSoleil()} alt="" className="h-6 w-6" />
        <span className="font-pixel text-[10px] uppercase">
          {nuit ? "Nuit" : "Jour"} {partie.tour_actuel}
        </span>
        <span className="text-parchemin-sombre">— {LIBELLES_PHASE[partie.phase_actuelle]}</span>
      </div>
      {secondesRestantes !== null && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 font-pixel text-[11px] ${
            urgent ? "bg-sang/30 text-sang animate-pulse" : "bg-nuit-900 text-lanterne"
          }`}
          title="Temps restant pour cette phase"
        >
          <span>⏳</span>
          <span>{formaterTimer(secondesRestantes)}</span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-3 text-parchemin-sombre" title="Suivi LiteLLM de la consommation">
        <button
          type="button"
          onClick={basculerSon}
          className="bouton bouton-nuit py-1.5! px-2.5! text-xs"
          title={muet ? "Activer les sons rétro" : "Couper le son"}
        >
          {muet ? "🔇" : "🔊"}
        </button>
        {onOuvrirProfil && (
          <button
            type="button"
            className="bouton bouton-nuit py-1.5! px-2.5! font-pixel text-[9px]! text-lanterne border border-lanterne/40 hover:border-lanterne"
            onClick={onOuvrirProfil}
            title="Consulter vos statistiques et succès"
          >
            🏆 Succès
          </button>
        )}
        <span>⚡ {partie.tokens_total_utilises.toLocaleString("fr-FR")} tokens</span>
        <span>💰 ${partie.cout_estime_usd.toFixed(4)}</span>
        <button type="button" className="bouton bouton-nuit py-1.5!" onClick={onQuitter}>
          Quitter
        </button>
      </div>
    </header>
  );
}

// ─── Carte de rôle + liste des joueurs ─────────────────────────────────────

export function CarteRole({ partie, humain }: { partie: EtatPartiePublic; humain: JoueurPublic | null }) {
  const role = humain?.role ?? null;
  const infos = partie.informations_role_humain;
  const allie = role === "creature" ? partie.joueurs.find((j) => !j.est_humain && j.role === "creature") : undefined;

  return (
    <div className="panneau panneau-parchemin flex flex-col gap-3 p-4">
      <div className="font-pixel text-[9px] uppercase text-encre/60">Ton rôle secret</div>
      <div className="flex items-center gap-3">
        <IconeRole role={role} className="h-12 w-12" />
        <div>
          <div className="font-pixel text-[11px] leading-relaxed">{role ? LIBELLES_ROLE[role].nom : "???"}</div>
          <div className="leading-tight text-encre/80">{role ? LIBELLES_ROLE[role].description : ""}</div>
        </div>
      </div>

      {allie && (
        <div className="bg-sang/15 px-2 py-1 leading-tight">
          🐺 Ton alliée : <b>{allie.nom_affiche}</b>
        </div>
      )}
      {role === "alchimiste" && (
        <div className="flex gap-3">
          <span className={infos.potion_vie_disponible ? "" : "line-through opacity-50"}>🧪 Vie</span>
          <span className={infos.potion_mort_disponible ? "" : "line-through opacity-50"}>☠ Mort</span>
        </div>
      )}
      {role === "inquisiteur" && Object.keys(infos.inspections_inquisiteur ?? {}).length > 0 && (
        <div className="leading-tight">
          {Object.entries(infos.inspections_inquisiteur ?? {}).map(([id, camp]) => {
            const j = partie.joueurs.find((x) => x.id === id);
            return (
              <div key={id}>
                👁 {j ? prenom(j.nom_affiche) : "?"} :{" "}
                <b className={camp === "creatures" ? "text-sang" : "text-mousse"}>{camp === "creatures" ? "Créature !" : "Citoyen"}</b>
              </div>
            );
          })}
        </div>
      )}
      {humain && !humain.est_vivant && <div className="bg-encre/10 px-2 py-1">👻 Tu es mort. Tu peux encore observer.</div>}
    </div>
  );
}

export function ListeJoueurs({ joueurs }: { joueurs: JoueurPublic[] }) {
  return (
    <div className="panneau flex flex-col gap-1 p-3">
      <div className="mb-1 font-pixel text-[9px] uppercase text-parchemin-sombre">Participants</div>
      {[...joueurs]
        .sort((a, b) => a.numero_siege - b.numero_siege)
        .map((j) => (
          <div key={j.id} className={`flex items-center gap-2 ${j.est_vivant ? "" : "opacity-45"}`}>
            <div className="h-8 w-8 shrink-0 bg-nuit-900">
              <SpritePersonnage joueur={j} tombeSiMort={false} portrait className="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1 truncate leading-none">
              <div className={j.est_vivant ? "" : "line-through"}>{j.nom_affiche}</div>
              <div className="text-[15px] text-parchemin-sombre">
                {j.est_humain ? "Humain" : `IA · ${fournisseur(j.modele_ia) ?? "?"}`}
              </div>
            </div>
            <IconeRole role={j.role} className="h-5 w-5" />
          </div>
        ))}
    </div>
  );
}

// ─── Bannière de transition de phase ────────────────────────────────────────

export function BannierePhase({ phase, tour }: { phase: PhasePartie; tour: number }) {
  const [affichee, setAffichee] = useState<{ cle: number; texte: string; sous: string } | null>(null);
  const precedent = useRef<string | null>(null);

  useEffect(() => {
    const cle = `${tour}:${phase}`;
    if (precedent.current === cle) return;
    precedent.current = cle;
    if (phase === "tour_alchimiste") return;
    const nuit = estPhaseNocturne(phase);
    if (nuit) {
      audio.gongNuit();
    } else if (phase === "debat_jour") {
      audio.clocheAube();
    }
    setAffichee({
      cle: Date.now(),
      texte: phase === "terminee" ? "Fin" : `${nuit ? "Nuit" : "Jour"} ${tour}`,
      sous: LIBELLES_PHASE[phase],
    });
    const t = window.setTimeout(() => setAffichee(null), 2700);
    return () => window.clearTimeout(t);
  }, [phase, tour]);

  if (!affichee) return null;
  return (
    <div key={affichee.cle} className="pointer-events-none fixed inset-0 z-9999 flex items-center justify-center">
      <div className="banniere-phase panneau px-10 py-6 text-center">
        <div className="font-pixel text-[clamp(20px,4vw,44px)] text-lanterne drop-shadow-[4px_4px_0_#140c1c]">
          {affichee.texte}
        </div>
        <div className="mt-3 font-pixel text-[clamp(9px,1.2vw,13px)] uppercase text-os">{affichee.sous}</div>
      </div>
    </div>
  );
}

// ─── Écran de fin ───────────────────────────────────────────────────────────

export function FinDePartie({
  partie,
  humain,
  onRejouer,
  onFermer,
  onOuvrirProfil,
}: {
  partie: EtatPartiePublic;
  humain: JoueurPublic | null;
  onRejouer: () => void;
  onFermer: () => void;
  onOuvrirProfil?: () => void;
}) {
  const [modalProfilLocal, setModalProfilLocal] = useState(false);
  const camp = partie.camp_vainqueur;
  const campHumain = humain?.role === "creature" ? "creatures" : "citoyens";
  const victoire = camp === campHumain;
  const survivantsCitoyens = partie.joueurs.filter((j) => j.est_vivant && j.role !== "creature");

  useEffect(() => {
    if (victoire) {
      audio.victoire();
    } else {
      audio.defaite();
    }
  }, [victoire]);

  const gererClicProfil = () => {
    if (onOuvrirProfil) {
      onOuvrirProfil();
    } else {
      setModalProfilLocal(true);
    }
  };

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-encre/85 backdrop-blur-xs p-4">
      <div className="panneau animate-apparaitre flex w-full max-w-2xl flex-col items-center gap-5 p-8 text-center shadow-2xl">
        {camp === "creatures" && (
          <div className="flex items-end justify-center gap-4">
            <div className="w-20 drop-shadow-[0_0_15px_rgba(180,32,42,0.9)]">
              <LoupAnime className="w-full" />
            </div>
            {survivantsCitoyens.map((s) => (
              <div key={s.id} className="flex flex-col items-center drop-shadow-[0_0_12px_rgba(180,32,42,0.6)]">
                <SpritePersonnage joueur={s} effraye className="w-16 sm:w-20" />
                <span className="font-pixel text-[7px] text-sang mt-0.5">{prenom(s.nom_affiche)}</span>
              </div>
            ))}
          </div>
        )}
        {camp === "citoyens" && survivantsCitoyens.length > 0 && (
          <div className="flex items-end justify-center gap-3 drop-shadow-[0_0_15px_rgba(244,180,27,0.8)]">
            {survivantsCitoyens.map((s) => (
              <div key={s.id} className="flex flex-col items-center">
                <SpritePersonnage joueur={s} victoire className="w-16 sm:w-20" />
                <span className="font-pixel text-[7px] text-lanterne mt-0.5">{prenom(s.nom_affiche)}</span>
              </div>
            ))}
          </div>
        )}
        <div className={`font-pixel text-[clamp(18px,3vw,30px)] ${victoire ? "text-lanterne" : "text-sang"}`}>
          {victoire ? "Victoire !" : "Défaite..."}
        </div>
        <div className="text-[24px]">{camp ? LIBELLES_CAMP[camp] : ""}</div>
        <div className="grid w-full grid-cols-3 gap-4 sm:grid-cols-6 items-end">
          {[...partie.joueurs]
            .sort((a, b) => a.numero_siege - b.numero_siege)
            .map((j) => (
              <div key={j.id} className="flex flex-col items-center gap-1">
                <SpritePersonnage
                  joueur={j}
                  mortSiMort={true}
                  victoire={camp === "citoyens" && j.est_vivant && j.role !== "creature"}
                  effraye={camp === "creatures" && j.est_vivant && j.role !== "creature"}
                  loupSiCreature={camp === "creatures" && j.role === "creature" && j.est_vivant}
                  className="w-16"
                />
                <IconeRole role={j.role} className="h-6 w-6" />
                <div className={`font-pixel text-[7px] leading-relaxed ${!j.est_vivant ? "line-through opacity-70" : ""}`}>
                  {prenom(j.nom_affiche)}
                </div>
                <div className="text-[15px] leading-none text-parchemin-sombre">{j.role ? LIBELLES_ROLE[j.role].nom : "?"}</div>
              </div>
            ))}
        </div>
        <div className="text-parchemin-sombre">
          {partie.tokens_total_utilises.toLocaleString("fr-FR")} tokens · ${partie.cout_estime_usd.toFixed(4)}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="bouton bouton-action font-pixel text-[10px]!"
            onClick={gererClicProfil}
          >
            🏆 Voir mes Statistiques & Trophées
          </button>
          <button type="button" className="bouton bouton-nuit text-[10px]!" onClick={onFermer}>
            Revoir le plateau
          </button>
          <button type="button" className="bouton text-[10px]!" onClick={onRejouer}>
            Nouvelle partie
          </button>
        </div>
      </div>

      <ModalProfil
        ouvert={modalProfilLocal}
        joueurId={humain?.id || "00000000-0000-0000-0000-000000000001"}
        nomAffiche={humain?.nom_affiche}
        onFermer={() => setModalProfilLocal(false)}
      />
    </div>
  );
}
