// content/content.js
// Injected into every page — DOM reader, overlay

// 1. Setup minimal DOM extraction for Page Intelligence
function getPageContent() {
    // Basic extraction of readable text, ignoring scripts, styles, etc.
    const clone = document.body.cloneNode(true);
    const elementsToRemove = clone.querySelectorAll('script, style, nav, footer, iframe, noscript');
    elementsToRemove.forEach(el => el.remove());
    
    // Get text and restrict length to not blow up API token limits
    let text = clone.innerText || "";
    return text.trim().substring(0, 50000); 
}

// 2. Setup the POTTS inline overlay (Verdict badges, alerts)
function createPottsOverlay() {
    if (document.getElementById('potts-overlay-container')) return;
    
    const container = document.createElement('div');
    container.id = 'potts-overlay-container';
    
    const badge = document.createElement('div');
    badge.id = 'potts-badge';
    badge.innerText = 'POTTS: Scanning...';
    
    container.appendChild(badge);
    document.body.appendChild(container);
    
    // Start page intelligence automatically
    analyzePage();
}

async function analyzePage() {
    // Send background a request to evaluate Trust/Scam level silently
    try {
        const text = getPageContent();
        chrome.runtime.sendMessage({
            type: "HANDLE_REQUEST",
            payload: { action: "TRUST_SCORE", text: text, context: { url: window.location.href } }
        }, (response) => {
            const badge = document.getElementById('potts-badge');
            if (response && response.text) {
                // Determine CSS class based on text content parsing
                badge.innerText = response.text.substring(0, 40) + "...";
                if (response.text.toLowerCase().includes('caution') || response.text.match(/score.*([0-4][0-9])/)) {
                     badge.className = 'potts-warning';
                } else {
                     badge.className = 'potts-safe';
                }
            } else {
                badge.style.display = 'none';
            }
        });
    } catch(e) {
        console.error("POTTS scan failed", e);
    }
}

// 3. Listen for requests from popup/background for focused text (Smart Text Rewriter)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SHOW_ALERT") {
        alert("🔔 POTTS REMINDER:\n\n" + msg.payload);
        return;
    }

    if (msg.type === "GET_DOM_CONTEXT") {
        sendResponse({ text: getPageContent(), url: window.location.href });
    }
    
    if (msg.type === "REWRITE_FOCUSED_TEXT") {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT' || activeElement.isContentEditable)) {
             sendResponse({ original: activeElement.value || activeElement.innerText });
        }
    }

    if (msg.type === "REPLACE_FOCUSED_TEXT") {
        const activeElement = document.activeElement;
        if (activeElement) {
            if (activeElement.value !== undefined) {
                activeElement.value = msg.payload;
            } else if (activeElement.isContentEditable) {
                activeElement.innerText = msg.payload;
            }
            
            // Dispatch input event so React/Vue applications (like Twitter or Gmail) detect the rewrite
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
});

// Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPottsOverlay);
} else {
    createPottsOverlay();
}
