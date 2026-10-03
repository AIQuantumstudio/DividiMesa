// Web Audio API soft tactile feedback
let audioContext: AudioContext | null = null;

export function playTapSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (!audioContext) {
      audioContext = new AudioContextClass();
    }
    
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.frequency.setValueAtTime(600, audioContext.currentTime);
    gain.gain.setValueAtTime(0.04, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start();
    osc.stop(audioContext.currentTime + 0.08);
  } catch {
    // Ignore audio error if user hasn't interacted or policy prevents it
  }
}
