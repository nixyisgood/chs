/**
 * CHAOS STUDIO - Logger Utility
 * Sistema de logs personalizado con estilo Neón.
 */

const colors = {
    info: '#00f2ff',  // Cian neón
    warn: '#ffa500',  // Naranja
    error: '#ff0055', // Magenta/Rojo neón
    debug: '#7df9ff'  // Azul eléctrico
};

class Logger {
    constructor(moduleName) {
        this.module = moduleName.toUpperCase();
    }

    info(message) {
        console.log(
            `%c[CHAOS STUDIO] %c[${this.module}] %c${message}`,
            `color: ${colors.info}; font-weight: bold;`,
            `color: #ffffff; background: #333; padding: 2px 5px; border-radius: 3px;`,
            `color: #ddd;`
        );
    }

    error(message, err = "") {
        console.error(
            `%c[CHAOS STUDIO] %c[ERROR - ${this.module}] %c${message}`,
            `color: ${colors.error}; font-weight: bold;`,
            `background: ${colors.error}; color: white; padding: 2px 5px;`,
            `color: #ff9999;`,
            err
        );
    }

    warn(message) {
        console.warn(
            `%c[CHAOS STUDIO] %c[WARN] %c${message}`,
            `color: ${colors.warn}; font-weight: bold;`,
            `color: ${colors.warn}; border: 1px solid ${colors.warn}; padding: 1px 4px;`,
            `color: #eee;`
        );
    }

    debug(message) {
        // La librería de lanzamiento usa mucho esta función. La redirigimos a un console.log normal para no saturar.
        console.log(`[DEBUG - ${this.module}] ${message}`);
    }
}

module.exports = (moduleName) => new Logger(moduleName);