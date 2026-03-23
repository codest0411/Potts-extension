// popup/popup.js
// Handles user interactions inside the popup

const chatArea = document.getElementById('chatArea');
const input = document.getElementById('manualInput');
const sendBtn = document.getElementById('sendBtn');
const voiceRing = document.getElementById('voiceRing');
const statusText = document.getElementById('statusText');
let listening = false;

document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

function addMessage(sender, text) {
    const d = document.createElement('div');
    d.className = `chat-msg ${sender === 'User' ? 'msg-user' : 'msg-potts'}`;
    d.innerHTML = text.replace(/\n/g, '<br>'); // Simple break
    chatArea.appendChild(d);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// Quick Actions
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        sendPottsRequest(action, `Execute: ${btn.textContent}`);
    });
});

async function sendPottsRequest(action, displayMsg) {
    addMessage('User', displayMsg);
    
    // Get active tab context
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    let pageContext = "";
    
    // Request content script to get full page dom safely
    if (tabs[0]?.id) {
        try {
            const domExtract = await chrome.tabs.sendMessage(tabs[0].id, {type: 'GET_DOM_CONTEXT'});
            if(domExtract?.text) pageContext = domExtract.text;
        } catch(e) {
            console.log("Could not inject or reach content script", e);
        }
    }
    
    addMessage('POTTS', 'Processing, Sir...');
    const msgs = chatArea.querySelectorAll('.msg-potts');
    const lastPotts = msgs[msgs.length - 1];

    chrome.runtime.sendMessage({
        type: 'HANDLE_REQUEST',
        payload: { action, text: action === 'GENERAL' ? displayMsg : pageContext || `(No page context. User input: ${displayMsg})`, context: { url: tabs[0]?.url } }
    }, response => {
        if (response?.text) {
             lastPotts.innerHTML = response.text.replace(/\n/g, '<br>');
             chatArea.scrollTop = chatArea.scrollHeight;
        } else {
             lastPotts.innerHTML = "Error communicating with AI Core.";
        }
    });
}

// Manual Send
sendBtn.addEventListener('click', () => {
    if(!input.value) return;
    const txt = input.value;
    input.value = '';
    sendPottsRequest('GENERAL', txt);
});
input.addEventListener('keypress', e => e.key === 'Enter' && sendBtn.click());

// Push to Talk toggling
voiceRing.addEventListener('click', () => {
    listening = !listening;
    if (listening) {
        voiceRing.classList.add('active');
        statusText.textContent = "Listening...";
        chrome.runtime.sendMessage({type: 'START_LISTENING'});
    } else {
        voiceRing.classList.remove('active');
        statusText.textContent = "Awaiting Command, Sir.";
        chrome.runtime.sendMessage({type: 'STOP_LISTENING'});
    }
});
