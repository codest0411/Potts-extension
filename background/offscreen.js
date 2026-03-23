// background/offscreen.js
// Runs continuous wake word detection, Web Speech API processing, TTS

const WAITING_BEEP = chrome.runtime.getURL('assets/chime.mp3');
let recognition;
let isListening = false;
let audioContext = null;
let silenceTimer = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_LISTENING') {
        startSpeechRecognition();
    } else if (message.type === 'STOP_LISTENING') {
        stopSpeechRecognition();
    } else if (message.type === 'TTS_SPEAK') {
        speakText(message.payload);
    }
});

// Setup Speech Recognition
function startSpeechRecognition() {
    if (isListening) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error("Speech Recognition API not supported in this browser.");
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        playChime();
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        
        if (finalTranscript.trim().length > 0) {
            // Forward transcript to service worker for processing
            chrome.runtime.sendMessage({
                type: 'VOICE_COMMAND_DETECTED',
                payload: finalTranscript.trim()
            });
        }
    };

    recognition.onerror = (e) => console.log('Speech recognition error', e);
    recognition.onend = () => {
        isListening = false;
        // Auto-restart if we want continuous wake word listening (handle logic carefully)
    };

    try {
        recognition.start();
    } catch (e) { console.error("Could not start recognition", e); }
}

function stopSpeechRecognition() {
    if (recognition) {
        recognition.stop();
    }
}

function speakText(text) {
    if (!window.speechSynthesis) return;
    
    // Attempt to use a British male voice if available (Jarvis-esque)
    const voices = speechSynthesis.getVoices();
    const jarvisVoice = voices.find(v => v.lang.includes('en-GB') && v.name.includes('Male')) || 
                        voices.find(v => v.lang.includes('en-GB')) || 
                        voices[0];
                        
    const utterance = new SpeechSynthesisUtterance(text);
    if (jarvisVoice) utterance.voice = jarvisVoice;
    
    utterance.rate = 1.05;
    utterance.pitch = 0.9;
    
    speechSynthesis.speak(utterance);
}

function playChime() {
    const audio = new Audio(WAITING_BEEP);
    audio.play().catch(e => console.log("Audio play failed", e));
}
