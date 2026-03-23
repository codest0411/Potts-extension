// background/service-worker.js
// Main router and background coordinator for POTTS

import { askGemini } from '../core/gemini.js';
import { Memory } from '../core/memory.js';
import { generateBriefing, setupAlarms } from '../core/briefing.js';
import { computeTrustScore } from '../core/trust.js';
import { getPrivacyReport } from '../core/privacy.js';
import { translateText } from '../core/translate.js';
import { PottsDB } from '../core/db.js';

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

    // Setup Context Menus
    chrome.contextMenus.create({ id: "potts_explain", title: "POTTS: Explain This", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "potts_summarize", title: "POTTS: Summarize", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "potts_factcheck", title: "POTTS: Fact-Check Claim", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "potts_translate", title: "POTTS: Translate", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "potts_rewrite", title: "POTTS: Rewrite Text", contexts: ["editable"] });
    chrome.contextMenus.create({ id: "potts_email_reply", title: "POTTS: Generate Email Reply", contexts: ["editable"] });
});

// Listener for Context Menus
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'potts_rewrite') {
        chrome.tabs.sendMessage(tab.id, { type: 'REWRITE_FOCUSED_TEXT' }, async (response) => {
            if (chrome.runtime.lastError) {
                 chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: "I cannot access this page's text box, Sir." });
                 return;
            }
            if (response && response.original) {
                 const rewritten = await askGemini(`Rewrite and improve the following text to make it professional and articulate. Return ONLY the newly rewritten text directly, with no extra commentary:\n${response.original}`);
                 chrome.tabs.sendMessage(tab.id, { type: 'REPLACE_FOCUSED_TEXT', payload: rewritten });
                 chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: "Text rewritten, Sir." });
            }
        });
        return;
    }

    if (info.menuItemId === 'potts_email_reply') {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_DOM_CONTEXT' }, async (response) => {
             if (chrome.runtime.lastError) {
                 chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: "I cannot read emails on this restricted page, Sir." });
                 return;
             }
             const emailContext = response ? response.text : "";
             const reply = await askGemini(`You are writing an email reply. Based on the following page context (which contains the email thread), write a professional, concise reply. Output ONLY the email text.\nContext: ${emailContext}`);
             chrome.tabs.sendMessage(tab.id, { type: 'REPLACE_FOCUSED_TEXT', payload: reply });
             chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: "I have drafted a response, Sir." });
        });
        return;
    }

    let action = 'GENERAL';
    if (info.menuItemId === 'potts_explain') action = 'EXPLAIN';
    if (info.menuItemId === 'potts_summarize') action = 'SUMMARIZE';
    if (info.menuItemId === 'potts_factcheck') action = 'FACT_CHECK';
    if (info.menuItemId === 'potts_translate') action = 'TRANSLATE';

    const reqData = { action, text: info.selectionText, context: { url: tab.url } };
    
    // Process seamlessly behind the scenes
    processPottsRequest(reqData, null).then(res => {
        // Speak the result out loud like Jarvis
        chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: res.text });
    });
});

