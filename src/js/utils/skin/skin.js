/**
 * CAOS STUDIO - Skin Manager
 * Punto de entrada para el procesamiento de skins
 */

import { skin2D } from './skin2D.js';
import { head, body } from './table.js';

class SkinManager {
    constructor() {
        this.engine = new skin2D();
    }

    async getAvatar(username) {
        // Usamos mc-heads para obtener la skin cruda
        const skinUrl = `https://mc-heads.net/skin/${username}`;
        
        try {
            return await this.engine.createHeadTexture(skinUrl);
        } catch (error) {
            console.error("Error al procesar la skin:", error);
            return "https://mc-heads.net/avatar/steve/128";
        }
    }
}

// Lo hacemos global para que CAOS STUDIO lo reconozca
window.skinManager = new SkinManager();