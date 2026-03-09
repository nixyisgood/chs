/**
 * CAOS STUDIO - Custom Slider Utility
 * Control visual para selección de RAM y ajustes.
 */

class MCSlider {
    /**
     * @param {string} selector - El ID del contenedor del slider
     * @param {object} options - { min, max, step, initial }
     */
    constructor(selector, options = {}) {
        this.container = document.querySelector(selector);
        this.min = options.min || 1;
        this.max = options.max || 16;
        this.step = options.step || 1;
        this.value = options.initial || this.min;

        this._init();
    }

    _init() {
        // Inyectamos el estilo y estructura básica si el contenedor está vacío
        this.container.innerHTML = `
            <div class="mc-slider-track" style="position:relative; width:100%; height:8px; background:#333; border-radius:4px; cursor:pointer;">
                <div class="mc-slider-bar" style="position:absolute; height:100%; background:#00f2ff; border-radius:4px; width:0%;"></div>
                <div class="mc-slider-thumb" style="position:absolute; top:-6px; width:20px; height:20px; background:#fff; border:3px solid #00f2ff; border-radius:50%; cursor:grab; transition: transform 0.1s;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:10px; color:#aaa; font-size:12px; font-family:sans-serif;">
                <span>${this.min} GB</span>
                <span id="mc-slider-val" style="color:#00f2ff; font-weight:bold; font-size:14px;">${this.value} GB</span>
                <span>${this.max} GB</span>
            </div>
        `;

        this.track = this.container.querySelector('.mc-slider-track');
        this.bar = this.container.querySelector('.mc-slider-bar');
        this.thumb = this.container.querySelector('.mc-slider-thumb');
        this.display = this.container.querySelector('#mc-slider-val');

        this._setupEvents();
        this.setValue(this.value);
    }

    _setupEvents() {
        const move = (e) => {
            const rect = this.track.getBoundingClientRect();
            let offsetX = (e.clientX || e.touches[0].clientX) - rect.left;
            let percent = Math.min(Math.max(offsetX / rect.width, 0), 1);
            
            let rawValue = percent * (this.max - this.min) + this.min;
            let steppedValue = Math.round(rawValue / this.step) * this.step;
            
            this.setValue(steppedValue);
        };

        const stop = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', stop);
            this.thumb.style.transform = 'scale(1)';
        };

        this.thumb.onmousedown = () => {
            this.thumb.style.transform = 'scale(1.2)';
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', stop);
        };
        
        // Soporte para clics en la barra
        this.track.onclick = (e) => move(e);
    }

    setValue(val) {
        this.value = Math.min(Math.max(val, this.min), this.max);
        let percent = ((this.value - this.min) / (this.max - this.min)) * 100;
        
        this.bar.style.width = `${percent}%`;
        this.thumb.style.left = `calc(${percent}% - 10px)`;
        this.display.innerText = `${this.value} GB`;

        // Disparar evento personalizado para que el launcher lo sepa
        if (this.onchange) this.onchange(this.value);
    }
}

module.exports = MCSlider;