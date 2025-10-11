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
   * This plays a long ringtone-like sound similar to phone calls
   */
  async playNewOrderSound() {
    if (!this.audioContext) return;

    try {
      // Resume audio context if suspended (required by browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Play continuous ringtone for 10 seconds (like a phone call)
      const ringCount = 10; // 10 rings over 10 seconds
      const duration = 0.5; // Each beep lasts 0.5 seconds
      const frequencies = [659.25, 783.99]; // E5, G5 - classic ringtone pattern
      
      for (let i = 0; i < ringCount; i++) {
        setTimeout(() => {
          // Play double beep for each ring
          frequencies.forEach((freq, index) => {
            setTimeout(() => {
              const oscillator = this.audioContext!.createOscillator();
              const gainNode = this.audioContext!.createGain();

              oscillator.connect(gainNode);
              gainNode.connect(this.audioContext!.destination);

              // Use sine wave for phone-like ringtone
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(freq, this.audioContext!.currentTime);

              // Medium volume for pleasant but attention-grabbing sound
              gainNode.gain.setValueAtTime(0.4, this.audioContext!.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + duration);

              oscillator.start(this.audioContext!.currentTime);
              oscillator.stop(this.audioContext!.currentTime + duration);
            }, index * 150); // 150ms between double beeps
          });
        }, i * 1000); // 1 second between each ring cycle
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
