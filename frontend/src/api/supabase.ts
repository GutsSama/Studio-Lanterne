import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://ystwejtoqjbeqwspjgog.supabase.co";

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzdHdlanRvcWpiZXF3c3BqZ29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTMyNzEsImV4cCI6MjEwOTI2OTI3MX0.qZ-AeQjpdgKeaU1H1-OCx8DKtgqTFsjBTRqbHI_szIs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface ProfilUtilisateur {
  id: string;
  nom_utilisateur: string;
  avatar_url: string;
  consentement_ai_act: boolean;
}

export interface StatistiquesJoueur {
  joueur_id: string;
  parties_jouees: number;
  parties_gagnees: number;
  parties_perdues: number;
  victoires_citoyens: number;
  victoires_creatures: number;
  temps_de_jeu_total_secondes: number;
}

export interface SuccesInfo {
  id: string;
  code: string;
  titre: string;
  description: string;
  icone_badge: string;
  points: number;
  debloque?: boolean;
  debloque_le?: string;
}

