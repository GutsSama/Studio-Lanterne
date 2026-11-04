import type {
  ActionSpecialeRequete,
  CreerPartieRequete,
  EnvoyerMessageRequete,
  EtatPartiePublic,
  MessagePartie,
  SimulerTourReponse,
  UUID,
  VotePartie,
  VoterRequete,
} from "../types/game";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ErreurApi extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extraireDetail(corps: unknown, statut: number): string {
  if (typeof corps === "object" && corps !== null && "detail" in corps) {
    const detail = (corps as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return "Requête invalide (validation).";
  }
  return `Erreur serveur (${statut})`;
}

async function requete<T>(chemin: string, init?: RequestInit): Promise<T> {
  const rep = await fetch(`${BASE}${chemin}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const texte = await rep.text();
  const corps: unknown = texte ? JSON.parse(texte) : null;
  if (!rep.ok) throw new ErreurApi(rep.status, extraireDetail(corps, rep.status));
  return corps as T;
}

export const api = {
  creerPartie: (req: CreerPartieRequete) =>
    requete<EtatPartiePublic>("/api/parties", { method: "POST", body: JSON.stringify(req) }),

  obtenirPartie: (id: UUID) => requete<EtatPartiePublic>(`/api/parties/${id}`),

  simulerTour: (id: UUID) =>
    requete<SimulerTourReponse>(`/api/parties/${id}/simuler-tour`, { method: "POST" }),

  envoyerMessage: (id: UUID, req: EnvoyerMessageRequete) =>
    requete<MessagePartie>(`/api/parties/${id}/messages`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  voter: (id: UUID, req: VoterRequete) =>
    requete<VotePartie>(`/api/parties/${id}/votes`, { method: "POST", body: JSON.stringify(req) }),

  agir: (id: UUID, req: ActionSpecialeRequete) =>
    requete<unknown>(`/api/parties/${id}/actions`, { method: "POST", body: JSON.stringify(req) }),
};

