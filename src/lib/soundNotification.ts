// Sound notification utility for order alerts

export class SoundNotification {
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Play a notification sound for new orders (specialist version - louder and longer)
   */
  async playNewOrderSound() {
    if (!this.audioContext) return;

    try {
      // Resume audio context if suspended (required by browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Play 5 loud beeps with increasing frequency for maximum attention
      const beepCount = 5;
      const duration = 0.4;
      const frequencies = [659.25, 783.99, 880, 1046.5, 1174.66]; // E5, G5, A5, C6, D6
      
      for (let i = 0; i < beepCount; i++) {
        setTimeout(() => {
          const oscillator = this.audioContext!.createOscillator();
          const gainNode = this.audioContext!.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(this.audioContext!.destination);

          // Use square wave for more piercing sound
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(frequencies[i], this.audioContext!.currentTime);

          // Higher volume for better attention
          gainNode.gain.setValueAtTime(0.5, this.audioContext!.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + duration);

          oscillator.start(this.audioContext!.currentTime);
          oscillator.stop(this.audioContext!.currentTime + duration);
        }, i * 500); // 500ms between each beep
      }

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
