// core/speech.js
// Voice layer: STT & TTS 
// NOTE: Since MV3 service workers don't have SpeechRecognition or AudioContext,
// this layer acts mostly as a bridge sending commands to the offscreen document.

export const Speech = {
    // Start listening process
    startListening() {
        chrome.runtime.sendMessage({ type: "START_LISTENING" });
    },
    
    stopListening() {
        chrome.runtime.sendMessage({ type: "STOP_LISTENING" });
    },
    
    // TTS: Speak a given text using SpeechSynthesis
    speak(text) {
        chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: text });
    }
};
