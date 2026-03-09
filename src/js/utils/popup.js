/**
 * MC LAUNCHER - Popup System
 * Sistema de alertas inyectables y minimalistas.
 */

class Popup {
    constructor() {
        this.container = null;
        this._initContainer();
    }

    // Crea el HTML del popup automáticamente si no existe en la página
    _initContainer() {
        if (document.getElementById('mc-popup-container')) {
            this.container = document.getElementById('mc-popup-container');
            return;
        }

        const html = `
            <div id="mc-popup-bg" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center; backdrop-filter: blur(5px);">
                <div id="mc-popup-box" style="background:#1a1a1a; border: 2px solid #333; padding:30px; border-radius:10px; width:400px; text-align:center; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                    <h2 id="mc-popup-title" style="margin:0 0 15px 0; color:#00f2ff; font-family: 'Segoe UI', sans-serif;"></h2>
                    <p id="mc-popup-msg" style="color:#ccc; margin-bottom:25px; line-height:1.5;"></p>
                    <button id="mc-popup-btn" style="background:#00f2ff; border:none; padding:10px 30px; border-radius:5px; color:#000; font-weight:bold; cursor:pointer; transition:0.3s;">ACEPTAR</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        this.container = document.getElementById('mc-popup-bg');
    }

    /**
     * @param {string} title - Título de la alerta
     * @param {string} message - Mensaje detallado
     * @param {string} type - 'error', 'info', 'success'
     */
    show(title, message, type = 'info') {
        const titleEl = document.getElementById('mc-popup-title');
        const msgEl = document.getElementById('mc-popup-msg');
        const btnEl = document.getElementById('mc-popup-btn');
        const boxEl = document.getElementById('mc-popup-box');

        // Cambiar color según el tipo
        const color = type === 'error' ? '#ff0055' : (type === 'success' ? '#00ff88' : '#00f2ff');
        titleEl.style.color = color;
        boxEl.style.borderColor = color;
        btnEl.style.background = color;

        titleEl.innerText = title;
        msgEl.innerText = message;

        this.container.style.display = 'flex';

        btnEl.onclick = () => this.close();
    }

    close() {
        this.container.style.display = 'none';
    }
}

module.exports = new Popup();