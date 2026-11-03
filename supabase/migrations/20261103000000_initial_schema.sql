-- =============================================================================
-- MIGRATION INITIALE : STUDIO LANTERNE - CRÉATURES DE LA NUIT VS IA (FRANÇAIS)
-- =============================================================================

-- 0. EXTENSIONS & TYPES ÉNUMÉRÉS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE statut_partie AS ENUM ('en_attente', 'en_cours', 'terminee', 'abandonnee');
CREATE TYPE phase_partie AS ENUM ('nuit', 'debat_jour', 'vote_jour', 'tour_garde_du_corps', 'tour_alchimiste', 'terminee');
CREATE TYPE role_personnage AS ENUM ('citoyen', 'creature', 'inquisiteur', 'alchimiste', 'garde_du_corps');
CREATE TYPE camp_partie AS ENUM ('citoyens', 'creatures', 'solo', 'egalite');
CREATE TYPE canal_message AS ENUM ('village_public', 'creature_secret', 'chat_morts', 'systeme');
CREATE TYPE type_action_jeu AS ENUM ('inquisiteur_inspecter', 'alchimiste_soigner', 'alchimiste_empoisonner', 'garde_du_corps_tirer');

-- =============================================================================
-- 1. PROFILS & AUTHENTIFICATION (RGPD & AI ACT)
-- =============================================================================
CREATE TABLE public.profils (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nom_utilisateur TEXT UNIQUE NOT NULL,
    avatar_url TEXT DEFAULT 'https://api.dicebear.com/7.x/bottts/svg?seed=citoyen',
    -- Conformité AI Act : Le joueur confirme expressément savoir qu'il affronte des agents IA
    consentement_ai_act BOOLEAN NOT NULL DEFAULT FALSE,
    date_consentement_ai_act TIMESTAMPTZ,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    mis_a_jour_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 2. STATISTIQUES & SUCCÈS
-- =============================================================================
CREATE TABLE public.statistiques_joueurs (
    joueur_id UUID PRIMARY KEY REFERENCES public.profils(id) ON DELETE CASCADE,
    parties_jouees INT NOT NULL DEFAULT 0,
    parties_gagnees INT NOT NULL DEFAULT 0,
    parties_perdues INT NOT NULL DEFAULT 0,
    victoires_citoyens INT NOT NULL DEFAULT 0,
    victoires_creatures INT NOT NULL DEFAULT 0,
    victoires_solo INT NOT NULL DEFAULT 0,
    temps_de_jeu_total_secondes BIGINT NOT NULL DEFAULT 0,
    mis_a_jour_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.succes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    titre TEXT NOT NULL,
    description TEXT NOT NULL,
    icone_badge TEXT NOT NULL,
    points INT NOT NULL DEFAULT 10,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.succes_joueurs (
    joueur_id UUID NOT NULL REFERENCES public.profils(id) ON DELETE CASCADE,
    succes_id UUID NOT NULL REFERENCES public.succes(id) ON DELETE CASCADE,
    debloque_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (joueur_id, succes_id)
);

-- =============================================================================
-- 3. PERSONNALITÉS IA (Catalogue d'agents)
-- =============================================================================
CREATE TABLE public.personnalites_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    archetype TEXT NOT NULL, -- 'mauvais_joueur', 'stratege', 'drole', 'paranoiaque', 'mystique'
    avatar_url TEXT NOT NULL,
    prompt_systeme TEXT NOT NULL,
    modele_par_defaut TEXT NOT NULL DEFAULT 'mistral/mistral-small-latest',
    temperature NUMERIC(3, 2) NOT NULL DEFAULT 0.70,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 4. PARTIES (État du jeu, règles & suivi des coûts en tokens)
-- =============================================================================
CREATE TABLE public.parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hote_id UUID NOT NULL REFERENCES public.profils(id) ON DELETE CASCADE,
    statut statut_partie NOT NULL DEFAULT 'en_attente',
    phase_actuelle phase_partie NOT NULL DEFAULT 'nuit',
    tour_actuel INT NOT NULL DEFAULT 1,
    camp_vainqueur camp_partie,
    tokens_total_utilises INT NOT NULL DEFAULT 0,
    cout_estime_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
    date_limite_phase TIMESTAMPTZ,
    creee_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    terminee_le TIMESTAMPTZ
);

-- =============================================================================
-- 5. JOUEURS DE LA PARTIE (Humain et Agents IA)
-- =============================================================================
CREATE TABLE public.joueurs_partie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partie_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    est_humain BOOLEAN NOT NULL DEFAULT FALSE,
    joueur_id UUID REFERENCES public.profils(id) ON DELETE SET NULL,
    personnalite_ia_id UUID REFERENCES public.personnalites_ia(id) ON DELETE SET NULL,
    nom_affiche TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    role role_personnage NOT NULL,
    est_vivant BOOLEAN NOT NULL DEFAULT TRUE,
    est_capitaine BOOLEAN NOT NULL DEFAULT FALSE,
    tour_mort INT,
    cause_mort TEXT,
    numero_siege INT NOT NULL,
    memoire_ia JSONB DEFAULT '{}'::jsonb,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT siege_unique_par_partie UNIQUE (partie_id, numero_siege),
    CONSTRAINT verif_identite_joueur CHECK (
        (est_humain = TRUE AND joueur_id IS NOT NULL AND personnalite_ia_id IS NULL) OR
        (est_humain = FALSE AND personnalite_ia_id IS NOT NULL)
    )
);

-- =============================================================================
-- 6. MESSAGES DE LA PARTIE (Chat public, secret créatures, morts, système)
-- =============================================================================
CREATE TABLE public.messages_partie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partie_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    joueur_emetteur_id UUID REFERENCES public.joueurs_partie(id) ON DELETE SET NULL,
    canal canal_message NOT NULL DEFAULT 'village_public',
    tour INT NOT NULL,
    phase phase_partie NOT NULL,
    contenu TEXT NOT NULL,
    est_ia BOOLEAN NOT NULL DEFAULT TRUE,
    tokens_utilises INT DEFAULT 0,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 7. VOTES & ACTIONS STRATÉGIQUES
-- =============================================================================
CREATE TABLE public.votes_partie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partie_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    tour INT NOT NULL,
    phase phase_partie NOT NULL,
    joueur_votant_id UUID NOT NULL REFERENCES public.joueurs_partie(id) ON DELETE CASCADE,
    joueur_cible_id UUID NOT NULL REFERENCES public.joueurs_partie(id) ON DELETE CASCADE,
    argumentation TEXT,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT vote_unique_par_tour UNIQUE (partie_id, tour, phase, joueur_votant_id)
);

