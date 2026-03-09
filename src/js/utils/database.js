const Store = require('electron-store').default || require('electron-store');
const { ipcRenderer, app } = require('electron');
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.store = null;
        this.initializing = null;
    }

    async _getStore() {
        if (this.store) return this.store;
        if (this.initializing) return await this.initializing;

        this.initializing = (async () => {
            let userDataPath;
            // Detecta si estamos en una ventana o en el proceso principal
            if (process.type === 'renderer') {
                userDataPath = await ipcRenderer.invoke('path-user-data');
            } else {
                userDataPath = app.getPath('userData');
            }

            if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });

            this.store = new Store({
                name: 'mc-launcher-config',
                cwd: userDataPath
            });
            return this.store;
        })();

        return await this.initializing;
    }

    async set(key, value) {
        const s = await this._getStore();
        s.set(key, value);
    }

    async get(key, defaultValue = null) {
        const s = await this._getStore();
        return s.get(key, defaultValue);
    }
}

module.exports = new Database();