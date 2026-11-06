/**
 * Moteur sonore 8-bit rétro basé sur l'API Web Audio native du navigateur.
 * Zéro dépendance externe, léger, sans latence et sans fichier audio manquant.
 */

class MoteurAudioRetro {
  private ctx: AudioContext | null = null;
  private muet: boolean = false;

  constructor() {
    // Récupérer le statut du son depuis localStorage
    const sauvegarde = localStorage.getItem("lanterne:audio_muet");
    if (sauvegarde !== null) {
      this.muet = sauvegarde === "true";
    }
  }

  private obtenirContexte(): AudioContext | null {
    if (this.muet) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public estMuet(): boolean {
    return this.muet;
  }

  public basculerMuet(): boolean {
    this.muet = !this.muet;
    localStorage.setItem("lanterne:audio_muet", String(this.muet));
    return this.muet;
  }

  /** Bruitage de cloche / carillon de l'Aube */
  public clocheAube(): void {
    const ctx = this.obtenirContexte();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, t); // Ré 5
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.1); // La 5
    osc.frequency.exponentialRampToValueAtTime(440, t + 1.2);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.2);
  }

  /** Gong sourd pour la tombée de la Nuit */
  public gongNuit(): void {
    const ctx = this.obtenirContexte();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, t); // La 2
    osc.frequency.exponentialRampToValueAtTime(55, t + 1.5);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.5);
  }

  /** Clac sec lors d'un vote ou choix de cible */
  public vote(): void {
    const ctx = this.obtenirContexte();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /** Son de coup de feu ou de pouvoir spécial */
  public pouvoir(): void {
    const ctx = this.obtenirContexte();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.15);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Fanfare triomphante de Victoire */
  public victoire(): void {
    const ctx = this.obtenirContexte();
    if (!ctx) return;
    const t = ctx.currentTime;

    const notes = [392, 523.25, 659.25, 783.99]; // Sol, Do, Mi, Sol
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;

      const depart = t + idx * 0.15;
      gain.gain.setValueAtTime(0.2, depart);
      gain.gain.exponentialRampToValueAtTime(0.001, depart + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(depart);
      osc.stop(depart + 0.4);
    });
  }

  /** Tonalité sombre de Défaite */
  public defaite(): void {
    const ctx = this.obtenirContexte();
    if (!ctx) return;
    const t = ctx.currentTime;

    const notes = [440, 415.3, 392, 349.23];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;

      const depart = t + idx * 0.25;
      gain.gain.setValueAtTime(0.2, depart);
      gain.gain.exponentialRampToValueAtTime(0.001, depart + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(depart);
      osc.stop(depart + 0.4);
    });
  }

  /** Jingle étincelant lors du déblocage d'un Trophée */
  public succesDebloque(): void {
    const ctx = this.obtenirContexte();
    if (!ctx) return;
    const t = ctx.currentTime;

    const arpege = [523.25, 659.25, 783.99, 1046.5]; // Do, Mi, Sol, Do aigu
    arpege.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.3, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.35);
    });
  }
}

export const audio = new MoteurAudioRetro();