// Alarm Listener for Briefings & Reminders
chrome.alarms.onAlarm.addListener(async (alarm) => {
    // CRITICAL: Ensure Voice TTS system is awake before speaking
    try {
        await setupOffscreenDocument();
        // Give the offscreen document 200ms to register its message listeners before sending TTS_SPEAK
        await new Promise(r => setTimeout(r, 200));
    } catch(e) { console.error("Offscreen Boot Error:", e); }

    if (alarm.name === 'briefing-alarm') {
        const briefingText = await generateBriefing();
        chrome.runtime.sendMessage({ type: 'TTS_SPEAK', payload: briefingText }).catch(() => {});
    } else if (alarm.name.startsWith('reminder__||__')) {
        const task = alarm.name.split('__||__')[1];
        
        try {
            chrome.notifications.create(alarm.name + Date.now().toString(), {
                type: 'basic',
                // Using absolute root path to prevent background folder relative-path resolution failure
                iconUrl: '/assets/icon-128.png', 
                title: 'POTTS Reminder',
                message: task,
                priority: 2,
                requireInteraction: true // Keeps the notification stuck on screen until the user dismisses it!
            });
            
            // Backup notification: send a jarring alert() to the user's active tab so they absolutely cannot miss it
            chrome.tabs.query({active: true}, (tabs) => {
                 for (const t of tabs) {
                     chrome.tabs.sendMessage(t.id, { type: 'SHOW_ALERT', payload: task }).catch(()=>{});
                 }
            });
        } catch (e) {
            console.error("Notification creation failed:", e);
        }

        chrome.runtime.sendMessage({ type: 'TTS_SPEAK', payload: `Sir, you have a scheduled reminder: ${task}` }).catch(() => {});
        
        // Clean up DB
        try {
            await PottsDB.deleteReminder(alarm.name);
        } catch(e) {
            console.error("DB clean failed:", e);
        }
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

            case 'EXPLAIN':
                responseText = await askGemini(`Explain the following text clearly. If it's technical, simplify it somewhat, but provide depth if necessary. Text:\n${text}`);
                break;

            case 'FACT_CHECK':
                responseText = await askGemini(`Fact-check the following claim. Be rigorous and provide a Verdcit (Verified/Disputed/False) and the reason why. Claim:\n${text}`);
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
                
            case 'VISION_ANALYZE':
                responseText = await askGemini(`Analyze this screenshot. What am I looking at? Be concise and observant.`, null, reqData.imageB64);
                break;
                
            case 'ORGANIZE_TABS':
                const allTabs = await chrome.tabs.query({ currentWindow: true });
                if (allTabs.length < 2) { responseText = "Not enough tabs to organize, Sir."; break; }
                const tabData = allTabs.map(t => `${t.id}: ${t.url} - ${t.title}`).join('\n');
                const groupInstructions = await askGemini(`Categorize these tabs into 2-4 logical groups based on the URL and Title. 
                Return ONLY a strict JSON object mapping the Group Name to an array of tab IDs. Example: {"Work": [12,34], "Shopping": [54], "Reading": [88]}
                Do not include markdown blocks.
                Tabs:\n${tabData}`);
                try {
                    const parsedGroups = JSON.parse(groupInstructions.replace(/```json/g,'').replace(/```/g,'').trim());
                    for (const [groupName, tabIds] of Object.entries(parsedGroups)) {
                        if (tabIds.length > 0) {
                            const numericIds = tabIds.map(id => parseInt(id)).filter(id => !isNaN(id));
                            if (numericIds.length > 0) {
                                const groupId = await chrome.tabs.group({ tabIds: numericIds });
                                await chrome.tabGroups.update(groupId, { title: groupName });
                            }
                        }
                    }
                    responseText = "Tabs have been successfully categorized and grouped, Sir.";
                } catch(e) {
                     responseText = "Failed to parse tab grouping data.";
                }
                break;

            case 'SAVE_VAULT':
                await PottsDB.addVaultEntry(context?.url || "voice", text);
                responseText = "I have stored that in my long-term memory DB, Sir.";
                break;
                
            case 'RECALL_VAULT':
                const vd = await PottsDB.getAllVaultEntries();
                const vtext = vd.map(m => `[${m.date}] on ${m.context}: ${m.text}`).join('\n');
                responseText = await askGemini(`The user is asking a question about their long-term memory database context. Search the vault data below to answer it. \nUser Question: ${text}\nVault Data:\n${vtext}`);
                break;

            case 'SET_REMINDER':
                const reminderDataStr = await askGemini(`Extract the reminder task and the delay in minutes from this text: "${text}". 
                Return ONLY a strict JSON object with keys "task" (string) and "minutes" (number). 
                If no time is specified, default to 60.
                Example: {"task": "call john", "minutes": 5}`);
                try {
                    const rData = JSON.parse(reminderDataStr.replace(/```json/g,'').replace(/```/g,'').trim());
                    if (rData.task && typeof rData.minutes !== 'undefined') {
                        // Enforce number type to prevent "Invalid value for property delayInMinutes" crashes
                        let mins = parseFloat(rData.minutes) || 1;
                        if (mins < 1) mins = 1; // Native Chrome alarms require minimum of 1 minute in packed mode (or fractional works in unpacked but safe limit)
                        
                        const alarmName = `reminder__||__${rData.task}`;
                        chrome.alarms.create(alarmName, { delayInMinutes: mins });
                        await PottsDB.addReminder(rData.task, mins, alarmName);
                        
                        responseText = `I have set a reminder to ${rData.task} in ${mins} minute${mins !== 1 ? 's' : ''}. Saved to tracking database, Sir.`;
                    } else {
                        responseText = "I couldn't parse the time for the reminder, Sir.";
                    }
                } catch(e) {
                    responseText = "I encountered an error formatting the reminder database, Sir.";
                }
                break;

            case 'LIST_REMINDERS':
                const alarms = await chrome.alarms.getAll();
                const dbReminders = await PottsDB.getAllReminders();
                const activeAlarmNames = new Set(alarms.map(a => a.name));
                const activeReminders = dbReminders.filter(dbR => activeAlarmNames.has(dbR.alarmName));
                
                if (activeReminders.length === 0) {
                    responseText = "You have no active scheduled reminders in the database, Sir.";
                } else {
                    const taskList = activeReminders.map(dbR => {
                        const scheduledTime = new Date(dbR.scheduledFor).getTime();
                        const diffMins = Math.max(0, Math.round((scheduledTime - Date.now()) / 60000));
                        return `${dbR.task} in ${diffMins} minutes`;
                    }).join(', ');
                    responseText = `You have ${activeReminders.length} scheduled reminders: ${taskList}.`;
                }
                break;

            case 'YOUTUBE_SUMMARIZE':
                responseText = await askGemini(`This is a YouTube video page. Summarize the video based on this available DOM context. Extract the key takeaways: \n${text}`);
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
    let imageB64 = null;
    
    // Feature Routing
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
    else if (query.includes('what am i looking at') || query.includes('read screen')) {
        action = 'VISION_ANALYZE';
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {format: 'jpeg', quality: 50});
            imageB64 = dataUrl;
        } catch (e) {
            chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: "I am unable to see this screen, Sir. Chrome restricts vision on this page." });
            return;
        }
    }
    else if (query.includes('remind me to') || query.includes('set a reminder')) action = 'SET_REMINDER';
    else if (query.includes('what are my reminders') || query.includes('list active reminders')) action = 'LIST_REMINDERS';
    else if (query.includes('organize my tabs') || query.includes('clean up tabs')) action = 'ORGANIZE_TABS';
    else if (query.includes('remember this for later') || query.includes('save to vault')) action = 'SAVE_VAULT';
    else if (query.includes('do i have') || query.includes('did i save') || query.includes('recall')) action = 'RECALL_VAULT';
    else if (query.includes('summarize this video') || query.includes('youtube')) action = 'YOUTUBE_SUMMARIZE';

    // To get page context we need to query active tab
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    // We send dummy text for now, ideally we request the content script to extract DOM
    processPottsRequest({
        action,
        text: query,
        imageB64,
        context: { url: activeTab?.url || "global" }
    }, null).then(res => {
         chrome.runtime.sendMessage({ type: "TTS_SPEAK", payload: res.text });
    });
}
