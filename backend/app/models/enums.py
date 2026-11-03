"""Types énumérés strictement alignés sur le schéma PostgreSQL Supabase."""

from enum import StrEnum


class StatutPartie(StrEnum):
    EN_ATTENTE = "en_attente"
    EN_COURS = "en_cours"
    TERMINEE = "terminee"
    ABANDONNEE = "abandonnee"


class PhasePartie(StrEnum):
    NUIT = "nuit"
    DEBAT_JOUR = "debat_jour"
    VOTE_JOUR = "vote_jour"
    TOUR_GARDE_DU_CORPS = "tour_garde_du_corps"
    TOUR_ALCHIMISTE = "tour_alchimiste"
    TERMINEE = "terminee"


class RolePersonnage(StrEnum):
    CITOYEN = "citoyen"
    CREATURE = "creature"
    INQUISITEUR = "inquisiteur"
    ALCHIMISTE = "alchimiste"
    GARDE_DU_CORPS = "garde_du_corps"


class CampPartie(StrEnum):
    CITOYENS = "citoyens"
    CREATURES = "creatures"
    SOLO = "solo"
    EGALITE = "egalite"


class CanalMessage(StrEnum):
    VILLAGE_PUBLIC = "village_public"
    CREATURE_SECRET = "creature_secret"
    CHAT_MORTS = "chat_morts"
    SYSTEME = "systeme"


class TypeActionJeu(StrEnum):
    INQUISITEUR_INSPECTER = "inquisiteur_inspecter"
    ALCHIMISTE_SOIGNER = "alchimiste_soigner"
    ALCHIMISTE_EMPOISONNER = "alchimiste_empoisonner"
    GARDE_DU_CORPS_TIRER = "garde_du_corps_tirer"


class ArchetypeIA(StrEnum):
    MAUVAIS_JOUEUR = "mauvais_joueur"
    STRATEGE = "stratege"
    DROLE = "drole"
    MYSTIQUE = "mystique"
    PARANOIAQUE = "paranoiaque"

