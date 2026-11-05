import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { EvenementPotion } from '../components/PotionPopup';
import type {
  ActionPartieRow,
  EtatPartieClient,
  JoueurPartie,
  MessagePartie,
  PartieRow,
} from '../types/database.types';

interface UseGameRealtimeOptions {
  partie: EtatPartieClient | null;
  onPhaseChange: (nouvellePhase: PartieRow['phase_actuelle']) => void;
  onPlayerEliminated: (victime: JoueurPartie) => void;
  onPotionAction: (evenement: EvenementPotion) => void;
  onNewMessage: (msg: MessagePartie) => void;
}

/**
 * Hook temps réel Supabase (`useGameRealtime`) écoutant :
 * - `parties` (changements de `phase_actuelle` -> `<PhaseTransition />`)
 * - `joueurs_partie` (`est_vivant` passant à `false` -> `<BloodSplatter />` & `<EmptyChair />`)
 * - `actions_partie` (`alchimiste_soigner` / `alchimiste_empoisonner` -> `<PotionPopup />`)
 * - `messages_partie` (nouveaux dialogues autour de la table)
 */
export function useGameRealtime({
  partie,
  onPhaseChange,
  onPlayerEliminated,
  onPotionAction,
  onNewMessage,
}: UseGameRealtimeOptions) {
  useEffect(() => {
    const client = supabase;
    if (!partie?.id || !client) return;

    const partieId = partie.id;
    const channel = client
      .channel(`taverne-partie-${partieId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parties',
          filter: `id=eq.${partieId}`,
        },
        (payload) => {
          const row = payload.new as PartieRow;
          if (row.phase_actuelle && row.phase_actuelle !== partie.phase_actuelle) {
            onPhaseChange(row.phase_actuelle);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'joueurs_partie',
          filter: `partie_id=eq.${partieId}`,
        },
        (payload) => {
          const row = payload.new as JoueurPartie;
          const ancien = partie.joueurs.find((j) => j.id === row.id);
          if (ancien && ancien.est_vivant && !row.est_vivant) {
            onPlayerEliminated({ ...ancien, ...row });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'actions_partie',
          filter: `partie_id=eq.${partieId}`,
        },
        (payload) => {
          const action = payload.new as ActionPartieRow;
          if (
            action.type_action === 'alchimiste_soigner' ||
            action.type_action === 'alchimiste_empoisonner'
          ) {
            const cible = partie.joueurs.find(
              (j) => j.id === action.joueur_cible_id
            );
            onPotionAction({
              id: action.id,
              typeAction: action.type_action,
              cibleNom: cible?.nom_affiche || 'un convive de la table',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages_partie',
          filter: `partie_id=eq.${partieId}`,
        },
        (payload) => {
          const msg = payload.new as MessagePartie;
          onNewMessage(msg);
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [
    partie,
    onPhaseChange,
    onPlayerEliminated,
    onPotionAction,
    onNewMessage,
  ]);
}
