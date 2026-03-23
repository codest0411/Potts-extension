// core/translate.js
// MyMemory Translation API wrapper

export async function translateText(text, targetLang = 'en') {
    if (!text) return "No text provided to translate.";
    
    // Auto detect source, translate to targetLang
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${targetLang}`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Translation service unavailable.");
        const data = await res.json();
        
        if (data.responseData?.translatedText) {
            return data.responseData.translatedText;
        }
        return "Failed to parse translation response.";
    } catch (e) {
        return "Translation Error: " + e.message;
    }
}
