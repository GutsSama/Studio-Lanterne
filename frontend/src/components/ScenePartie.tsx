import { useEffect, useState } from "react";
import type { JoueurPublic, MessagePartie, UUID } from "../types/game";
import { LIBELLES_CAUSE_MORT, prenom } from "../game/libelles";
import { IconeRole, SpritePersonnage } from "./Sprites";

/**
 * Positions des 6 sièges autour de la place (en % de l'image 2752×1536) :
 * - Disposés en arc de cercle autour du foyer central (50.15%, 71.2%)
 */
const SIEGES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 18, y: 77 },
  { x: 29, y: 61 },
  { x: 42, y: 55 },
  { x: 58, y: 55 },
  { x: 71, y: 61 },
  { x: 82, y: 77 },
];

interface Props {
  joueurs: JoueurPublic[];
  nuit: boolean;
  /** Dernier message affiché, pour la bulle de dialogue. */
  dernierMessage: MessagePartie | null;
  ciblesPossibles: ReadonlySet<UUID>;
  cibleSelectionnee: UUID | null;
  onSelection: (id: UUID) => void;
  /** Résultats d'inspection de l'Inquisiteur : {joueur_id: camp}. */
  inspections: Record<UUID, string>;
  joueursQuiParlent: ReadonlySet<UUID>;
}

/**
 * Feu de camp animé :
 * - Visible UNIQUEMENT la nuit (`opacity: nuit ? 1 : 0`)
 * - Superposé au pixel près sur le cercle de pierres (left: 50.15%, top: 71.2%, width: 8.3%)
 * - Animation ralentie à 450 ms par frame pour un crépitement doux et posé
 */
function FeuDeCamp({ nuit }: { nuit: boolean }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!nuit) return;
    const t = window.setInterval(() => setFrame((f) => (f + 1) % 4), 450);
    return () => window.clearInterval(t);
  }, [nuit]);

  return (
    <div
      className="absolute pointer-events-none select-none transition-opacity duration-[1200ms]"
      style={{
        left: "50.15%",
        top: "71.2%",
        width: "8.3%",
        aspectRatio: "180 / 261",
        transform: "translate(-50%, -100%)",
        zIndex: 55,
        opacity: nuit ? 1 : 0, // Absent la journée, allumé la nuit
      }}
    >
      <div
        className="w-full h-full pixelise"
        style={{
          backgroundImage: "url(/sprites/feu_sheet.png)",
          backgroundSize: "400% 100%",
          backgroundPosition: `${frame * 33.333}% 0%`,
        }}
      />
    </div>
  );
}

