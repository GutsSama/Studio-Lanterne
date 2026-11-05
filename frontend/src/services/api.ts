import type {
  CanalMessage,
  EtatPartieClient,
  MessagePartie,
  PersonnaliteIA,
  ReponseSimulationTour,
  RolePersonnage,
  TypeActionJeu,
} from '../types/database.types';

/**
 * Appel résilient : passe d'abord par le proxy Vite `/api` (même origine, zéro blocage CORS),
 * et bascule automatiquement sur `http://127.0.0.1:8000/api` en secours.
 */
async function fetchApi(
  chemin: string,
  options?: RequestInit
): Promise<Response> {
  try {
    return await fetch(`http://127.0.0.1:8000${chemin}`, options);
  } catch {
    return fetch(chemin, options);
  }
}

export async function listerPersonnalites(): Promise<PersonnaliteIA[]> {
  const res = await fetchApi('/api/personnalites');
  if (!res.ok) throw new Error('Impossible de charger les personnalités IA.');
  return res.json();
}

export async function creerNouvellePartie(
  nomHumain: string,
  consentementAiAct: boolean,
  roleHumainForce: RolePersonnage | null = null
): Promise<EtatPartieClient> {
  const res = await fetchApi('/api/parties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom_humain: nomHumain,
      consentement_ai_act: consentementAiAct,
      role_humain_force: roleHumainForce,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erreur serveur' }));
    throw new Error(err.detail || 'Erreur lors de la création de la partie.');
  }
  return res.json();
}

export async function simulerTourIA(
  partieId: string
): Promise<ReponseSimulationTour> {
  const res = await fetchApi(`/api/parties/${partieId}/simuler-tour`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erreur simulation' }));
    throw new Error(err.detail || 'Erreur lors de la simulation du tour IA.');
  }
  return res.json();
}

export interface ReponseEnvoiMessage {
  message: MessagePartie;
  reponse_ia: MessagePartie | null;
}

export async function envoyerMessageJoueur(
  partieId: string,
  joueurId: string,
  contenu: string,
  canal: CanalMessage = 'village_public'
): Promise<ReponseEnvoiMessage> {
  const res = await fetchApi(`/api/parties/${partieId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      joueur_id: joueurId,
      contenu,
      canal,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Message refusé' }));
    throw new Error(err.detail || 'Impossible d’envoyer le message.');
  }
  return res.json();
}

export async function voterContreJoueur(
  partieId: string,
  votantId: string,
  cibleId: string,
  argumentation?: string
): Promise<void> {
  const res = await fetchApi(`/api/parties/${partieId}/votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      votant_id: votantId,
      cible_id: cibleId,
      argumentation: argumentation || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Vote invalide' }));
    throw new Error(err.detail || 'Vote refusé par le moteur de règles.');
  }
}

export async function executerActionSpeciale(
  partieId: string,
  acteurId: string,
  typeAction: TypeActionJeu,
  cibleId: string | null = null
): Promise<Record<string, unknown>> {
  const res = await fetchApi(`/api/parties/${partieId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      acteur_id: acteurId,
      type_action: typeAction,
      cible_id: cibleId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Action invalide' }));
    throw new Error(err.detail || 'Action refusée par le moteur de règles.');
  }
  return res.json();
}
