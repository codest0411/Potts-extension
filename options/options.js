// options/options.js
// API Keys & User profile setup

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
document.getElementById('verifyBtn').addEventListener('click', verifyKeys);

function saveOptions() {
    const groqKey = document.getElementById('groqKey').value.trim();
    const openAiKey = document.getElementById('openAiKey').value.trim();
    const anthropicKey = document.getElementById('anthropicKey').value.trim();
    const geminiKey = document.getElementById('geminiKey').value.trim();
    const gnewsKey = document.getElementById('gnewsKey').value.trim();
    const userName = document.getElementById('userName').value.trim() || 'Sir';

    chrome.storage.local.set({
        groqKey, openAiKey, anthropicKey, geminiKey, gnewsKey, userName
    }, () => {
        const status = document.getElementById('status');
        status.innerHTML = '<span style="color:#00e676;">Configuration saved securely.</span>';
        setTimeout(() => { status.textContent = ''; }, 3000);
    });
}

function restoreOptions() {
    chrome.storage.local.get(['groqKey', 'openAiKey', 'anthropicKey', 'geminiKey', 'gnewsKey', 'userName'], (items) => {
        if (items.groqKey) document.getElementById('groqKey').value = items.groqKey;
        if (items.openAiKey) document.getElementById('openAiKey').value = items.openAiKey;
        if (items.anthropicKey) document.getElementById('anthropicKey').value = items.anthropicKey;
        if (items.geminiKey) document.getElementById('geminiKey').value = items.geminiKey;
        if (items.gnewsKey) document.getElementById('gnewsKey').value = items.gnewsKey;
        if (items.userName) document.getElementById('userName').value = items.userName;
    });
}

async function verifyKeys() {
    saveOptions();
    const status = document.getElementById('status');
    status.innerHTML = '<span style="color:#ffc107;">Verifying API Keys...</span><br>';
    
    // Test Groq
    const groq = document.getElementById('groqKey').value.trim();
    if (groq) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groq}` }, body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{role: 'user', content: 'test'}] }) });
            status.innerHTML += res.ok ? '✅ Groq: Working<br>' : `❌ Groq: Error ${res.status}<br>`;
        } catch(e) { status.innerHTML += `❌ Groq: Network Error<br>`; }
    } else { status.innerHTML += `⚪ Groq: Not configured<br>`; }

    // Test OpenAI
    const oa = document.getElementById('openAiKey').value.trim();
    if (oa) {
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${oa}` }, body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{role: 'user', content: 'test'}] }) });
            status.innerHTML += res.ok ? '✅ OpenAI: Working<br>' : `❌ OpenAI: Error ${res.status}<br>`;
        } catch(e) { status.innerHTML += `❌ OpenAI: Network Error<br>`; }
    } else { status.innerHTML += `⚪ OpenAI: Not configured<br>`; }

    // Test Gemini
    const gem = document.getElementById('geminiKey').value.trim();
    if (gem) {
        try {
            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + gem, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] }) });
            if (res.ok) {
                 status.innerHTML += '✅ Gemini (Flash): Working<br>';
            } else {
                 if (res.status === 404) {
                      const resPro = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + gem, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] }) });
                      status.innerHTML += resPro.ok ? '✅ Gemini (Pro fallback): Working<br>' : `❌ Gemini: Both Flash & Pro failed<br>`;
                 } else { status.innerHTML += `❌ Gemini: Error ${res.status}<br>`; }
            }
        } catch(e) { status.innerHTML += `❌ Gemini: Network Error<br>`; }
    } else { status.innerHTML += `⚪ Gemini: Not configured<br>`; }
}