export function ScenePartie({
  joueurs,
  nuit,
  dernierMessage,
  ciblesPossibles,
  cibleSelectionnee,
  onSelection,
  inspections,
  joueursQuiParlent,
}: Props) {
  const tries = [...joueurs].sort((a, b) => a.numero_siege - b.numero_siege);
  const bulleVisible = useBulle(dernierMessage);

  return (
    <div
      className="panneau relative w-full shrink-0 overflow-hidden isolate"
      style={{ aspectRatio: "2752 / 1536" }}
    >
      {/* 1. Décor Jour (avec le foyer éteint et sa fumée légère) */}
      <img
        src="/sprites/villagejour.jpeg"
        alt="Village Jour"
        className="absolute inset-0 h-full w-full pixelise select-none"
      />

      {/* 2. Décor Nuit (sans flamme statique parasite derrière l'animation) */}
      <img
        src="/sprites/villagenuit_propre.jpeg"
        alt="Village Nuit"
        className="absolute inset-0 h-full w-full pixelise select-none transition-opacity duration-[1800ms]"
        style={{ opacity: nuit ? 1 : 0 }}
      />

      {/* 3. Halo lumineux au sol (uniquement la nuit) */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-[1800ms]"
        style={{
          opacity: nuit ? 0.85 : 0,
          background:
            "radial-gradient(ellipse 34% 28% at 50.15% 68%, rgba(244,140,20,0.4), rgba(180,40,10,0.15) 50%, transparent 75%)",
        }}
      />

      {/* 4. Feu de camp animé (uniquement la nuit, calé sur les pierres) */}
      <FeuDeCamp nuit={nuit} />

      {/* 5. Les 6 participants disposés sur la place */}
      {tries.map((j, i) => {
        const siege = SIEGES[i] ?? { x: 50, y: 50 };
        const ciblable = ciblesPossibles.has(j.id);
        const selectionne = cibleSelectionnee === j.id;
        const parle = bulleVisible && dernierMessage?.joueur_emetteur_id === j.id;
        const inspection = inspections[j.id];

        return (
          <button
            key={j.id}
            type="button"
            disabled={!ciblable}
            onClick={() => onSelection(j.id)}
            className={`group absolute flex flex-col items-center ${ciblable ? "cursor-pointer" : "cursor-default"}`}
            style={{
              left: `${siege.x}%`,
              top: `${siege.y}%`,
              width: "10%",
              transform: "translate(-50%, -100%)",
              zIndex: Math.round(siege.y),
            }}
          >
            {/* Bulle de dialogue */}
            {parle && dernierMessage && (
              <div
                className="bulle animate-apparaitre absolute bottom-full left-1/2 mb-3 -translate-x-1/2 w-[220%] px-2 py-1 text-left font-terminal text-[clamp(12px,1.25vw,18px)] leading-tight shadow-md"
                style={{ zIndex: 200 }}
              >
                {dernierMessage.contenu.length > 110 ? `${dernierMessage.contenu.slice(0, 110)}…` : dernierMessage.contenu}
              </div>
            )}

            {/* Flèche de ciblage */}
            {selectionne && (
              <div className="absolute -top-[18%] animate-flotter font-pixel text-[clamp(10px,1.4vw,18px)] text-sang drop-shadow-[2px_2px_0_#140c1c]">
                ▼
              </div>
            )}
            {!selectionne && joueursQuiParlent.has(j.id) && (
              <div className="absolute -top-[12%] font-pixel text-[clamp(8px,1vw,12px)] text-lanterne">
                <span className="point-attente">•</span>
                <span className="point-attente [animation-delay:0.2s]">•</span>
                <span className="point-attente [animation-delay:0.4s]">•</span>
              </div>
            )}

            <div
              className={`relative w-full transition-transform duration-100 ${
                ciblable ? "group-hover:-translate-y-1 group-hover:drop-shadow-[0_0_6px_#f4b41b]" : ""
              } ${selectionne ? "drop-shadow-[0_0_8px_#b4202a]" : ""} ${parle ? "scale-110" : ""}`}
            >
              <SpritePersonnage joueur={j} className="w-full" />
            </div>

            {/* Plaque du nom */}
            <div
              className={`mt-0.5 flex items-center gap-1 whitespace-nowrap px-1 py-0.5 font-pixel text-[clamp(6px,0.7vw,10px)] ${
                j.est_humain ? "bg-lanterne text-encre" : "bg-encre/85 text-os"
              } ${!j.est_vivant ? "line-through opacity-70" : ""}`}
            >
              {j.role && <IconeRole role={j.role} className="h-[1.6em] w-[1.6em]" />}
              {j.est_humain ? `${prenom(j.nom_affiche)} (toi)` : prenom(j.nom_affiche)}
              {inspection && (
                <span
                  className={`ml-0.5 px-0.5 ${inspection === "creatures" ? "bg-sang text-os" : "bg-mousse text-os"}`}
                  title="Résultat de ton inspection"
                >
                  {inspection === "creatures" ? "☠" : "✓"}
                </span>
              )}
            </div>
            {!j.est_vivant && j.cause_mort && (
              <div className="font-terminal text-[clamp(10px,1vw,15px)] text-parchemin-sombre">
                {LIBELLES_CAUSE_MORT[j.cause_mort] ?? j.cause_mort}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function useBulle(message: MessagePartie | null): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!message?.joueur_emetteur_id) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(t);
  }, [message]);
  return visible;
}
