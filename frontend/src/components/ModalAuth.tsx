import { useState, type FormEvent } from "react";
import { supabase } from "../api/supabase";

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onConnecte: (user: { id: string; email?: string; nom: string }) => void;
}

export function ModalAuth({ ouvert, onFermer, onConnecte }: Props) {
  const [onglet, setOnglet] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [nom, setNom] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  if (!ouvert) return null;

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setSucces(null);
    setChargement(true);

    try {
      if (onglet === "connexion") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: motDePasse,
        });
        if (error) throw error;
        if (data.user) {
          const pseudo = (data.user.user_metadata?.username as string) || email.split("@")[0];
          onConnecte({ id: data.user.id, email: data.user.email, nom: pseudo });
          onFermer();
        }
      } else {
        if (nom.trim().length < 2) {
          throw new Error("Le pseudo doit contenir au moins 2 caractères.");
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: motDePasse,
          options: {
            data: {
              username: nom.trim(),
              ai_act_consent: true,
            },
          },
        });
        if (error) throw error;
        if (data.user) {
          setSucces("Compte créé avec succès ! Vous pouvez maintenant jouer.");
          onConnecte({ id: data.user.id, email: data.user.email, nom: nom.trim() });
          setTimeout(() => {
            onFermer();
          }, 1200);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErreur(err.message);
      } else {
        setErreur("Une erreur est survenue lors de l'authentification.");
      }
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-encre/80 backdrop-blur-xs p-4">
      <div className="panneau animate-apparaitre flex w-full max-w-md flex-col gap-5 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-nuit-700 pb-3">
          <div className="font-pixel text-[12px] text-lanterne">
            {onglet === "connexion" ? "🔑 Connexion Supabase" : "📜 Nouveau Citoyen"}
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="text-os/60 hover:text-os font-pixel text-[12px]"
          >
            ✕
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setOnglet("connexion");
              setErreur(null);
            }}
            className={`flex-1 py-1.5 font-pixel text-[10px] uppercase transition-colors ${
              onglet === "connexion"
                ? "bg-lanterne text-encre font-bold"
                : "bg-nuit-900 text-os/70 hover:bg-nuit-800"
            }`}
          >
            Se Connecter
          </button>
          <button
            type="button"
            onClick={() => {
              setOnglet("inscription");
              setErreur(null);
            }}
            className={`flex-1 py-1.5 font-pixel text-[10px] uppercase transition-colors ${
              onglet === "inscription"
                ? "bg-lanterne text-encre font-bold"
                : "bg-nuit-900 text-os/70 hover:bg-nuit-800"
            }`}
          >
            Créer un compte
          </button>
        </div>

        {erreur && (
          <div className="bg-sang/20 border border-sang px-3 py-2 text-sang font-sans text-xs">
            {erreur}
          </div>
        )}

        {succes && (
          <div className="bg-emerald-950/60 border border-emerald-500 px-3 py-2 text-emerald-300 font-sans text-xs">
            {succes}
          </div>
        )}

        <form onSubmit={soumettre} className="flex flex-col gap-4">
          {onglet === "inscription" && (
            <div className="flex flex-col gap-1">
              <label className="font-pixel text-[9px] uppercase text-parchemin-sombre">
                Pseudo en jeu
              </label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex : Sarah, Billy, Victor..."
                required
                minLength={2}
                maxLength={30}
                className="panneau bg-nuit-900 px-3 py-2 text-sm text-os outline-none focus:border-lanterne"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-pixel text-[9px] uppercase text-parchemin-sombre">
              Adresse Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="citoyen@studiolanterne.fr"
              required
              className="panneau bg-nuit-900 px-3 py-2 text-sm text-os outline-none focus:border-lanterne"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-pixel text-[9px] uppercase text-parchemin-sombre">
              Mot de passe
            </label>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="panneau bg-nuit-900 px-3 py-2 text-sm text-os outline-none focus:border-lanterne"
            />
          </div>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onFermer}
              className="bouton bouton-nuit flex-1 py-2 text-[10px]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={chargement}
              className="bouton bouton-action flex-1 py-2 text-[10px] text-encre"
            >
              {chargement
                ? "Chargement..."
                : onglet === "connexion"
                ? "Connexion"
                : "Créer le profil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

