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

export async function askGemini(userMessage, systemOverride = null, imageB64 = null) {
  const data = await chrome.storage.local.get(['groqKey', 'openAiKey', 'anthropicKey', 'geminiKey', 'userName']);
  if (!data.groqKey && !data.openAiKey && !data.anthropicKey && !data.geminiKey) return "API Key missing. Please configure POTTS in options.";
  
  const userName = data.userName || "Sir";
  const prompt = systemOverride || SYSTEM_PROMPT.replace(/Sir/g, userName);

  let lastError = "";

  // 1. Try GROQ (Lightning Fast LLaMA 3.1) - Skip if image is provided (not supported by this Groq model)
  if (data.groqKey && !imageB64) {
      try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.groqKey}` },
              body: JSON.stringify({
                  model: 'llama-3.1-8b-instant',
                  messages: [{role: 'system', content: prompt}, {role: 'user', content: userMessage}],
                  temperature: 0.3, max_tokens: 800
              })
          });
          if (res.ok) {
              const json = await res.json();
              return json.choices?.[0]?.message?.content || 'No response from Groq.';
          }
          const errText = await res.text();
          lastError += `Groq Error (${res.status}): ${errText.substring(0, 60)}\n`;
      } catch (e) {
          lastError += `Groq Network Error: ${e.message}\n`;
      }
  }

  // 2. Try OPENAI (GPT-4o-mini)
  if (data.openAiKey) {
      try {
          const userContent = imageB64 
              ? [{type: "text", text: userMessage}, {type: "image_url", image_url: {url: imageB64}}] 
              : userMessage;
              
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.openAiKey}` },
              body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  messages: [{role: 'system', content: prompt}, {role: 'user', content: userContent}],
                  temperature: 0.3, max_tokens: 800
              })
          });
          if (res.ok) {
              const json = await res.json();
              return json.choices?.[0]?.message?.content || 'No response from OpenAI.';
          }
          const errText = await res.text();
          lastError += `OpenAI Error (${res.status}): ${errText.substring(0, 60)}\n`;
      } catch (e) {
          lastError += `OpenAI Network Error: ${e.message}\n`;
      }
  }

  // 3. Try ANTHROPIC (Claude 3 Haiku)
  if (data.anthropicKey) {
      try {
          let userContent = [{type: "text", text: userMessage}];
          if (imageB64) {
              // Anthropic requires raw base64 data, stripping out the 'data:image/jpeg;base64,' prefix
              const b64Data = imageB64.includes(',') ? imageB64.split(',')[1] : imageB64;
              userContent.unshift({type: "image", source: {type: "base64", media_type: "image/jpeg", data: b64Data}});
          }

          const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json', 
                  'x-api-key': data.anthropicKey,
                  'anthropic-version': '2023-06-01',
                  'anthropic-dangerous-direct-browser-access': 'true'
              },
              body: JSON.stringify({
                  model: 'claude-3-haiku-20240307',
                  system: prompt,
                  messages: [{role: 'user', content: userContent}],
                  max_tokens: 800,
                  temperature: 0.3
              })
          });
          if (res.ok) {
              const json = await res.json();
              return json.content?.[0]?.text || 'No response from Anthropic.';
          }
          const errText = await res.text();
          lastError += `Anthropic Error (${res.status}): ${errText.substring(0, 60)}\n`;
      } catch (e) {
          lastError += `Anthropic Network Error: ${e.message}\n`;
      }
  }

  // 4. Try GEMINI
  if (data.geminiKey) {
      try {
          let geminiParts = [{text: prompt + '\n\n' + userMessage}];
          if (imageB64) {
               const b64Data = imageB64.includes(',') ? imageB64.split(',')[1] : imageB64;
               geminiParts.push({inlineData: {mimeType: "image/jpeg", data: b64Data}});
          }

          // Attempt 1.5 Flash
          let GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + data.geminiKey;
          let res = await fetch(GEMINI_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  contents: [{ parts: geminiParts }],
                  generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
              })
          });
          
          if (res.status === 404) {
              // Fallback to gemini-pro if Flash is not enabled for this specific GCP API key
              // Note: Gemini-pro 1.0 does not natively support inlineData vision in the same endpoint usually, but 1.5-pro does.
              GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + data.geminiKey;
              res = await fetch(GEMINI_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      contents: [{ parts: geminiParts }],
                      generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
                  })
              });
          }
          
          if (res.ok) {
              const json = await res.json();
              return json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI core.';
          }
          const errText = await res.text();
          lastError += `Gemini Error (${res.status}): ${errText.substring(0, 60)}\n`;
      } catch (e) {
          lastError += `Gemini Network Error: ${e.message}\n`;
      }
  }

  return "All available APIs failed. Errors:\n" + lastError;
}
