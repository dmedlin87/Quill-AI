declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }

  interface GlobalThis {
    webkitAudioContext?: typeof AudioContext;
  }
}

export {};
