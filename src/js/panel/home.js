const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    ipcRenderer.send('get-user-data');

    ipcRenderer.on('send-user-data', async (event, data) => {
        if (data) {
            const playerNameEl = document.getElementById('player-name');
            if (playerNameEl) {
                playerNameEl.innerText = data.name.toUpperCase();
            }
            const avatarImg = document.getElementById('player-avatar');
            
            // Actualizar estadísticas
            const lastSessionEl = document.getElementById('last-session-date');
            const playTimeEl = document.getElementById('total-play-time');
            if (lastSessionEl) lastSessionEl.innerText = data.lastSession || '-';
            if (playTimeEl) playTimeEl.innerText = data.playTime || '-';
            
            let skinName;

            if (data._type === 'offline') {
                // LÓGICA DE PERSISTENCIA: Miramos si ya hay una skin elegida para esta sesión
                let sessionSkin = sessionStorage.getItem('current_random_skin');

                if (!sessionSkin) {
                    // Si es la primera vez que carga, elegimos una y la guardamos
                    sessionSkin = Math.random() < 0.5 ? 'steve' : 'alex';
                    sessionStorage.setItem('current_random_skin', sessionSkin);
                }
                skinName = sessionSkin;
            } else {
                skinName = data.name;
            }

            if (avatarImg) {
                try {
                    const processedHead = await window.skinManager.getAvatar(skinName);
                    avatarImg.src = processedHead;
                } catch (error) {
                    avatarImg.src = `https://mc-heads.net/avatar/${skinName}/128`;
                }
            }
        }
    });

    // Navegación
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.onclick = () => { window.location.href = 'settings.html'; };
    }

    // --- CARGAR INSTANCIAS ---
    const instanceInput = document.getElementById('instance-code');
    const instanceDatalist = document.getElementById('instance-list-datalist');
    
    ipcRenderer.send('get-instances');
    ipcRenderer.on('send-instances', (event, instances) => {
        actualizarDatalist(instances);
    });

    ipcRenderer.on('new-instance-added', (event, newInst) => {
        // Recargar todas las instancias cuando se añade una nueva vía protocolo
        ipcRenderer.send('get-instances');
    });

    function actualizarDatalist(instances) {
        if (instances && instanceDatalist) {
            instanceDatalist.innerHTML = '';
            Object.keys(instances).forEach(code => {
                const inst = instances[code];
                const option = document.createElement('option');
                option.value = code;
                option.innerText = `${inst.name || code} (${inst.version})`;
                instanceDatalist.appendChild(option);
            });
        }
    }

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            sessionStorage.removeItem('current_random_skin'); // Limpiamos al salir
            ipcRenderer.send('logout');
        };
    }

    // --- LANZAMIENTO DE MINECRAFT ---
    const btnPlay = document.getElementById('btn-play-main');

    if (btnPlay) {
        btnPlay.onclick = () => {
            const code = instanceInput ? instanceInput.value.trim().toUpperCase() : '';
            btnPlay.disabled = true;
            btnPlay.innerText = "Preparando...";
            ipcRenderer.send('launch-minecraft', code);
        };
    }

    ipcRenderer.on('launch-progress', (event, progress) => {
        if (btnPlay) {
            btnPlay.innerText = `${progress.type}: ${Math.round((progress.task / progress.total) * 100)}%`;
        }
    });

    ipcRenderer.on('launch-finished', () => {
        if (btnPlay) {
            btnPlay.disabled = false;
            btnPlay.innerText = "Play";
        }
    });
});