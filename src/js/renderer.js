const { ipcRenderer } = require('electron');

const statusDisplay = document.getElementById('status-text');
const progressBar = document.getElementById('progress-bar');

// Escuchamos el evento 'status-update' que enviamos desde app.js
ipcRenderer.on('status-update', (event, message) => {
    statusDisplay.innerText = message;
    
    // Si el mensaje contiene un porcentaje, actualizamos la barra de progreso
    if (message.includes('%')) {
        const percent = message.match(/(\d+)%/);
        if (percent) {
            progressBar.style.width = percent[1] + '%';
        }
    } else if (message === 'Listo!') {
        progressBar.style.width = '100%';
    } else if (message === 'Preparando el launcher...') {
        progressBar.style.width = '10%';
    } else if (message === 'Buscando actualizaciones...') {
        progressBar.style.width = '20%';
    }
    
    // Efecto sutil de parpadeo al cambiar de fase
    statusDisplay.style.opacity = '0.5';
    setTimeout(() => { statusDisplay.style.opacity = '1'; }, 100);
});