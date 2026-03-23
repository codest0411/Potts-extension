// core/memory.js
// Handles Session Memory and Cross-Tab Context

export const Memory = {
  async addInteraction(role, message, url = null) {
    const data = await chrome.storage.session.get(['history']);
    const history = data.history || [];
    history.push({ role, message, url, timestamp: Date.now() });
    
    // Keep last 50 interactions
    if (history.length > 50) history.shift();
    await chrome.storage.session.set({ history });
  },

  async getHistoryContext() {
    const data = await chrome.storage.session.get(['history']);
    return data.history || [];
  },
  
  async getCrossTabContext() {
    const tabs = await chrome.tabs.query({});
    return tabs.map(t => ({ title: t.title, url: t.url }));
  },
  
  async getFormatSessionContext() {
    const history = await this.getHistoryContext();
    return history.map(h => `${h.role}: ${h.message}`).join("\n");
  }
};
