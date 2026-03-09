const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    // 0. CARGAR VERSIÓN DEL CLIENTE
    const versionBadge = document.getElementById('client-version');
    if (versionBadge) {
        const packageJson = require('../../package.json');
        versionBadge.innerText = packageJson.version;
    }

    // 1. CARGAR DATOS DE USUARIO (MISMA LÓGICA QUE HOME)
    ipcRenderer.send('get-user-data');

    ipcRenderer.on('send-user-data', async (event, data) => {
        if (data) {
            document.getElementById('player-name').innerText = data.name.toUpperCase();
            const avatarImg = document.getElementById('player-avatar');
            
            let skinName;
            if (data._type === 'offline') {
                // Usamos la skin que ya se eligió en el Home
                skinName = sessionStorage.getItem('current_random_skin') || 'steve';
            } else {
                skinName = data.name;
            }

            if (avatarImg) {
                try {
                    // Intenta usar el procesado local del launcher
                    const processedHead = await window.skinManager.getAvatar(skinName);
                    avatarImg.src = processedHead;
                } catch (error) {
                    // Si falla, usa la API externa
                    avatarImg.src = `https://mc-heads.net/avatar/${skinName}/128`;
                }
            }
        }
        // 4. LÓGICA DE AJUSTES (RAM Y RESOLUCIÓN)
    const ramSlider = document.getElementById('ram-slider');
    const ramCount = document.getElementById('ram-count');
    const resSelect = document.getElementById('res-select');
    const btnSave = document.getElementById('btn-save-settings');
    const btnOpenFolder = document.getElementById('btn-open-folder');

    // Abrir carpeta de Minecraft
    if (btnOpenFolder) {
        btnOpenFolder.onclick = () => {
            ipcRenderer.send('open-minecraft-folder');
        };
    }

    // Botón de Humor para prueba de actualización
    const btnPrueba = document.getElementById('btn-prueba-humor');
    if (btnPrueba) {
        btnPrueba.onclick = () => {
            alert("¡Felicidades! Si puedes leer esto es porque la actualización 1.2.0 se ha instalado correctamente. :)");
        };
    }

    // Cargar ajustes guardados al iniciar
    ipcRenderer.send('get-settings');
    ipcRenderer.on('send-settings', (event, settings) => {
        if (settings) {
            if (settings.ram) {
                ramSlider.value = settings.ram;
                ramCount.innerText = settings.ram;
            }
            if (settings.res) {
                resSelect.value = settings.res;
            }
        }
    });

    // Actualizar texto de RAM en tiempo real
    if (ramSlider) {
        ramSlider.oninput = () => {
            ramCount.innerText = ramSlider.value;
        };
    }

    // Guardar ajustes
    if (btnSave) {
        btnSave.onclick = () => {
            const settings = {
                ram: ramSlider.value,
                res: resSelect.value
            };
            ipcRenderer.send('save-settings', settings);
            
            // Efecto visual de guardado
            const originalText = btnSave.innerText;
            btnSave.innerText = "¡GUARDADO!";
            btnSave.style.background = "#ffffff";
            btnSave.style.color = "#000";
            setTimeout(() => {
                btnSave.innerText = originalText;
                btnSave.style.background = "#ff4d4d";
                btnSave.style.color = "#fff";
            }, 2000);
        };
    }
});

    // 2. NAVEGACIÓN Y PESTAÑAS
    const btnHomeMenu = document.getElementById('btn-home');
    const btnInfo = document.getElementById('btn-info');
    const settingsContent = document.getElementById('settings-content');
    const infoContent = document.getElementById('info-content');
    const panelTitle = document.getElementById('panel-title');
    const btnSave = document.getElementById('btn-save-settings');

    if (btnHomeMenu) {
        btnHomeMenu.onclick = () => {
            // Si ya estamos en la pestaña de ajustes, volver al Home principal
            if (settingsContent.style.display === 'none') {
                settingsContent.style.display = 'grid';
                infoContent.style.display = 'none';
                panelTitle.innerText = 'AJUSTES DE JUEGO';
                btnSave.style.display = 'block';
                btnHomeMenu.classList.add('active');
                btnInfo.classList.remove('active');
            } else {
                window.location.href = 'home.html';
            }
        };
    }

    if (btnInfo) {
        btnInfo.onclick = () => {
            settingsContent.style.display = 'none';
            infoContent.style.display = 'grid';
            panelTitle.innerText = 'INFORMACIÓN';
            btnSave.style.display = 'none';
            btnInfo.classList.add('active');
            btnHomeMenu.classList.remove('active');
        };
    }

    // 3. LOGOUT (MISMA LÓGICA QUE HOME)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            sessionStorage.removeItem('current_random_skin');
            ipcRenderer.send('logout');
        };
    }
});