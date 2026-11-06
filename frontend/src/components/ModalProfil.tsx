import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ProfilComplet, UUID } from "../types/game";

const INVITE_PROFIL_ID = "00000000-0000-0000-0000-000000000001";

interface Props {
  ouvert: boolean;
  joueurId?: UUID | null;
  nomAffiche?: string;
  onFermer: () => void;
}

export function ModalProfil({ ouvert, joueurId, nomAffiche, onFermer }: Props) {
  const [onglet, setOnglet] = useState<"stats" | "succes">("stats");
  const [donnees, setDonnees] = useState<ProfilComplet | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const cibleId = joueurId || INVITE_PROFIL_ID;

  useEffect(() => {
    if (!ouvert) return;
    setChargement(true);
    setErreur(null);

    api
      .obtenirProfil(cibleId)
      .then((res) => {
        setDonnees(res);
      })
      .catch((err) => {
        setErreur(err instanceof Error ? err.message : "Impossible de charger le profil.");
      })
      .finally(() => {
        setChargement(false);
      });
  }, [ouvert, cibleId]);

  if (!ouvert) return null;

  const stats = donnees?.statistiques;
  const succes = donnees?.succes ?? [];
  const profil = donnees?.profil;

  const totalJouees = stats?.parties_jouees ?? 0;
  const totalGagnees = stats?.parties_gagnees ?? 0;
  const totalPerdues = stats?.parties_perdues ?? 0;
  const tauxVictoire = totalJouees > 0 ? Math.round((totalGagnees / totalJouees) * 100) : 0;

  const pointsDebloques = succes
    .filter((s) => s.debloque)
    .reduce((somme, s) => somme + s.points, 0);
  const totalPoints = succes.reduce((somme, s) => somme + s.points, 0);

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-encre/85 backdrop-blur-xs p-4">
      <div className="panneau animate-apparaitre flex w-full max-w-2xl flex-col gap-5 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-nuit-700 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📜</span>
            <div>
              <div className="font-pixel text-[13px] text-lanterne">
                Registre du Village & Statistiques
              </div>
              <div className="text-xs text-parchemin-sombre">
                Profil de {nomAffiche || profil?.nom_utilisateur || "Citoyen Invité"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="text-os/60 hover:text-os font-pixel text-[13px] px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOnglet("stats")}
            className={`flex-1 py-1.5 font-pixel text-[10px] uppercase transition-colors ${
              onglet === "stats"
                ? "bg-lanterne text-encre font-bold shadow-sm"
                : "bg-nuit-900 text-os/70 hover:bg-nuit-800"
            }`}
          >
            📊 Statistiques ({totalJouees} parties)
          </button>
          <button
            type="button"
            onClick={() => setOnglet("succes")}
            className={`flex-1 py-1.5 font-pixel text-[10px] uppercase transition-colors ${
              onglet === "succes"
                ? "bg-lanterne text-encre font-bold shadow-sm"
                : "bg-nuit-900 text-os/70 hover:bg-nuit-800"
            }`}
          >
            🏆 Trophées ({pointsDebloques}/{totalPoints || 115} pts)
          </button>
        </div>

        {chargement && (
          <div className="py-12 text-center font-pixel text-xs text-lanterne animate-pulse">
            Consultation des archives du village...
          </div>
        )}

        {erreur && (
          <div className="bg-sang/20 border border-sang p-3 text-sang text-xs">
            {erreur}
          </div>
        )}

        {!chargement && !erreur && (
          <>
            {/* Contenu : Onglet Statistiques */}
            {onglet === "stats" && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="panneau bg-nuit-900/80 p-3 text-center border border-nuit-700">
                    <div className="font-pixel text-[18px] text-os">{totalJouees}</div>
                    <div className="font-pixel text-[8px] uppercase text-parchemin-sombre mt-1">
                      Parties Jouées
                    </div>
                  </div>
                  <div className="panneau bg-nuit-900/80 p-3 text-center border border-nuit-700">
                    <div className="font-pixel text-[18px] text-emerald-400">{tauxVictoire}%</div>
                    <div className="font-pixel text-[8px] uppercase text-parchemin-sombre mt-1">
                      Taux de Victoire
                    </div>
                  </div>
                  <div className="panneau bg-nuit-900/80 p-3 text-center border border-nuit-700">
                    <div className="font-pixel text-[18px] text-lanterne">{stats?.victoires_citoyens ?? 0}</div>
                    <div className="font-pixel text-[8px] uppercase text-parchemin-sombre mt-1">
                      🛡️ Citoyens
                    </div>
                  </div>
                  <div className="panneau bg-nuit-900/80 p-3 text-center border border-nuit-700">
                    <div className="font-pixel text-[18px] text-sang">{stats?.victoires_creatures ?? 0}</div>
                    <div className="font-pixel text-[8px] uppercase text-parchemin-sombre mt-1">
                      🐺 Créatures
                    </div>
                  </div>
                </div>

                <div className="panneau bg-nuit-900 p-4 border border-nuit-700 flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-parchemin-sombre">Bilan des affrontements :</span>
                    <span className="text-os font-bold">
                      {totalGagnees} V / {totalPerdues} D
                    </span>
                  </div>
                  {/* Barre de progression visuelle */}
                  <div className="h-3 w-full bg-sang/40 overflow-hidden border border-nuit-700">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${totalJouees > 0 ? (totalGagnees / totalJouees) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-parchemin-sombre mt-1">
                    <span className="text-emerald-400">● Victoires : {totalGagnees}</span>
                    <span className="text-sang">● Défaites : {totalPerdues}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Contenu : Onglet Trophées & Succès */}
            {onglet === "succes" && (
              <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                {succes.map((s) => (
                  <div
                    key={s.id}
                    className={`panneau p-3 flex items-start gap-3 transition-all ${
                      s.debloque
                        ? "bg-amber-950/20 border-lanterne shadow-[0_0_10px_rgba(244,180,27,0.15)]"
                        : "bg-nuit-900/50 border-nuit-800 opacity-60"
                    }`}
                  >
                    <div className="text-3xl shrink-0 p-1">
                      {s.debloque ? s.icone_badge : "🔒"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-pixel text-[11px] ${
                            s.debloque ? "text-lanterne" : "text-os/70"
                          }`}
                        >
                          {s.titre}
                        </span>
                        <span className="font-pixel text-[9px] bg-nuit-800 px-2 py-0.5 text-parchemin-sombre">
                          +{s.points} pts
                        </span>
                      </div>
                      <div className="text-xs text-parchemin-sombre mt-1 leading-snug">
                        {s.description}
                      </div>
                      {s.debloque && s.debloque_le && (
                        <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                          ✓ Débloqué le {new Date(s.debloque_le).toLocaleDateString("fr-FR")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-nuit-700">
          <button
            type="button"
            onClick={onFermer}
            className="bouton bouton-nuit py-1.5! px-4! text-xs!"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
