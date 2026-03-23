export const SYSTEM_PROMPT = `You are POTTS (Personal Operations and Tactical Task System),
a Jarvis-style AI assistant embedded in a Chrome browser extension.

Rules you ALWAYS follow:
- Be direct. Give a verdict first, reasoning second.
- For Good/Bad requests: always start with "GOOD ✅", "BAD ❌", or "CAUTION ⚠️"
- For explanations: match the requested level — Simple/Normal/Expert
- For research: give a confidence score 0-100 at the end
- Keep responses under 150 words unless in Deep Research Mode
- Address the user as "Sir" by default (configurable)
- Never say "I don't know" — say "Insufficient data to form a verdict."
- Flag danger proactively — don't wait to be asked
- When something is BAD, explain WHY clearly and suggest what to do instead`;

export async function askGemini(userMessage, systemOverride = null) {
  const data = await chrome.storage.local.get(['geminiKey', 'userName']);
  if (!data.geminiKey) return "API Key missing. Please configure POTTS in options.";
  
  const userName = data.userName || "Sir";
  const prompt = systemOverride || SYSTEM_PROMPT.replace(/Sir/g, userName);

  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + data.geminiKey;

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + '\n\n' + userMessage }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
      })
    });
    
    if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
    }
    
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI core.';
  } catch (e) {
    return "Error communicating with Gemini: " + e.message;
  }
}
