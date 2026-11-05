import { useState } from 'react';
import { Flame, Lock, MessageSquare, Send, Skull } from 'lucide-react';
import {
  resoudreAvatarHumain,
  type CanalMessage,
  type MessagePartie,
  type RolePersonnage,
} from '../types/database.types';

interface ChatPanelProps {
  messages: MessagePartie[];
  roleHumain: RolePersonnage | null;
  humainVivant: boolean;
  onSendMessage: (contenu: string, canal: CanalMessage) => Promise<void>;
}

export function ChatPanel({
  messages,
  roleHumain,
  humainVivant,
  onSendMessage,
}: ChatPanelProps) {
  const [canalActif, setCanalActif] = useState<CanalMessage>('village_public');
  const [texte, setTexte] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const peutVoirSecretCreatures = roleHumain === 'creature';
  const messagesFiltres = messages.filter((m) => {
    if (canalActif === 'village_public') {
      return m.canal === 'village_public' || m.canal === 'systeme';
    }
    return m.canal === canalActif;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texte.trim() || envoiEnCours) return;
    setEnvoiEnCours(true);
    try {
      await onSendMessage(texte.trim(), canalActif);
      setTexte('');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="flex flex-col h-[38rem] md:h-[43rem] rounded-2xl border border-amber-900/50 bg-black/60 backdrop-blur-md shadow-2xl overflow-hidden font-serif text-amber-100">
      {/* Onglets de canaux en Glassmorphism sombre */}
      <div className="flex items-center border-b border-amber-900/50 bg-black/60 px-3 pt-3 gap-2">
        <button
          type="button"
          onClick={() => setCanalActif('village_public')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold transition ${
            canalActif === 'village_public'
              ? 'bg-amber-950/70 text-amber-100 border-t border-x border-amber-900/50'
              : 'text-amber-100/60 hover:text-amber-100'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Table de Taverne</span>
        </button>

        <button
          type="button"
          disabled={!peutVoirSecretCreatures}
          onClick={() => setCanalActif('creature_secret')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold transition ${
            canalActif === 'creature_secret'
              ? 'bg-red-950/80 text-red-200 border-t border-x border-red-800/60'
              : peutVoirSecretCreatures
                ? 'text-red-400 hover:text-red-200'
                : 'text-stone-600 cursor-not-allowed'
          }`}
          title={
            peutVoirSecretCreatures
              ? 'Canal secret nocturne des Créatures'
              : 'Réservé au camp des Créatures (RLS Anti-Triche)'
          }
        >
          {peutVoirSecretCreatures ? (
            <Flame className="w-3.5 h-3.5" />
          ) : (
            <Lock className="w-3.5 h-3.5" />
          )}
          <span>Créatures</span>
        </button>

        <button
          type="button"
          disabled={humainVivant}
          onClick={() => setCanalActif('chat_morts')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold transition ${
            canalActif === 'chat_morts'
              ? 'bg-stone-900/90 text-stone-200 border-t border-x border-amber-900/50'
              : !humainVivant
                ? 'text-stone-400 hover:text-stone-200'
                : 'text-stone-600 cursor-not-allowed'
          }`}
        >
          <Skull className="w-3.5 h-3.5" />
          <span>Morts</span>
        </button>
      </div>

      {/* Liste des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messagesFiltres.length === 0 ? (
          <div className="text-center text-xs text-amber-100/50 py-14 italic">
            Le silence règne autour de la table de la taverne...
          </div>
        ) : (
          messagesFiltres.map((m) => {
            if (m.canal === 'systeme') {
              return (
                <div
                  key={m.id}
                  className="px-3.5 py-2.5 rounded-xl bg-black/60 border border-amber-900/50 text-amber-200 text-xs text-center italic"
                >
                  🕯️ {m.contenu}
                </div>
              );
            }
            const nom = m.nom_emetteur || 'Convive';
            const avatarUrl = resoudreAvatarHumain({
              nom_affiche: nom,
              est_humain: !m.est_ia,
            });
            return (
              <div
                key={m.id}
                className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  m.canal === 'creature_secret'
                    ? 'bg-red-950/50 border-red-900/60 text-red-100'
                    : m.est_ia
                      ? 'bg-black/60 border-amber-900/50 text-amber-100'
                      : 'bg-amber-950/60 border-amber-700/60 text-amber-100 ml-4'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <img
                    src={avatarUrl}
                    alt={nom}
                    className="w-9 h-9 rounded-full border-2 border-amber-900 object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-amber-300 truncate">
                        {nom}
                      </span>
                      <span className="text-[10px] text-amber-200/60">
                        Tour {m.tour}
                      </span>
                    </div>
                    <p className="italic text-amber-100/95">« {m.contenu} »</p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {envoiEnCours && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/60 border border-amber-800/40 text-amber-300 text-xs italic animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Un convive s'apprête à vous répondre...</span>
          </div>
        )}
      </div>

      {/* Formulaire de prise de parole */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-amber-900/50 bg-black/60 flex items-center gap-2"
      >
        <input
          type="text"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Prendre la parole autour de la table..."
          className="flex-1 bg-black/70 border border-amber-900/50 rounded-xl px-3.5 py-2 text-xs text-amber-100 placeholder:text-amber-100/40 focus:outline-none focus:border-amber-600"
        />
        <button
          type="submit"
          disabled={envoiEnCours || !texte.trim()}
          className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 font-bold text-xs flex items-center gap-1.5 border border-amber-600/50 transition cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Parler</span>
        </button>
      </form>
    </div>
  );
}
