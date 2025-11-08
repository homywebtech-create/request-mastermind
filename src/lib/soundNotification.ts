// Sound notification utility for order alerts

export class SoundNotification {
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Create audio element for notification sound
      this.audioElement = new Audio('/notification-sound.mp3');
      this.audioElement.loop = false;
      this.audioElement.volume = 0.8;
    }
  }

  /**
   * Play a notification sound for new orders (specialist version - louder and longer)
   * This plays a long ringtone-like sound similar to phone calls
   */
  async playNewOrderSound() {
    try {
      console.log('🔊 [AUDIO] Attempting to play overdue order sound...');
      console.log('🔊 [AUDIO] Audio element exists:', !!this.audioElement);
      console.log('🔊 [AUDIO] Audio context exists:', !!this.audioContext);
      console.log('🔊 [AUDIO] Is initialized:', this.isInitialized);
      
      // Try HTML Audio element first (more reliable for continuous playback)
      if (this.audioElement) {
        console.log('🔊 [AUDIO] Using HTML Audio element...');
        console.log('🔊 [AUDIO] State - paused:', this.audioElement.paused, 'readyState:', this.audioElement.readyState, 'volume:', this.audioElement.volume);
        console.log('🔊 [AUDIO] Audio src:', this.audioElement.src);
        
        try {
          // Force reload if needed
          if (this.audioElement.readyState < 2) {
            console.log('🔄 [AUDIO] Reloading audio element...');
            await this.audioElement.load();
          }
          
          // Reset and play the audio
          this.audioElement.currentTime = 0;
          this.audioElement.volume = 1.0; // Max volume
          
          console.log('▶️ [AUDIO] Calling play()...');
          const playPromise = this.audioElement.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            console.log('✅ [AUDIO] Audio playing successfully!');
            return;
          }
        } catch (playError: any) {
          console.error('❌ [AUDIO] HTML Audio play failed:', playError.name, playError.message);
          // Fall through to Web Audio API
        }
      } else {
        console.error('❌ [AUDIO] No audio element available');
      }

      // Fallback to Web Audio API
      if (!this.audioContext) {
        console.error('❌ No audio context available');
        return;
      }

      // Resume audio context if suspended (required by browsers)
      if (this.audioContext.state === 'suspended') {
        console.log('🔄 Resuming suspended audio context...');
        await this.audioContext.resume();
      }

      console.log('🔊 Audio context state:', this.audioContext.state);

      // Play continuous ringtone for 10 seconds (like a phone call)
      const ringCount = 10; // 10 rings over 10 seconds
      const duration = 0.5; // Each beep lasts 0.5 seconds
      const frequencies = [659.25, 783.99]; // E5, G5 - classic ringtone pattern
      
      for (let i = 0; i < ringCount; i++) {
        setTimeout(() => {
          // Play double beep for each ring
          frequencies.forEach((freq, index) => {
            setTimeout(() => {
              if (!this.audioContext) return;
              
              const oscillator = this.audioContext.createOscillator();
              const gainNode = this.audioContext.createGain();

              oscillator.connect(gainNode);
              gainNode.connect(this.audioContext.destination);

              // Use sine wave for phone-like ringtone
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);

              // Higher volume for attention-grabbing sound
              gainNode.gain.setValueAtTime(0.6, this.audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

              oscillator.start(this.audioContext.currentTime);
              oscillator.stop(this.audioContext.currentTime + duration);
            }, index * 150); // 150ms between double beeps
          });
        }, i * 1000); // 1 second between each ring cycle
      }

    } catch (error) {
      console.error('❌ Error playing new order sound:', error);
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
   * Play sound when sending a message
   */
  async playSentMessageSound() {
    if (!this.audioContext) return;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);

      gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('Error playing sent message sound:', error);
    }
  }

  /**
   * Play sound when receiving a message
   */
  async playReceivedMessageSound() {
    if (!this.audioContext) return;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const duration = 0.15;
      const frequencies = [600, 800]; // Double beep
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          const oscillator = this.audioContext!.createOscillator();
          const gainNode = this.audioContext!.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(this.audioContext!.destination);

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(freq, this.audioContext!.currentTime);

          gainNode.gain.setValueAtTime(0.2, this.audioContext!.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + duration);

          oscillator.start(this.audioContext!.currentTime);
          oscillator.stop(this.audioContext!.currentTime + duration);
        }, index * 100);
      });
    } catch (error) {
      console.error('Error playing received message sound:', error);
    }
  }

  /**
   * Initialize audio context on user interaction (required by browsers)
   */
  async initialize() {
    console.log('🎵 Initializing sound notification system...');
    
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('✅ Audio context resumed');
    }
    
    // Preload audio element
    if (this.audioElement && !this.isInitialized) {
      try {
        await this.audioElement.load();
        this.isInitialized = true;
        console.log('✅ Audio element initialized and ready');
      } catch (error) {
        console.error('❌ Error initializing audio element:', error);
      }
    }
  }

  /**
   * Test the audio system
   */
  async testSound() {
    console.log('🧪 Testing audio system...');
    await this.initialize();
    await this.playNewOrderSound();
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
