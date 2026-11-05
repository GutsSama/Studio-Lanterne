# CONTEXTE DU PROJET : CRÉATURES DE LA NUIT VS IA
Tu es un développeur Frontend Expert (React/TypeScript). Nous développons un jeu de déduction sociale textuel. Le backend (FastAPI) et la base de données (Supabase) sont **déjà développés et fonctionnels**.
Le dossier `frontend` n'existe pas encore et doit être créé de zéro. 
La direction artistique est un mélange de "Game of Thrones" et "Disney" (Dark Fantasy, expressif, immersif). Les interfaces ne doivent pas ressembler à un jeu de cartes, mais donner l'impression que les joueurs sont assis à une table de taverne.

# STACK TECHNIQUE REQUISE
- Framework : React + TypeScript via Vite.
- Styling : Tailwind CSS.
- Animations : Framer Motion (crucial pour les cinématiques).
- Données : @supabase/supabase-js (pour écouter les changements de base de données en temps réel).

# MISSION 1 : INITIALISATION ET SYNCHRONISATION
1. Crée le dossier `frontend` à la racine via Vite : `npm create vite@latest frontend -- --template react-ts`.
2. Installe les dépendances : `tailwindcss`, `framer-motion`, `@supabase/supabase-js`, `lucide-react`.
3. Lis attentivement le script SQL fourni à la fin de ce prompt. Tu dois impérativement générer un fichier `/src/types/database.types.ts` qui reproduit exactement les types énumérés de la base de données (StatutPartie, PhasePartie, RolePersonnage, CampPartie, CanalMessage, TypeActionJeu) et les interfaces des tables pour s'aligner parfaitement sur le backend existant.

# MISSION 2 : ARCHITECTURE DES COMPOSANTS ET ANIMATIONS
Génère la structure des composants pour répondre à ces exigences visuelles strictes :
1. **Les Interludes de Phase (`<PhaseTransition />`) :** Des écrans de transition cinématiques plein écran. Un lever de soleil volumétrique pour le passage à `debat_jour`, et un coucher de soleil sombre pour la phase `nuit`.
2. **Cinématique de Mort (`<BloodSplatter />`) :** Lorsqu'un joueur est éliminé (son statut

# RECADRAGE CRITIQUE : DIRECTION ARTISTIQUE ET COMPOSANTS (CRÉATURES DE LA NUIT VS IA)
Tu as déjà initialisé le dossier `frontend` avec Vite, React, TypeScript et installé les dépendances (Tailwind, Framer Motion, Supabase). Cependant, l'interface actuelle génère un tableau de bord plat avec des icônes de robots. Ce n'est pas ce qui est attendu. 
Tu dois réécrire l'interface utilisateur et les composants pour correspondre strictement aux directives ci-dessous.

# 1. DIRECTION ARTISTIQUE (RÉFÉRENCE : IMAGE JOINTE)
L'ambiance visuelle est "Dark Fantasy / Disney 3D" (immersive, type taverne). L'interface doit donner l'impression que les joueurs sont assis à une table dans une auberge sombre.
- **Le fond d'écran principal :** Supprime les couleurs unies. Utilise une image de taverne en plein écran avec un éclairage à la bougie simulé : `bg-[url('https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?q=80&w=1920')] bg-cover bg-center` combiné à un overlay `bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]`.
- **Les Avatars :** Bannis les icônes de robots. Les avatars doivent être ronds, avec une bordure épaisse (`border-4 border-amber-900`). Écrase temporairement les URL Dicebear venant de la base de données avec des portraits Unsplash humains (ex: `https://images.unsplash.com/photo-1535295972055-1c762f4483e5?w=256&q=80`).
- **Les Panneaux (Chat, UI) :** Style "Glassmorphism" sombre. Utilise `bg-black/60 backdrop-blur-md`, des bordures fines `border-amber-900/50`, et une typographie avec empattement pour les textes d'ambiance (`font-serif`, `text-amber-100`).

# 2. ARCHITECTURE DES COMPOSANTS ET CINÉMATIQUES (Framer Motion)
Génère ou mets à jour ces composants pour qu'ils réagissent aux événements de la BDD :
1. **`<GameTable />` :** Les joueurs sont disposés autour d'une table centrale transparente, pas dans une grille.
2. **`<PhaseTransition />` :** Écran de transition cinématique (Lever de soleil pour `debat_jour`, coucher de soleil sombre pour `nuit`) basé sur la table `parties`.
3. **`<BloodSplatter />` (Cinématique de Mort) :** Si `est_vivant` passe à `false` dans `joueurs_partie`, une éclaboussure de sang plein écran apparaît brièvement (z-index élevé). L'avatar du joueur mort est ensuite remplacé par un composant `<EmptyChair />` ou passe en niveaux de gris extrêmes.
4. **`<PotionPopup />` (Skills) :** Écoute la table `actions_partie`. Si une action `alchimiste_soigner` ou `alchimiste_empoisonner` est insérée, affiche une animation modale centrale d'une fiole magique.

# 3. MISE À JOUR DES TYPES ET DONNÉES
Assure-toi que ton fichier `/src/types/database.types.ts` intègre bien toutes ces tables pour ton hook `useGameRealtime`. Voici le schéma SQL de référence mis à jour :

```sql
-- 0. TYPES ÉNUMÉRÉS
CREATE TYPE statut_partie AS ENUM ('en_attente', 'en_cours', 'terminee', 'abandonnee');
CREATE TYPE phase_partie AS ENUM ('nuit', 'debat_jour', 'vote_jour', 'tour_garde_du_corps', 'tour_alchimiste', 'terminee');
CREATE TYPE role_personnage AS ENUM ('citoyen', 'creature', 'inquisiteur', 'alchimiste', 'garde_du_corps');
CREATE TYPE camp_partie AS ENUM ('citoyens', 'creatures', 'solo', 'egalite');
CREATE TYPE canal_message AS ENUM ('village_public', 'creature_secret', 'chat_morts', 'systeme');
CREATE TYPE type_action_jeu AS ENUM ('inquisiteur_inspecter', 'alchimiste_soigner', 'alchimiste_empoisonner', 'garde_du_corps_tirer');

-- 4. PARTIES
CREATE TABLE public.parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statut statut_partie NOT NULL DEFAULT 'en_attente',
    phase_actuelle phase_partie NOT NULL DEFAULT 'nuit',
    tour_actuel INT NOT NULL DEFAULT 1
);

-- 5. JOUEURS DE LA PARTIE
CREATE TABLE public.joueurs_partie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partie_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    nom_affiche TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    role role_personnage NOT NULL,
    est_vivant BOOLEAN NOT NULL DEFAULT TRUE,
    numero_siege INT NOT NULL
);

-- 6. MESSAGES DE LA PARTIE
CREATE TABLE public.messages_partie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partie_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    joueur_emetteur_id UUID REFERENCES public.joueurs_partie(id) ON DELETE SET NULL,
    canal canal_message NOT NULL DEFAULT 'village_public',
    contenu TEXT NOT NULL
);

-- 7. ACTIONS STRATÉGIQUES (SKILLS)
CREATE TABLE public.actions_partie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partie_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    tour INT NOT NULL,
    joueur_acteur_id UUID NOT NULL REFERENCES public.joueurs_partie(id) ON DELETE CASCADE,
    type_action type_action_jeu NOT NULL,
    joueur_cible_id UUID REFERENCES public.joueurs_partie(id) ON DELETE SET NULL,
    details_resultat JSONB DEFAULT '{}'::jsonb
);