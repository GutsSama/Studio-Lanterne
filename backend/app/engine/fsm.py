"""Machine à États Finis (FSM) orchestrant le cycle d'une partie Créatures de la Nuit."""

from uuid import UUID

from app.engine.rules import (
    ErreurRegleJeu,
    calculer_cible_majoritaire,
    distribuer_roles,
    eliminer_joueur,
    verifier_conditions_victoire,
)
from app.models.enums import (
    CanalMessage,
    PhasePartie,
    RolePersonnage,
    StatutPartie,
    TypeActionJeu,
)
from app.models.game import (
    EtatPartie,
    JoueurPartie,
    MessagePartie,
    PersonnaliteIA,
    utc_now,
)


class MoteurPartieFSM:
    """Pilote déterministe du cycle de jeu :
    NUIT (Inquisiteur -> Créatures -> Alchimiste) -> AUBE -> DEBAT_JOUR -> VOTE_JOUR -> CHECK VICTOIRE.
    """

    def __init__(self, partie: EtatPartie) -> None:
        self.partie = partie

    @classmethod
    def creer_partie_solo_vs_ia(
        cls,
        hote_id: UUID,
        nom_humain: str,
        personnalites_ia: list[PersonnaliteIA],
        role_humain_force: RolePersonnage | None = None,
        graine_aleatoire: int | None = None,
    ) -> "MoteurPartieFSM":
        """Initialise une nouvelle partie à 6 joueurs (1 Humain + 5 Agents IA)."""
        if len(personnalites_ia) < 5:
            raise ErreurRegleJeu("Il faut exactement 5 personnalités IA pour lancer une partie.")

        partie = EtatPartie(
            hote_id=hote_id,
            statut=StatutPartie.EN_COURS,
            phase_actuelle=PhasePartie.NUIT,
            tour_actuel=1,
        )

        roles = distribuer_roles(6, graine_aleatoire=graine_aleatoire)
        if role_humain_force is not None and role_humain_force in roles:
            idx = roles.index(role_humain_force)
            roles[0], roles[idx] = roles[idx], roles[0]

        # Siège 1 : Joueur Humain
        joueur_humain = JoueurPartie(
            partie_id=partie.id,
            est_humain=True,
            joueur_id=hote_id,
            nom_affiche=nom_humain,
            avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={nom_humain}",
            role=roles[0],
            numero_siege=1,
        )
        partie.joueurs.append(joueur_humain)

        # Sièges 2 à 6 : Les 5 Agents IA
        for idx, persona in enumerate(personnalites_ia[:5], start=2):
            agent = JoueurPartie(
                partie_id=partie.id,
                est_humain=False,
                personnalite_ia_id=persona.id,
                nom_affiche=persona.nom,
                avatar_url=persona.avatar_url,
                role=roles[idx - 1],
                numero_siege=idx,
                personnalite=persona,
            )
            partie.joueurs.append(agent)

        moteur = cls(partie)
        moteur.ajouter_message_systeme(
            f"La nuit 1 tombe sur le village. Les 6 participants prennent place."
        )
        return moteur

    def ajouter_message_systeme(self, contenu: str) -> MessagePartie:
        msg = MessagePartie(
            partie_id=self.partie.id,
            joueur_emetteur_id=None,
            nom_emetteur="Meneur de Jeu",
            canal=CanalMessage.SYSTEME,
            tour=self.partie.tour_actuel,
            phase=self.partie.phase_actuelle,
            contenu=contenu,
            est_ia=False,
            tokens_utilises=0,
        )
        self.partie.messages.append(msg)
        try:
            from app.services.supabase_service import depot_parties
            depot_parties.enregistrer_message_supabase(msg)
        except Exception:
            pass
        return msg

    def clore_votes_creatures_vers_alchimiste(
        self, graine_aleatoire: int | None = None
    ) -> JoueurPartie | None:
        """Calcule la victime provisoire des Créatures et passe au tour de l'Alchimiste."""
        if self.partie.phase_actuelle != PhasePartie.NUIT:
            raise ErreurRegleJeu("Cette transition n'est valide que pendant la phase de Nuit.")

        victime = calculer_cible_majoritaire(
            self.partie,
            PhasePartie.NUIT,
            departager_aleatoirement_nuit=True,
            graine_aleatoire=graine_aleatoire,
        )
        self.partie.victime_provisoire_nuit_id = victime.id if victime else None

        # Si l'Alchimiste est vivant et a au moins une potion, on passe par TOUR_ALCHIMISTE
        alchimiste = next(
            (
                j
                for j in self.partie.joueurs_vivants()
                if j.role == RolePersonnage.ALCHIMISTE
            ),
            None,
        )
        if alchimiste and (
            alchimiste.memoire_ia.potion_vie_disponible
            or alchimiste.memoire_ia.potion_mort_disponible
        ):
            self.partie.phase_actuelle = PhasePartie.TOUR_ALCHIMISTE
        return victime

    def resoudre_aube(self) -> list[JoueurPartie]:
        """Résout toutes les éliminations nocturnes à l'aube et bascule vers DEBAT_JOUR (ou fin de partie)."""
        if self.partie.phase_actuelle not in (
            PhasePartie.NUIT,
            PhasePartie.TOUR_ALCHIMISTE,
        ):
            raise ErreurRegleJeu("L'aube ne peut être résolue qu'à la fin de la nuit.")

        morts_nuit: list[JoueurPartie] = []

        # 1. Victime des Créatures (si non sauvée par l'Alchimiste)
        if self.partie.victime_provisoire_nuit_id is not None:
            victime = self.partie.obtenir_joueur(self.partie.victime_provisoire_nuit_id)
            self.partie.victime_provisoire_nuit_id = None
            if victime and victime.est_vivant:
                eliminer_joueur(self.partie, victime, cause_mort="attaque_creatures")
                morts_nuit.append(victime)

        # 2. Victime éventuelle de la potion de Mort de l'Alchimiste ce tour-ci
        for action in self.partie.actions:
            if (
                action.tour == self.partie.tour_actuel
                and action.type_action == TypeActionJeu.ALCHIMISTE_EMPOISONNER
                and action.joueur_cible_id is not None
            ):
                cible_poison = self.partie.obtenir_joueur(action.joueur_cible_id)
                if cible_poison and cible_poison.est_vivant:
                    eliminer_joueur(
                        self.partie, cible_poison, cause_mort="potion_mort_alchimiste"
                    )
                    morts_nuit.append(cible_poison)

        # Annonce publique de l'Aube
        if not morts_nuit:
            self.ajouter_message_systeme(
                f"Aube du tour {self.partie.tour_actuel} : Personne n'a péri cette nuit !"
            )
        else:
            noms = ", ".join(
                f"{j.nom_affiche} ({j.role.value})" for j in morts_nuit
            )
            self.ajouter_message_systeme(
                f"Aube du tour {self.partie.tour_actuel} : {noms} a été retrouvé sans vie."
            )

        # Si le Garde du Corps vient de mourir, on attend son tir avant de vérifier la victoire
        if self.partie.garde_du_corps_en_attente_id is not None:
            self.partie.phase_actuelle = PhasePartie.TOUR_GARDE_DU_CORPS
            return morts_nuit

        if not self._verifier_et_cloturer_si_victoire():
            self.partie.phase_actuelle = PhasePartie.DEBAT_JOUR

        return morts_nuit

    def passer_au_vote_du_jour(self) -> None:
        """Passe du débat diurne à la phase de vote public."""
        if self.partie.phase_actuelle != PhasePartie.DEBAT_JOUR:
            raise ErreurRegleJeu("Le vote du jour doit suivre la phase de débat.")
        self.partie.phase_actuelle = PhasePartie.VOTE_JOUR
        self.ajouter_message_systeme(
            f"Tour {self.partie.tour_actuel} : Le débat est clos, place au vote du Conseil !"
        )

    def resoudre_vote_du_jour(self) -> JoueurPartie | None:
        """Dépouille les votes du Conseil, élimine le joueur majoritaire et passe à la nuit suivante."""
        if self.partie.phase_actuelle != PhasePartie.VOTE_JOUR:
            raise ErreurRegleJeu("Impossible de dépouiller les votes hors de la phase vote_jour.")

        elimine = calculer_cible_majoritaire(
            self.partie, PhasePartie.VOTE_JOUR, departager_aleatoirement_nuit=False
        )

        if elimine is None:
            self.ajouter_message_systeme(
                "Égalité des voix au Conseil : aucun joueur n'est éliminé aujourd'hui."
            )
        else:
            eliminer_joueur(self.partie, elimine, cause_mort="vote_conseil")
            self.ajouter_message_systeme(
                f"Le Conseil a tranché : {elimine.nom_affiche} ({elimine.role.value}) est éliminé !"
            )

        # Si le joueur éliminé au Conseil est le Garde du Corps, il tire avant la fin du tour
        if self.partie.garde_du_corps_en_attente_id is not None:
            self.partie.phase_actuelle = PhasePartie.TOUR_GARDE_DU_CORPS
            return elimine

        if not self._verifier_et_cloturer_si_victoire():
            self.partie.tour_actuel += 1
            self.partie.phase_actuelle = PhasePartie.NUIT
            self.ajouter_message_systeme(
                f"La nuit {self.partie.tour_actuel} tombe sur la cité."
            )

        return elimine

    def reprendre_apres_tir_garde_du_corps(self, origine_nuit: bool) -> None:
        """Reprend le cours normal de la partie après le tir final du Garde du Corps."""
        if self._verifier_et_cloturer_si_victoire():
            return
        if origine_nuit:
            self.partie.phase_actuelle = PhasePartie.DEBAT_JOUR
        else:
            self.partie.tour_actuel += 1
            self.partie.phase_actuelle = PhasePartie.NUIT
            self.ajouter_message_systeme(
                f"La nuit {self.partie.tour_actuel} tombe sur la cité."
            )

    def _verifier_et_cloturer_si_victoire(self) -> bool:
        vainqueur = verifier_conditions_victoire(self.partie)
        if vainqueur is not None:
            self.partie.camp_vainqueur = vainqueur
            self.partie.statut = StatutPartie.TERMINEE
            self.partie.phase_actuelle = PhasePartie.TERMINEE
            self.partie.terminee_le = utc_now()
            self.ajouter_message_systeme(
                f"Fin de la partie ! Victoire du camp : {vainqueur.value}."
            )
            return True
        return False

