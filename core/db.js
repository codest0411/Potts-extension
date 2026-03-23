// core/db.js
// IndexedDB Wrapper for POTTS Persistent Memory & Reminders

const DB_NAME = 'PottsBrainDB';
const DB_VERSION = 1;

export const PottsDB = {
    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('vault')) {
                    db.createObjectStore('vault', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('reminders')) {
                    db.createObjectStore('reminders', { keyPath: 'id', autoIncrement: true });
                }
            };
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async addVaultEntry(contextUrl, memoryText) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('vault', 'readwrite');
            const store = tx.objectStore('vault');
            store.add({ date: new Date().toISOString(), context: contextUrl, text: memoryText });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },

    async getAllVaultEntries() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('vault', 'readonly');
            const store = tx.objectStore('vault');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async addReminder(task, delayInMinutes, alarmName) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('reminders', 'readwrite');
            const store = tx.objectStore('reminders');
            store.add({ 
                task: task, 
                scheduledFor: new Date(Date.now() + (delayInMinutes * 60000)).toISOString(),
                alarmName: alarmName
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },

    async getAllReminders() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('reminders', 'readonly');
            const store = tx.objectStore('reminders');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteReminder(alarmName) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('reminders', 'readwrite');
            const store = tx.objectStore('reminders');
            const request = store.getAll();
            request.onsuccess = () => {
                const item = request.result.find(r => r.alarmName === alarmName);
                if (item) {
                    store.delete(item.id);
                }
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }
};
