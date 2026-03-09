/**
 * CAOS STUDIO - 2D Skin Engine
 * Procesa texturas de Minecraft localmente
 */

export class skin2D {
    async createHeadTexture(skinSource) {
        const image = await this._loadImage(skinSource);
        
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 8;
            const ctx = canvas.getContext('2d');

            // Capa base
            ctx.drawImage(image, 8, 8, 8, 8, 0, 0, 8, 8);
            // Capa secundaria
            ctx.drawImage(image, 40, 8, 8, 8, 0, 0, 8, 8);

            resolve(canvas.toDataURL());
        });
    }

    async _loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Evita problemas de CORS
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = url;
        });
    }
}