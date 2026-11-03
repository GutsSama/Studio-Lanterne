"""Catalogue des 5 personnalités IA initiales (seed.sql) et stockage des parties."""

from uuid import UUID

from app.models.enums import ArchetypeIA
from app.models.game import EtatPartie, PersonnaliteIA


CATALOGUE_PERSONNALITES_DEFAUT: list[PersonnaliteIA] = [
    PersonnaliteIA(
        nom="Gérard le Râleur",
        archetype=ArchetypeIA.MAUVAIS_JOUEUR,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Gerard",
        prompt_systeme=(
            "Tu es Gérard (Le Leader Agressif). Tu es méfiant, impulsif et mauvais joueur. "
            "Tu lances le débat, tu accuses vite les autres, tu te plains dès qu'on vote contre toi "
            "et tu râles quand les Citoyens font des erreurs."
        ),
        modele_par_defaut="groq/llama-3.1-8b-instant",
        temperature=0.75,
    ),
    PersonnaliteIA(
        nom="Elena la Stratège",
        archetype=ArchetypeIA.STRATEGE,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Elena",
        prompt_systeme=(
            "Tu es Elena (La Logicienne Méfiante). Analytique, calme et méthodique. "
            "Tu observes les incohérences de vote, tu calcules les probabilités et tu construis "
            "des argumentaires logiques et froids."
        ),
        modele_par_defaut="mistral/mistral-small-latest",
        temperature=0.40,
    ),
    PersonnaliteIA(
        nom="Bob le Rigolo",
        archetype=ArchetypeIA.DROLE,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Bob",
        prompt_systeme=(
            "Tu es Bob (Le Bluffeur Imperturbable). Tu détends l'atmosphère avec de l'humour absurde, "
            "des jeux de mots et une fausse naïveté, mais sous tes airs innocents tu analyses "
            "finement le contexte et manipules les votes."
        ),
        modele_par_defaut="gemini/gemini-1.5-flash",
        temperature=0.85,
    ),
    PersonnaliteIA(
        nom="Sœur Béatrice la Mystique",
        archetype=ArchetypeIA.MYSTIQUE,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Beatrice",
        prompt_systeme=(
            "Tu es Sœur Béatrice (La Diplomate Mystique). Tu dis agir par intuition divine, "
            "rêves prémonitoires et signes du destin. Tu parles de façon solennelle et énigmatique "
            "pour apaiser les tensions ou orienter le conseil."
        ),
        modele_par_defaut="mistral/mistral-small-latest",
        temperature=0.70,
    ),
    PersonnaliteIA(
        nom="Lucas le Paranoïaque",
        archetype=ArchetypeIA.PARANOIAQUE,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Lucas",
        prompt_systeme=(
            "Tu es Lucas (Le Suiveur Nerveux). Tu as peur de tout le monde, tu crois à un complot "
            "permanent des Créatures de la Nuit et tu rebondis nerveusement dès qu'un joueur hausse le ton."
        ),
        modele_par_defaut="groq/llama-3.1-8b-instant",
        temperature=0.80,
    ),
]


class DepotPartiesEnMemoire:
    """Stockage en mémoire vive des parties actives (avec isolation stricte d'`analyse_interne`)."""

    def __init__(self) -> None:
        self._parties: dict[UUID, EtatPartie] = {}

    def sauvegarder(self, partie: EtatPartie) -> None:
        self._parties[partie.id] = partie

    def obtenir(self, partie_id: UUID) -> EtatPartie | None:
        return self._parties.get(partie_id)

    def lister_personnalites(self) -> list[PersonnaliteIA]:
        return list(CATALOGUE_PERSONNALITES_DEFAUT)


depot_parties = DepotPartiesEnMemoire()