CREATE TABLE public.actions_partie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partie_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    tour INT NOT NULL,
    joueur_acteur_id UUID NOT NULL REFERENCES public.joueurs_partie(id) ON DELETE CASCADE,
    type_action type_action_jeu NOT NULL,
    joueur_cible_id UUID REFERENCES public.joueurs_partie(id) ON DELETE SET NULL,
    details_resultat JSONB DEFAULT '{}'::jsonb,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 8. INDEX DE PERFORMANCE
-- =============================================================================
CREATE INDEX idx_parties_hote_id ON public.parties(hote_id);
CREATE INDEX idx_joueurs_partie_partie_id ON public.joueurs_partie(partie_id);
CREATE INDEX idx_messages_partie_partie_id ON public.messages_partie(partie_id);
CREATE INDEX idx_messages_partie_canal ON public.messages_partie(partie_id, canal);
CREATE INDEX idx_votes_partie_tour ON public.votes_partie(partie_id, tour, phase);
CREATE INDEX idx_actions_partie_tour ON public.actions_partie(partie_id, tour);

-- =============================================================================
-- 9. TRIGGERS AUTOMATIQUES
-- =============================================================================

-- A. Création automatique de profil et stats lors de l'inscription via Supabase Auth
CREATE OR REPLACE FUNCTION public.gerer_nouvel_utilisateur()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profils (id, nom_utilisateur, avatar_url, consentement_ai_act, date_consentement_ai_act)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Citoyen_' || substr(NEW.id::text, 1, 6)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || NEW.id),
    COALESCE((NEW.raw_user_meta_data->>'ai_act_consent')::boolean, FALSE),
    CASE WHEN (NEW.raw_user_meta_data->>'ai_act_consent')::boolean THEN now() ELSE NULL END
  );

  INSERT INTO public.statistiques_joueurs (joueur_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER sur_creation_utilisateur
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.gerer_nouvel_utilisateur();

-- B. Calcul automatique des tokens et coûts sur la table parties
CREATE OR REPLACE FUNCTION public.mettre_a_jour_cout_tokens()
RETURNS trigger AS $$
BEGIN
  IF NEW.tokens_utilises > 0 THEN
    UPDATE public.parties
    SET 
      tokens_total_utilises = tokens_total_utilises + NEW.tokens_utilises,
      cout_estime_usd = cout_estime_usd + (NEW.tokens_utilises * 0.000001)
    WHERE id = NEW.partie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER sur_ajout_message_token
  AFTER INSERT ON public.messages_partie
  FOR EACH ROW EXECUTE FUNCTION public.mettre_a_jour_cout_tokens();

-- =============================================================================
-- 10. ROW LEVEL SECURITY (RLS) ANTI-TRICHE
-- =============================================================================
ALTER TABLE public.profils ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistiques_joueurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.succes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.succes_joueurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnalites_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.joueurs_partie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_partie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes_partie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions_partie ENABLE ROW LEVEL SECURITY;

-- Profils & Stats
CREATE POLICY "Profils visibles par tous" ON public.profils FOR SELECT USING (true);
CREATE POLICY "Mise a jour de son propre profil" ON public.profils FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Stats visibles par tous" ON public.statistiques_joueurs FOR SELECT USING (true);
CREATE POLICY "Succes visibles par tous" ON public.succes FOR SELECT USING (true);
CREATE POLICY "Succes joueurs visibles par tous" ON public.succes_joueurs FOR SELECT USING (true);
CREATE POLICY "Personnalites IA visibles par tous" ON public.personnalites_ia FOR SELECT USING (true);

-- Parties
CREATE POLICY "Voir ses propres parties" ON public.parties FOR SELECT USING (auth.uid() = hote_id);
CREATE POLICY "Creer sa propre partie" ON public.parties FOR INSERT WITH CHECK (auth.uid() = hote_id);
CREATE POLICY "Modifier sa propre partie" ON public.parties FOR UPDATE USING (auth.uid() = hote_id);

-- Joueurs de la partie
CREATE POLICY "Voir les joueurs de sa partie" ON public.joueurs_partie FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.parties p WHERE p.id = partie_id AND p.hote_id = auth.uid())
);

-- Messages & Anti-triche
CREATE POLICY "Lire les messages autorises" ON public.messages_partie FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parties p
        JOIN public.joueurs_partie jp ON jp.partie_id = p.id AND jp.joueur_id = auth.uid()
        WHERE p.id = messages_partie.partie_id
        AND (
            canal = 'village_public'
            OR canal = 'systeme'
            OR (canal = 'creature_secret' AND jp.role = 'creature')
            OR (canal = 'chat_morts' AND jp.est_vivant = FALSE)
        )
    )
);

CREATE POLICY "Envoyer message dans sa partie" ON public.messages_partie FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.parties p WHERE p.id = partie_id AND p.hote_id = auth.uid())
);

-- Votes & Actions
CREATE POLICY "Voir votes de sa partie" ON public.votes_partie FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.parties p WHERE p.id = partie_id AND p.hote_id = auth.uid())
);
CREATE POLICY "Voter dans sa partie" ON public.votes_partie FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.parties p WHERE p.id = partie_id AND p.hote_id = auth.uid())
);

CREATE POLICY "Voir actions de sa partie" ON public.actions_partie FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.parties p WHERE p.id = partie_id AND p.hote_id = auth.uid())
);
