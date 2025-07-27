/**
 * Utility functions for playing audio feedback sounds
 */

// Create success sound using Web Audio API
const createSuccessSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a short pleasant success sound sequence
    const playTone = (frequency: number, duration: number, delay: number = 0) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
      oscillator.type = 'sine';
      
      // Smooth volume envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + delay + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + delay + duration);
      
      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + duration);
    };
    
    // Play a pleasant success chord sequence (C-E-G)
    playTone(523.25, 0.15, 0);    // C5
    playTone(659.25, 0.15, 0.05); // E5
    playTone(783.99, 0.2, 0.1);   // G5
    
  } catch (error) {
    console.log('Web Audio API no disponible, usando sonido de sistema');
    // Fallback: try to play a system sound if available
    playSystemSound();
  }
};

// Fallback system sound
const playSystemSound = () => {
  try {
    // Create a short data URL audio for browsers that support it
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N+PQAoUXrTp66hVFApGn+Putl8eEGuw5/Ol');
    audio.volume = 0.1;
    audio.play().catch(() => {
      // Si falla, no hacer nada (silent fail)
    });
  } catch (error) {
    // Silent fail para máxima compatibilidad
  }
};

// Create error sound for failed scans
const createErrorSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (frequency: number, duration: number, delay: number = 0) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
      oscillator.type = 'sawtooth';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + delay + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + delay + duration);
      
      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + duration);
    };
    
    // Play a descending error tone
    playTone(300, 0.1, 0);
    playTone(200, 0.15, 0.05);
    
  } catch (error) {
    // Silent fail para máxima compatibilidad
  }
};

/**
 * Play success sound for QR scan success
 */
export const playQRSuccessSound = () => {
  createSuccessSound();
};

/**
 * Play error sound for QR scan failure
 */
export const playQRErrorSound = () => {
  createErrorSound();
};

/**
 * Play completion sound for map completion
 */
export const playCompletionSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (frequency: number, duration: number, delay: number = 0) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + delay + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + delay + duration);
      
      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + duration);
    };
    
    // Play a triumphant completion melody
    playTone(523.25, 0.2, 0);    // C5
    playTone(659.25, 0.2, 0.1);  // E5
    playTone(783.99, 0.2, 0.2);  // G5
    playTone(1046.5, 0.3, 0.3);  // C6
    
  } catch (error) {
    playSystemSound();
  }
};