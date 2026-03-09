const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema de login cargado.");

    /* --- 1. LÓGICA LOGIN MICROSOFT --- */
    const btnMicrosoft = document.querySelector('.btn-microsoft');
    if (btnMicrosoft) {
        btnMicrosoft.onclick = () => {
            console.log("Enviando señal de Microsoft al Main...");
            ipcRenderer.send('login-microsoft'); 
        };
    }

    /* --- 2. LÓGICA LOGIN OFFLINE --- */
    const btnOffline = document.getElementById('btn-play');
    const userInput = document.getElementById('offline-user');

    if (btnOffline) {
        btnOffline.onclick = () => {
            const username = userInput.value.trim(); // .trim() quita espacios vacíos

            if (username.length >= 3) {
                console.log("Enviando señal Offline al Main...");
                ipcRenderer.send('login-offline', username);
            } else {
                // En lugar de alert, cambiamos el color del input para avisar
                userInput.style.border = "1px solid #ff0000";
                userInput.placeholder = "Mínimo 3 caracteres";
                
                // Quitamos el color rojo después de 2 segundos
                setTimeout(() => {
                    userInput.style.border = "1px solid #333";
                }, 2000);
                
                console.warn("Nombre de usuario demasiado corto.");
            }
        };
    }
});