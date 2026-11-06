import { useEffect, useState, type FormEvent } from "react";
import { ROLES_PERSONNAGE, type ArchetypeIA, type JoueurPublic, type RolePersonnage } from "../types/game";
import { LIBELLES_ROLE } from "../game/libelles";
import { SpritePersonnage, definirGenreJoueur, obtenirGenreJoueur, type GenreJoueur } from "./Sprites";
import { ModalAuth } from "./ModalAuth";
import { supabase } from "../api/supabase";

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
  onCommencer: (nom: string, roleForce: RolePersonnage | null, hoteId?: string) => void;
}

export function EcranTitre({ occupe, erreur, onCommencer }: Props) {
  const [nom, setNom] = useState("");
  const [genre, setGenreState] = useState<GenreJoueur>(obtenirGenreJoueur);
  const [consentement, setConsentement] = useState(false);
  const [roleForce, setRoleForce] = useState<RolePersonnage | "">("");
  const [utilisateur, setUtilisateur] = useState<{ id: string; email?: string; nom: string } | null>(null);
  const [modalAuthOuvert, setModalAuthOuvert] = useState(false);

  const nomValide = nom.trim().length >= 2 && nom.trim().length <= 30;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const pseudo = (session.user.user_metadata?.username as string) || session.user.email?.split("@")[0] || "Citoyen";
        setUtilisateur({ id: session.user.id, email: session.user.email, nom: pseudo });
        setNom((n) => (n ? n : pseudo));
        setConsentement(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const pseudo = (session.user.user_metadata?.username as string) || session.user.email?.split("@")[0] || "Citoyen";
        setUtilisateur({ id: session.user.id, email: session.user.email, nom: pseudo });
        setNom((n) => (n ? n : pseudo));
        setConsentement(true);
      } else {
        setUtilisateur(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const choisirGenre = (nouveauGenre: GenreJoueur) => {
    definirGenreJoueur(nouveauGenre);
    setGenreState(nouveauGenre);
  };

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    if (!nomValide || !consentement) return;
    onCommencer(nom.trim(), roleForce === "" ? null : roleForce, utilisateur?.id);
  };

  return (
    <div className="scanlines relative flex min-h-full items-center justify-center overflow-hidden p-4">
      <img
        src="/sprites/villagenuit.jpeg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover pixelise select-none opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-nuit-900/40 to-nuit-900" />

      {/* Barre d'authentification supérieure */}
      <div className="absolute top-4 right-4 z-20">
        {utilisateur ? (
          <div className="panneau flex items-center gap-3 bg-nuit-900/90 px-3 py-1.5 font-pixel text-[9px]">
            <span className="text-lanterne">👤 {utilisateur.nom}</span>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="text-sang hover:underline ml-2"
            >
              Déconnexion
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModalAuthOuvert(true)}
            className="bouton bouton-nuit py-1.5! px-3! font-pixel text-[9px]! text-lanterne border border-lanterne/40 hover:border-lanterne"
          >
            🔑 Connexion / Inscription
          </button>
        )}
      </div>

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
            <span className="font-pixel text-[9px] uppercase text-lanterne">Ton villageois (nom & avatar)</span>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <SpritePersonnage joueur={joueurFictif("humain", nom || "?", null, true)} className="w-16" />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => choisirGenre("masculin")}
                    className={`px-2 py-1 font-pixel text-[8px] uppercase transition-colors ${
                      genre === "masculin" ? "bg-lanterne text-encre font-bold shadow-sm" : "bg-nuit-700 text-os hover:bg-nuit-600"
                    }`}
                  >
                    Homme
                  </button>
                  <button
                    type="button"
                    onClick={() => choisirGenre("femme")}
                    className={`px-2 py-1 font-pixel text-[8px] uppercase transition-colors ${
                      genre === "femme" ? "bg-lanterne text-encre font-bold shadow-sm" : "bg-nuit-700 text-os hover:bg-nuit-600"
                    }`}
                  >
                    Femme
                  </button>
                </div>
              </div>
              <input
                className="champ w-full self-center"
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

      <ModalAuth
        ouvert={modalAuthOuvert}
        onFermer={() => setModalAuthOuvert(false)}
        onConnecte={(u) => {
          setUtilisateur(u);
          setNom(u.nom);
          setConsentement(true);
        }}
      />
    </div>
  );
}
