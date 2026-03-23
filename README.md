<div align="center">
  <img src="assets/banner.svg" alt="POTTS System Banner" width="100%">
</div>

# POTTS — Personal Operations & Tactical Task System

> *A Jarvis-class, highly robust voice AI assistant embedded directly into your Chrome browser, fully powered by an auto-detecting multi-model fallback chain.*

POTTS sits quietly in the background, executing tasks via right-click contextual powers or through the popup voice interface. Designed with zero Node.js dependencies (plain Vanilla JS/MV3), meaning it runs **lightweight, fast, and completely in your local browser.**

---

## 🔥 Master Features

### 1. 🌐 The "Four-Pillar" AI Fallback Architecture 
POTTS achieves zero-downtime reliability by chaining multiple world-class AI models. If one API goes down or hits a rate limit, it instantly falls to the next provider:
1. **Groq (`llama-3.1-8b-instant`)** — Lightning fast primary routing.
2. **OpenAI (`gpt-4o-mini`)** — Reliable, world-class standard.
3. **Anthropic (`claude-3-haiku`)** — Nuanced & articulate.
4. **Google Gemini (`gemini-1.5-flash` / `gemini-pro`)** — Native final fallback wrapper.

> **Note:** You can configure just ONE key, or all four. The system automatically detects and routes around empty or failing keys. Use the **Verify API Keys** button in the Options page for a live health dashboard.

### 2. 🖱️ Smart Right-Click Context Menus
Highlight any text on any website to access POTTS' superpowers instantly:
* **POTTS: Explain This** - Breaks down complex Jargon into plain English.
* **POTTS: Fact-Check** - Evaluates claims and declares them Verified, Disputed, or False.
* **POTTS: Summarize** - Reduces massive blocks of text into concise bullet points.
* **POTTS: Translate** - Auto-detects text and translates it to English (or your preferred override).

### 3. ✍️ Real-time Smart Text Rewriter
The ultimate productivity hack. Composing a tweet, an email in Gmail, or a post on LinkedIn? 
* Right-click inside the text box and select **POTTS: Rewrite Text**.
* POTTS extracts your rough draft, reformats it to be highly professional, and **types it perfectly back into the text box for you**.

### 4. 🎙️ Voice Ring & TTS Feedback
Click the pulsing **Voice Ring** in the popup to speak your commands via Chrome’s native Web Speech API. POTTS replies in text, and speaks back to you over the web audio engine — just like Tony Stark's assistant.

### 5. 🛡️ Trust Score & Active Scanning
Ask POTTS "Is this a scam?" or manually click "Trust Score". POTTS will ping **RDAP Registries** for domain age data, scan the page context, and spit out a 0-100 safety rating.

---

## ⚙️ Installation Guide

Because POTTS is an MV3 (Manifest V3) completely vanilla JavaScript extension, it requires zero command-line tools to build.

1. **Clone or Download** this repository to your local machine:
   ```bash
   git clone https://github.com/codest0411/Potts-extension.git
   ```
2. **Enable Dev Mode**: Open Google Chrome and navigate to `chrome://extensions/`. Toggle **Developer Mode** on in the top-right corner.
3. **Load Extension**: Click the **Load unpacked** button and select the `Potts-extension` folder.
4. **Initial Configuration**: Right-click the newly appearing POTTS icon `◎` in your extension bar and select **Options**.
5. **Paste your API Keys**: Drop in your free Gemini, Groq, Anthropic, or OpenAI keys. Click **Save** and then **Verify API Keys** to ensure your link is active.

---

## 🔒 Extension Permissions Explained

Chrome closely monitors extensions. Here is why POTTS requests these specific permissions:
* `"activeTab"`: Used to read the DOM when you ask "Summarize this page" or "Rewrite my text".
* `"contextMenus"`: Powers the heavily-featured right-click interactions.
* `"alarms"` & `"notifications"`: Used specifically for the Daily Morning Briefing feature.
* `"storage"`: Securely stores your API keys strictly on your local `chrome.storage.local` hard drive.
* `"offscreen"`: Required by Manifest V3 to run background microphone inputs (for the continuous wake word and voice dictation components).

---

## 🛠️ Tech Stack & Modding
* **Frontend UI**: Vanilla HTML / Vanilla CSS 
* **Core Logic**: ES6 JavaScript Modules (No Webpack / No React / No Build step)
* **Design Systems**: Custom minimal dark mode UI. CSS Grid & Flexbox layouts.

Want to configure POTTS to address you by a different title? Change it in the Options menu under **Title Override**!

<div align="center">
  <i>"At your service."</i>
</div>