// core/trust.js
// Trust Score Engine — Computes a 0–100 trust score for any website

export async function computeTrustScore(domain) {
  let score = 50; // Base neutral score
  let reason = '';
  
  try {
    // Basic RDAP lookup
    const res = await fetch(`https://rdap.org/domain/${domain}`);
    if (res.ok) {
        const data = await res.json();
        const events = data.events || [];
        const registration = events.find(e => e.eventAction === 'registration');
        
        if (registration) {
            const ageMs = Date.now() - new Date(registration.eventDate).getTime();
            const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
            
            if (ageYears > 5) {
                score += 30;
                reason += 'Domain is well established (>5 years). ';
            } else if (ageYears > 1) {
                score += 15;
                reason += 'Domain has been active for over a year. ';
            } else {
                score -= 30; // Severe penalty for new domains (common in phishing)
                reason += 'CAUTION: Domain is very newly registered. ';
            }
        }
    } else {
        score -= 10;
        reason += 'Failed to retrieve RDAP records. ';
    }
  } catch (e) {
      console.log('RDAP failed or rate limited', e);
      reason += 'RDAP lookup failed. ';
  }
  
  // Cap between 0 and 100
  score = Math.min(100, Math.max(0, score));
  return { score, domain, explanation: reason || 'Analyzed domain metadata.' };
}
