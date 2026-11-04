import { useEffect, useState } from "react";
import type { JoueurPublic, MessagePartie, UUID } from "../types/game";
import { IMAGES_FEU, spriteFeu, spriteVillage } from "../pixel/decor";
import { LIBELLES_CAUSE_MORT, prenom } from "../game/libelles";
import { IconeRole, ImagePixel, SpritePersonnage } from "./Sprites";

/** Positions des 6 sièges autour du feu (en % de la scène, ancrées aux pieds). */
const SIEGES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 17, y: 93 },
  { x: 24, y: 70 },
  { x: 39, y: 63 },
  { x: 61, y: 63 },
  { x: 76, y: 70 },
  { x: 83, y: 93 },
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

function Feu() {
  const [image, setImage] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setImage((i) => (i + 1) % IMAGES_FEU), 160);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="absolute" style={{ left: "50%", top: "82%", width: "9.4%", transform: "translate(-50%, -85%)" }}>
      <ImagePixel src={spriteFeu(image)} alt="Feu de camp" className="w-full" />
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
    <div className="panneau relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
      {/* Décor jour/nuit en fondu enchaîné */}
      <ImagePixel src={spriteVillage(false)} alt="" className="absolute inset-0 h-full w-full" />
      <ImagePixel
        src={spriteVillage(true)}
        alt=""
        className="absolute inset-0 h-full w-full transition-opacity duration-[1800ms]"
        style={{ opacity: nuit ? 1 : 0 }}
      />
      {/* Halo du feu */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-[1800ms]"
        style={{
          opacity: nuit ? 1 : 0.35,
          background: "radial-gradient(ellipse 30% 26% at 50% 78%, rgba(244,180,27,0.35), rgba(224,108,44,0.12) 55%, transparent 75%)",
        }}
      />
      <Feu />

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
              width: "13%",
              transform: "translate(-50%, -100%)",
              zIndex: Math.round(siege.y),
            }}
          >
            {/* Bulle de dialogue */}
            {parle && dernierMessage && (
              <div
                className="bulle animate-apparaitre absolute bottom-full left-1/2 mb-3 -translate-x-1/2 w-[220%] px-2 py-1 text-left font-terminal text-[clamp(12px,1.25vw,18px)] leading-tight"
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

/** La bulle reste visible 5 s après chaque nouveau message. */
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
