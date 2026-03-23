// background/service-worker.js
// Main router and background coordinator for POTTS

import { askGemini } from '../core/gemini.js';
import { Memory } from '../core/memory.js';
import { generateBriefing, setupAlarms } from '../core/briefing.js';
import { computeTrustScore } from '../core/trust.js';
import { getPrivacyReport } from '../core/privacy.js';
import { translateText } from '../core/translate.js';

// Setup Initialization
chrome.runtime.onInstalled.addListener(async () => {
    console.log("POTTS - Jarvis System Initialized");
    await setupOffscreenDocument();
    setupAlarms();
    
    // Set default storage settings if not set
    const data = await chrome.storage.local.get(['userName']);
    if (!data.userName) {
        chrome.storage.local.set({ userName: 'Sir' });
    }
});

// Alarm Listener for Briefings
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'briefing-alarm') {
        const briefingText = await generateBriefing();
        chrome.runtime.sendMessage({ type: 'TTS_SPEAK', payload: briefingText });
    }
});

// Setup Offscreen doc
async function setupOffscreenDocument() {
    const offscreenUrl = 'background/offscreen.html';
    
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(offscreenUrl)]
    });
    
    if (existingContexts.length > 0) return;
    
    try {
        await chrome.offscreen.createDocument({
            url: offscreenUrl,
            reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
            justification: 'Wake word detection and Jarvis voice TTS'
        });
    } catch(e) {
        console.error("Failed to create offscreen document", e);
    }
}

// Router for all POTTS actions (Popup, Voice, Settings)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'VOICE_COMMAND_DETECTED') {
        handleVoiceCommand(message.payload);
    }
    
    if (message.type === 'HANDLE_REQUEST') {
        processPottsRequest(message.payload, sender).then(res => {
            sendResponse(res);
            // Optionally auto-speak the response
            chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: res.text });
        });
        return true; // async
    }
});

async function processPottsRequest(reqData, sender) {
    const { action, text, context } = reqData;
    let responseText = "";
    
    Memory.addInteraction("user", text || action, context?.url);

    try {
        switch (action) {
            case 'GOOD_BAD':
                responseText = await askGemini(`User is asking if the following context is good or bad. Be direct and rate it. Context: \n${text}`);
                break;
                
            case 'SUMMARIZE':
                responseText = await askGemini(`Summarize the main points and tone of this text:\n${text}`);
                break;
                
            case 'TRUST_SCORE':
                const domain = new URL(context.url).hostname;
                const scoreData = await computeTrustScore(domain);
                responseText = `The trust score for ${domain} is ${scoreData.score}/100. ${scoreData.explanation}`;
                break;

            case 'DEVIL_ADVOCATE':
                responseText = await askGemini(`Argue intensely AGAINST whatever idea, product, or decision is described below. Be a strong devil's advocate.\n${text}`);
                break;

            case 'TRANSLATE':
                responseText = await translateText(text, 'es'); // default 'es', could be configurable
                break;

            case 'PRIVACY_REPORT':
                const report = await getPrivacyReport();
                responseText = `Privacy Scan complete. ${report.trackersBlocked} potential trackers identified and blocked.`;
                break;

            case 'RESEARCH':
                responseText = await askGemini(`Go deep on this topic. Provide pros, cons, a confidence score 0-100, and a summary.\nTopic: ${text}`);
                break;
                
            default:
                responseText = await askGemini(text); 
                break;
        }
    } catch (e) {
        responseText = "I encountered an error processing that request, Sir. " + e.message;
    }
    
    Memory.addInteraction("potts", responseText, null);
    return { text: responseText };
}

// Minimal voice command parser
async function handleVoiceCommand(transcript) {
    const text = transcript.toLowerCase();
    
    if (!text.includes("potts")) return; // Wake word must be present
    
    const query = text.replace("hey potts", "").replace("potts", "").trim();
    
    if (!query) {
        chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: "Yes, Sir?" });
        return;
    }
    
    let action = 'GENERAL';
    if (query.includes('good or bad') || query.includes('is this a scam')) action = 'GOOD_BAD';
    else if (query.includes('briefing') || query.includes('morning')) {
        const briefingText = await generateBriefing();
        chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: briefingText });
        return;
    }
    else if (query.includes('devil\'s advocate')) action = 'DEVIL_ADVOCATE';
    else if (query.includes('go deep') || query.includes('research')) action = 'RESEARCH';
    else if (query.includes('translate')) action = 'TRANSLATE';
    else if (query.includes('privacy')) action = 'PRIVACY_REPORT';

    // To get page context we need to query active tab
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    // We send dummy text for now, ideally we request the content script to extract DOM
    processPottsRequest({
        action,
        text: query,
        context: { url: activeTab?.url || "global" }
    }, null).then(res => {
         chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: res.text });
    });
}
