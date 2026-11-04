import { useState, type FormEvent } from "react";
import { ROLES_PERSONNAGE, type ArchetypeIA, type JoueurPublic, type RolePersonnage } from "../types/game";
import { LIBELLES_ROLE } from "../game/libelles";
import { spriteVillage } from "../pixel/decor";
import { ImagePixel, SpritePersonnage } from "./Sprites";

const PRESENTATION: ReadonlyArray<{ archetype: ArchetypeIA; nom: string; trait: string }> = [
  { archetype: "mauvais_joueur", nom: "Gérard", trait: "Le Râleur" },
  { archetype: "stratege", nom: "Elena", trait: "La Stratège" },
  { archetype: "drole", nom: "Bob", trait: "Le Rigolo" },
  { archetype: "mystique", nom: "Béatrice", trait: "La Mystique" },
  { archetype: "paranoiaque", nom: "Lucas", trait: "Le Paranoïaque" },
];

function joueurFictif(id: string, nom: string, archetype: ArchetypeIA | null, estHumain: boolean): JoueurPublic {
  return {
    id,
    est_humain: estHumain,
    nom_affiche: nom,
    avatar_url: "",
    modele_ia: null,
    archetype,
    role: null,
    est_vivant: true,
    numero_siege: 0,
    tour_mort: null,
    cause_mort: null,
  };
}

interface Props {
  occupe: boolean;
  erreur: string | null;
  onCommencer: (nom: string, roleForce: RolePersonnage | null) => void;
}

export function EcranTitre({ occupe, erreur, onCommencer }: Props) {
  const [nom, setNom] = useState("");
  const [consentement, setConsentement] = useState(false);
  const [roleForce, setRoleForce] = useState<RolePersonnage | "">("");
  const nomValide = nom.trim().length >= 2 && nom.trim().length <= 30;

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    if (!nomValide || !consentement) return;
    onCommencer(nom.trim(), roleForce === "" ? null : roleForce);
  };

  return (
    <div className="scanlines relative flex min-h-full items-center justify-center overflow-hidden p-4">
      <ImagePixel src={spriteVillage(true)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-nuit-900/40 to-nuit-900" />

      <form onSubmit={soumettre} className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6">
        <div className="text-center">
          <div className="font-pixel text-[10px] uppercase tracking-widest text-parchemin-sombre">Studio Lanterne présente</div>
          <h1 className="mt-4 font-pixel text-[clamp(22px,4.5vw,44px)] leading-snug text-lanterne drop-shadow-[4px_4px_0_#140c1c]">
            Créatures
            <br />
            de la Nuit
          </h1>
          <div className="mt-2 font-pixel text-[clamp(12px,2vw,18px)] text-sang drop-shadow-[3px_3px_0_#140c1c]">vs IA</div>
        </div>

        {/* Les 5 adversaires IA */}
        <div className="flex items-end justify-center gap-[clamp(4px,2vw,24px)]">
          {PRESENTATION.map((p) => (
            <div key={p.archetype} className="flex flex-col items-center">
              <SpritePersonnage joueur={joueurFictif(p.archetype, p.nom, p.archetype, false)} className="w-[clamp(48px,9vw,96px)]" />
              <div className="font-pixel text-[clamp(6px,0.9vw,9px)] text-os">{p.nom}</div>
              <div className="text-[clamp(12px,1.5vw,17px)] text-parchemin-sombre">{p.trait}</div>
            </div>
          ))}
        </div>

        <div className="panneau flex w-full max-w-lg flex-col gap-4 p-6">
          <label className="flex flex-col gap-2">
            <span className="font-pixel text-[9px] uppercase text-lanterne">Ton nom de villageois</span>
            <div className="flex items-center gap-3">
              <SpritePersonnage joueur={joueurFictif("humain", nom || "?", null, true)} className="w-14 shrink-0" />
              <input
                className="champ w-full"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                minLength={2}
                maxLength={30}
                placeholder="Sarah"
                autoFocus
              />
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 leading-tight">
            <input
              type="checkbox"
              checked={consentement}
              onChange={(e) => setConsentement(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-lanterne"
            />
            <span>
              <b className="text-lanterne">Transparence AI Act :</b> je comprends que les 5 autres villageois sont des{" "}
              <b>agents d'intelligence artificielle</b> (Groq, Mistral AI, Google Gemini) et non des humains.
            </span>
          </label>

          <details className="text-parchemin-sombre">
            <summary className="cursor-pointer font-pixel text-[8px] uppercase">Options de test</summary>
            <select
              className="champ mt-3 w-full"
              value={roleForce}
              onChange={(e) => setRoleForce(e.target.value as RolePersonnage | "")}
            >
              <option value="">Rôle aléatoire</option>
              {ROLES_PERSONNAGE.map((r) => (
                <option key={r} value={r}>
                  Forcer : {LIBELLES_ROLE[r].nom}
                </option>
              ))}
            </select>
          </details>

          {erreur && <div className="bg-sang/30 px-2 py-1">⚠ {erreur}</div>}

          <button type="submit" className="bouton text-[12px]!" disabled={!nomValide || !consentement || occupe}>
            {occupe ? "Le village se prépare..." : "Entrer dans le village"}
          </button>
        </div>
      </form>
    </div>
  );
}

