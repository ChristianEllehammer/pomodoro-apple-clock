export class AudioNotifications {
  private audioContext: AudioContext | null = null;

  constructor() {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    } catch {
      console.log('Web Audio API not supported');
    }
  }

  private async createTone(frequency: number, duration: number, type: OscillatorType = 'sine'): Promise<void> {
    if (!this.audioContext) return;

    // Resume audio context if suspended (required by some browsers)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;

    // Create envelope for smoother sound
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  private async createChord(frequencies: number[], duration: number): Promise<void> {
    const promises = frequencies.map(freq => this.createTone(freq, duration, 'sine'));
    await Promise.all(promises);
  }

  async playFocusEndSound(): Promise<void> {
    try {
      // Pleasant ascending chord (C major)
      await this.createChord([523.25, 659.25, 783.99], 0.8); // C5, E5, G5
      
      // Small pause
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Higher note for "completion"
      await this.createTone(1046.50, 0.6, 'sine'); // C6
    } catch (error) {
      console.log('Focus end sound failed:', error);
    }
  }

  async playRestEndSound(): Promise<void> {
    try {
      // Gentle descending sequence
      await this.createTone(880.00, 0.4, 'sine'); // A5
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.createTone(783.99, 0.4, 'sine'); // G5
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.createTone(659.25, 0.6, 'sine'); // E5
    } catch (error) {
      console.log('Rest end sound failed:', error);
    }
  }

  async playStopSound(): Promise<void> {
    try {
      // Simple confirmation tone
      await this.createTone(440.00, 0.3, 'sine'); // A4
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.createTone(349.23, 0.5, 'sine'); // F4
    } catch (error) {
      console.log('Stop sound failed:', error);
    }
  }
}