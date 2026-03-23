// core/briefing.js
// Daily Briefing Mode - News (GNews) + Weather (Open-Meteo)

export async function generateBriefing() {
    let briefingText = "Here is your morning briefing, Sir. ";
    
    // Fetch Weather
    try {
        // Auto-detect location approximation via IP geolocation is best but hard without a free API 
        // that allows JS calls, so we'll use a hardcoded default (New York coordinates) for this demo
        // or a settings value.
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current_weather=true");
        if (res.ok) {
            const data = await res.json();
            const tempC = data.current_weather.temperature;
            const tempF = Math.round(tempC * 9/5 + 32);
            briefingText += `The current temperature is ${tempC}°C (${tempF}°F). `;
        }
    } catch(e) {
        console.warn("Weather fetch failed", e);
    }
    
    // Fetch News (Using GNews API requires key from local storage)
    const store = await chrome.storage.local.get(['gnewsKey']);
    if (store.gnewsKey) {
        try {
            const url = `https://gnews.io/api/v4/top-headlines?category=technology&lang=en&max=3&apikey=${store.gnewsKey}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.articles?.length > 0) {
                    briefingText += "Top tech headlines: ";
                    data.articles.forEach((a, i) => {
                        briefingText += `${i+1}. ${a.title}. `;
                    });
                }
            }
        } catch(e) {
            console.warn("News fetch failed", e);
        }
    } else {
        briefingText += "News API key not configured, skipping headlines. ";
    }
    
    // Check pending tab alerts or session memory
    const { history } = await chrome.storage.session.get(['history']) || {history:[]};
    if (history.length > 0) {
        briefingText += "You have previous session context available in memory. ";
    }
    
    return briefingText;
}

export function setupAlarms() {
    chrome.alarms.create("briefing-alarm", {
        when: Date.now() + 1000, 
        periodInMinutes: 1440 // Daily
    });
}
