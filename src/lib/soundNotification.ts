// Sound notification utility for order alerts

export class SoundNotification {
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Play a notification sound for new orders
   */
  async playNewOrderSound() {
    if (!this.audioContext) return;

    try {
      // Resume audio context if suspended (required by browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const duration = 0.3;
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // New order sound: Pleasant rising tone
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
      oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + duration); // A5

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);

      // Play second tone
      setTimeout(() => {
        const osc2 = this.audioContext!.createOscillator();
        const gain2 = this.audioContext!.createGain();

        osc2.connect(gain2);
        gain2.connect(this.audioContext!.destination);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, this.audioContext!.currentTime);
        
        gain2.gain.setValueAtTime(0.3, this.audioContext!.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + duration);

        osc2.start(this.audioContext!.currentTime);
        osc2.stop(this.audioContext!.currentTime + duration);
      }, 150);

    } catch (error) {
      console.error('Error playing new order sound:', error);
    }
  }

  /**
   * Play a notification sound for new quote/response
   */
  async playNewQuoteSound() {
    if (!this.audioContext) return;

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const duration = 0.2;
      
      // Triple beep pattern for quote notification
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          const oscillator = this.audioContext!.createOscillator();
          const gainNode = this.audioContext!.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(this.audioContext!.destination);

          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(freq, this.audioContext!.currentTime);

          gainNode.gain.setValueAtTime(0.25, this.audioContext!.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + duration);

          oscillator.start(this.audioContext!.currentTime);
          oscillator.stop(this.audioContext!.currentTime + duration);
        }, index * 100);
      });

    } catch (error) {
      console.error('Error playing new quote sound:', error);
    }
  }

  /**
   * Initialize audio context on user interaction (required by browsers)
   */
  async initialize() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

// Singleton instance
let soundNotificationInstance: SoundNotification | null = null;

export const getSoundNotification = (): SoundNotification => {
  if (!soundNotificationInstance) {
    soundNotificationInstance = new SoundNotification();
  }
  return soundNotificationInstance;
};
