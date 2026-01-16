
class SoundService {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  setMuted(isMuted: boolean) {
    this.muted = isMuted;
  }

  playEat() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx!.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  playGameOver() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx!.currentTime);
    osc.frequency.linearRampToValueAtTime(55, this.ctx!.currentTime + 0.5);

    gain.gain.setValueAtTime(0.1, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx!.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.5);
  }

  playPause(isPausing: boolean) {
    if (this.muted) return;
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sine';
    const freq = isPausing ? 330 : 440;
    osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
    
    gain.gain.setValueAtTime(0.05, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.05);
  }
}

export const sounds = new SoundService();
