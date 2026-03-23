// options/options.js
// API Keys & User profile setup

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

function saveOptions() {
    const geminiKey = document.getElementById('geminiKey').value.trim();
    const gnewsKey = document.getElementById('gnewsKey').value.trim();
    const userName = document.getElementById('userName').value.trim() || 'Sir';

    chrome.storage.local.set({
        geminiKey,
        gnewsKey,
        userName
    }, () => {
        const status = document.getElementById('status');
        status.textContent = 'Configuration saved securely.';
        setTimeout(() => { status.textContent = ''; }, 3000);
    });
}

function restoreOptions() {
    chrome.storage.local.get(['geminiKey', 'gnewsKey', 'userName'], (items) => {
        if (items.geminiKey) document.getElementById('geminiKey').value = items.geminiKey;
        if (items.gnewsKey) document.getElementById('gnewsKey').value = items.gnewsKey;
        if (items.userName) document.getElementById('userName').value = items.userName;
    });
}
