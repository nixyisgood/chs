const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const msmc = require("msmc");
const { Client, Authenticator } = require('minecraft-launcher-core');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');

// --- IMPORTAR UTILS DE MC LAUNCHER ---
const db = require('./utils/database.js'); 
const logger = require('./utils/logger.js')('Main');

// --- PROTOCOLO PERSONALIZADO PARA CHAOS STUDIO ---
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('chaos-launcher', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('chaos-launcher');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    // Manejar el protocolo si el launcher ya está abierto
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (loginWindow) {
            if (loginWindow.isMinimized()) loginWindow.restore();
            loginWindow.focus();
        }

        const url = commandLine.pop();
        if (url && (url.startsWith('caos-launcher://') || url.startsWith('chaos-launcher://'))) {
            procesarProtocolo(url);
        }
    });

    // Manejar el protocolo si el launcher se abre por primera vez desde el enlace
    app.whenReady().then(() => {
        const url = process.argv.find(arg => arg.startsWith('caos-launcher://') || arg.startsWith('chaos-launcher://'));
        if (url) {
            procesarProtocolo(url);
        }
    });
}

// Función para procesar el protocolo
async function procesarProtocolo(urlStr) {
    logger.info(`Procesando URL de protocolo: ${urlStr}`);
    try {
        // Normalizar esquema
        const cleanUrl = urlStr.replace('caos-launcher://', 'chaos-launcher://');
        
        // CASO 1: Formato Base64 (JSON)
        if (!cleanUrl.includes('?') && !cleanUrl.includes('add-instance')) {
            try {
                const base64Data = cleanUrl.split('://')[1].replace(/\/$/, "");
                const jsonStr = Buffer.from(base64Data, 'base64').toString('utf8');
                const data = JSON.parse(jsonStr);
                
                const instancesToProcess = data.code ? { [data.code]: data } : data;
                for (const code in instancesToProcess) {
                    await guardarInstanciaLocal(code, instancesToProcess[code]);
                }
                
                if (data.code) {
                    dialog.showMessageBox({
                        type: 'info',
                        title: 'Chaos Studio',
                        message: `¡Instancia "${data.name}" añadida con éxito!`,
                        buttons: ['Entendido']
                    });
                }
                return;
            } catch (e) {
                logger.debug("No es formato Base64, intentando formato URL...");
            }
        }

        // CASO 2: Formato URL Query (El que usa admin.js actualmente)
        const url = new URL(cleanUrl);
        if (url.hostname === 'add-instance' || url.pathname.includes('add-instance')) {
            const params = url.searchParams;
            const code = params.get('code')?.toUpperCase();
            
            if (!code) return;

            const newInst = {
                name: params.get('name') || 'Nueva Instancia',
                code: code,
                version: params.get('version') || '1.21.1',
                loader: params.get('loader') || 'vanilla',
                loader_version: params.get('loader_version'),
                mods: params.get('mods'),
                desc: params.get('desc')
            };

            await guardarInstanciaLocal(code, newInst);

            dialog.showMessageBox({
                type: 'info',
                title: 'Chaos Studio',
                message: `¡Instancia "${newInst.name}" añadida con éxito!`,
                buttons: ['Entendido']
            });
        }
    } catch (err) {
        logger.error("Error al procesar protocolo:", err);
    }
}

// Función auxiliar para no repetir código
async function guardarInstanciaLocal(code, instData) {
    const upperCode = code.toUpperCase();
    const localInst = await db.get('local_instances', {});
    localInst[upperCode] = instData;
    await db.set('local_instances', localInst);

    // Actualizar en memoria para uso inmediato
    remoteInstances[upperCode] = instData;
    
    logger.info(`Instancia [${upperCode}] guardada localmente.`);
    
    if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.webContents.send('new-instance-added', instData);
    }
}

let splashWindow;
let loginWindow;
let currentUser = null;
const launcher = new Client();

    // URL de tu panel de administración (donde se alojará el JSON)
const INSTANCES_URL = 'https://nixyisgood.github.io/chs/web/instances.json';
const UPDATE_URL = 'https://nixyisgood.github.io/chs/web/update.json';
let remoteInstances = {};
const CURRENT_VERSION = require('../../package.json').version;

// Cargar la última versión conocida de la DB al arrancar
(async () => {
    try {
        const cached = await db.get('remote_instances_cache', {});
        if (Object.keys(cached).length > 0) {
            remoteInstances = cached;
            logger.info(`Cargadas ${Object.keys(remoteInstances).length} instancias del caché local.`);
        }
    } catch (e) {
        logger.error("Error cargando caché de instancias:", e);
    }
})();

async function checkUpdates() {
    try {
        // Forzar descarga fresca sin caché añadiendo timestamp
        const noCacheUrl = `${UPDATE_URL}?t=${Date.now()}`;
        logger.info(`Buscando actualizaciones en: ${noCacheUrl}`);
        
        const response = await fetch(noCacheUrl, {
            headers: { 'User-Agent': 'Chaos-Studio-Launcher' }
        });
        if (response.ok) {
            const updateInfo = await response.json();
            logger.info(`Datos de actualización recibidos: v${updateInfo.version}`);
            
            // Si la versión de la web es distinta a la del launcher
            if (updateInfo.version !== CURRENT_VERSION) {
                logger.info(`¡Nueva versión encontrada! Web: ${updateInfo.version} | Local: ${CURRENT_VERSION}`);
                return updateInfo;
            } else {
                logger.info(`El launcher está al día (v${CURRENT_VERSION}).`);
            }
        } else {
            logger.error(`Error al conectar con el servidor de actualizaciones. Status: ${response.status}`);
        }
    } catch (err) {
        logger.error("Fallo de red al buscar actualizaciones:", err);
    }
    return null;
}

async function updateInstances() {
    try {
        const noCacheUrl = `${INSTANCES_URL}?t=${Date.now()}`;
        logger.info(`Sincronizando instancias desde: ${noCacheUrl}`);
        const response = await fetch(noCacheUrl, {
            headers: { 'User-Agent': 'Chaos-Studio-Launcher' }
        });
        if (response.ok) {
            const data = await response.json();
            // Aseguramos que data sea un objeto y no un array (el admin genera un objeto)
            if (data && typeof data === 'object') {
                remoteInstances = data;
                logger.info(`Sincronización exitosa. ${Object.keys(remoteInstances).length} instancias cargadas.`);
                // Guardar en caché local para usar sin internet la próxima vez
                await db.set('remote_instances_cache', remoteInstances);
                // Loguear los códigos cargados para depuración
                logger.debug(`Códigos disponibles: ${Object.keys(remoteInstances).join(', ')}`);
            } else {
                logger.error("El formato de instances.json no es válido (se esperaba un objeto).");
            }
        } else {
            logger.error(`Error al cargar instancias de la web. Status: ${response.status} (${response.statusText})`);
            // Intentar cargar una versión de respaldo si existe? (opcional)
        }
    } catch (err) {
        logger.error("Fallo de red al sincronizar instancias:", err);
    }
}

/* =========================================
   1. CONFIGURACIÓN E IPC HANDLERS (VITAL)
   ========================================= */

// Este handler permite que database.js sepa dónde guardar los datos encriptados
ipcMain.handle('path-user-data', () => {
    return app.getPath('userData');
});

// Handler para cerrar la app desde el popup
ipcMain.on('main-window-close', () => {
    app.quit();
});

/* =========================================
   2. VENTANA DE CARGA (SPLASH) - ACTUALIZADO
   ========================================= */
function createSplash() {
    splashWindow = new BrowserWindow({
        width: 1000,
        height: 560,
        frame: false,
        resizable: false,
        transparent: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    splashWindow.loadFile(path.join(__dirname, '../../index.html'));

    splashWindow.webContents.on('did-finish-load', async () => {
        logger.info("Splash de MC LAUNCHER listo.");

        // 1. Comprobar actualizaciones del cliente
        splashWindow.webContents.send('status-update', "Buscando actualizaciones del sistema...");
        const update = await checkUpdates();
        
        if (update) {
            splashWindow.webContents.send('status-update', `¡Nueva versión disponible! v${update.version}`);
            
            // Forzar que el diálogo aparezca por encima del splash
            const { response } = await dialog.showMessageBox(splashWindow, {
                type: 'info',
                title: 'Actualización Disponible',
                message: `Hay una nueva versión de Chaos Studio (v${update.version}).\n\nCambios: ${update.notes}`,
                buttons: ['Actualizar Ahora', 'Más tarde'],
                defaultId: 0,
                cancelId: 1,
                noLink: true
            });

            if (response === 0) {
                // TRUE AUTO-UPDATE: Descargar e instalar directamente
                let downloadUrl = update.url;
                
                // Normalización de URL para node-fetch (manejo de espacios y caracteres especiales)
                try {
                    const urlObj = new URL(downloadUrl);
                    downloadUrl = urlObj.toString();
                } catch (e) {
                    logger.error("URL de descarga malformada:", downloadUrl);
                }

                if (downloadUrl.includes('dropbox.com')) {
                    downloadUrl = downloadUrl.replace('?dl=0', '?dl=1').replace('&dl=0', '&dl=1');
                    if (!downloadUrl.includes('dl=1')) downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + 'dl=1';
                }

                const tempPath = path.join(app.getPath('temp'), `ChaosStudio_v${update.version}_Setup.exe`);
                splashWindow.webContents.send('status-update', "Iniciando descarga de la actualización...");
                logger.info(`Descargando actualización desde: ${downloadUrl}`);
                
                try {
                    const res = await fetch(downloadUrl, {
                        headers: { 'User-Agent': 'Chaos-Studio-Launcher' }
                    });
                    if (!res.ok) throw new Error(`Fallo al descargar: ${res.status} ${res.statusText}`);
                    
                    const totalSize = parseInt(res.headers.get('content-length') || '0');
                    let downloadedSize = 0;
                    const fileStream = fs.createWriteStream(tempPath);

                    // Usamos un stream para monitorear el progreso y escribir al mismo tiempo
                    res.body.on('data', (chunk) => {
                        downloadedSize += chunk.length;
                        if (totalSize > 0) {
                            const percent = Math.round((downloadedSize / totalSize) * 100);
                            splashWindow.webContents.send('status-update', `Descargando actualización... ${percent}%`);
                        } else {
                            splashWindow.webContents.send('status-update', `Descargando actualización... ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`);
                        }
                    });

                    await new Promise((resolve, reject) => {
                        res.body.pipe(fileStream);
                        res.body.on('error', (err) => {
                            logger.error("Error en el stream de descarga:", err);
                            reject(err);
                        });
                        fileStream.on('finish', () => {
                            fileStream.close();
                            resolve();
                        });
                        fileStream.on('error', (err) => {
                            logger.error("Error al escribir el archivo temporal:", err);
                            reject(err);
                        });
                    });

                    // Pequeña espera para asegurar que el archivo se ha liberado por el SO
                    await new Promise(r => setTimeout(r, 500));

                    splashWindow.webContents.send('status-update', "Descarga completada. Instalando...");
                    logger.info(`Instalador guardado en: ${tempPath}`);
                    
                    // Ejecutar el instalador y cerrar el launcher
                    exec(`"${tempPath}"`, (err) => {
                        if (err) {
                            logger.error("Error al ejecutar el instalador:", err);
                            shell.openPath(tempPath); // Intento alternativo
                        }
                    });

                    setTimeout(() => {
                        app.quit();
                    }, 1000);

                } catch (err) {
                    logger.error("Error en el auto-update:", err);
                    dialog.showErrorBox("Error de Actualización", "No se pudo descargar la actualización automáticamente. Se abrirá el navegador para descarga manual.");
                    shell.openExternal(downloadUrl);
                    app.quit();
                }
                return;
            }
        }

        // 2. Cargar instancias de la web
        splashWindow.webContents.send('status-update', "Sincronizando instancias...");
        await updateInstances();

        // 3. Simulación de carga restante
        const statusMessages = [
            "Cargando archivos... 65%",
            "Cargando archivos... 90%",
            "Listo!"
        ];
        
        let i = 0;
        const interval = setInterval(() => {
            if (i < statusMessages.length) {
                splashWindow.webContents.send('status-update', statusMessages[i]);
                i++;
            } else {
                clearInterval(interval);
                if (!splashWindow.isDestroyed()) {
                    createLoginWindow();
                    splashWindow.close();
                }
            }
        }, 500);
        // PARTE B: Cargar datos sin bloquear la ventana
        cargarSesionGuardada();
    });
}

// Función auxiliar para que la DB no trabe el Splash
async function cargarSesionGuardada() {
    try {
        let user = await db.get('lastUser');
        if (user) {
            // Normalización agresiva de campos para compatibilidad con MCLC
            user.accessToken = user.accessToken || user.access_token || user.token;
            user.clientToken = user.clientToken || user.client_token || 'caos-launcher-client';
            user.uuid = user.uuid || user.id || (user.profile && user.profile.id);
            
            if (user._type === 'offline') {
                user.userType = 'mojang';
                user.accessToken = 'null';
                user.clientToken = 'null';
            } else {
                user.userType = user.userType || 'msa';
            }

            // Guardar la versión normalizada para evitar fallos futuros
            await db.set('lastUser', user);
            
            currentUser = user;
            logger.info(`Sesión de ${currentUser.name} recuperada y normalizada.`);
        }
    } catch (err) {
        logger.error("Error cargando DB, pero el launcher sigue...", err);
    }
}

/* =========================================
   3. VENTANA PRINCIPAL (LOGIN/HOME)
   ========================================= */
function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 1200,
        height: 750,
        minWidth: 1100,
        minHeight: 700,
        frame: true, 
        show: false, 
        backgroundColor: '#0c0c0c', 
        title: "Chaos Studio",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    // Si ya existe un usuario en la DB, vamos directo al Home
    if (currentUser) {
        logger.info(`Sesión recuperada: ${currentUser.name}`);
        loginWindow.loadFile(path.join(__dirname, '../panel/home.html'));
    } else {
        loginWindow.loadFile(path.join(__dirname, '../panel/login.html'));
    }
    
    loginWindow.once('ready-to-show', () => {
        loginWindow.show();
    });

    loginWindow.setMenu(null); 
}

/* =========================================
   4. LÓGICA DE AUTENTICACIÓN
   ========================================= */

async function finalizarLogin(profile) {
    // Normalización de campos para MCLC
    if (profile.access_token && !profile.accessToken) profile.accessToken = profile.access_token;
    if (profile.client_token && !profile.clientToken) profile.clientToken = profile.client_token;
    if (profile.id && !profile.uuid) profile.uuid = profile.id;

    currentUser = profile;
    // Guardamos al usuario de forma segura en Caos Studio Data
    await db.set('lastUser', profile);
    
    if (!loginWindow.isDestroyed()) {
        loginWindow.loadFile(path.join(__dirname, '../panel/home.html'));
        logger.info(`Usuario ${profile.name} ha entrado al sistema.`);
    }
}

// LOGIN CON MICROSOFT
ipcMain.on('login-microsoft', async (event) => {
    logger.info("Iniciando Microsoft Auth...");
    try {
        const authManager = new msmc.Auth("select_account");
        const xboxManager = await authManager.launch("electron");
        const mcAccessToken = await xboxManager.getMinecraft();

        if (mcAccessToken.validate()) {
            const profile = mcAccessToken.mclc(); // Usamos la función de compatibilidad
            // No guardamos ningún token, el perfil "vivo" se usa directamente
            finalizarLogin(profile);
        } else {
            logger.error("Error de licencia: El usuario no tiene Minecraft.");
            loginWindow.webContents.send('login-error', 'No tienes una licencia activa.');
        }
    } catch (error) {
        if (String(error).includes("User cancelled")) {
            logger.warn("El usuario canceló el login de Microsoft.");
        } else {
            logger.error("Fallo crítico en MSMC Auth", error);
        }
    }
});

// LOGIN OFFLINE
ipcMain.on('login-offline', async (event, username) => {
    logger.info(`Login Offline: ${username}`);
    // Generamos un UUID básico basado en el nombre para evitar conflictos
    const crypto = require('crypto');
    const offlineUuid = crypto.createHash('md5').update(username).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    
    const offlineProfile = { 
        name: username, 
        _type: 'offline',
        accessToken: 'null',
        uuid: offlineUuid,
        userType: 'mojang'
    };
    await finalizarLogin(offlineProfile);
});

// EVENTOS DE AJUSTES
ipcMain.on('get-settings', async (event) => {
    const settings = await db.get('launcher_settings', { ram: 4, res: '1280x720' });
    event.reply('send-settings', settings);
});

ipcMain.on('save-settings', async (event, settings) => {
    await db.set('launcher_settings', settings);
    logger.info(`Ajustes guardados: RAM ${settings.ram}GB, Res ${settings.res}`);
});

ipcMain.on('open-minecraft-folder', (event) => {
    const minecraftPath = path.join(app.getPath('userData'), 'minecraft');
    if (!fs.existsSync(minecraftPath)) {
        fs.mkdirSync(minecraftPath, { recursive: true });
    }
    shell.openPath(minecraftPath);
    logger.info("Abriendo carpeta de Minecraft: " + minecraftPath);
});

/* =========================================
   5. LANZAMIENTO DE MINECRAFT (NUEVO)
   ========================================= */

ipcMain.on('launch-minecraft', async (event, code) => {
    if (!currentUser) return;

    logger.info(`Iniciando lanzamiento. Código: ${code || 'DEFAULT (1.21.1)'}`);

    let auth = currentUser;

    // NORMALIZACIÓN DE AUTENTICACIÓN (Compatibilidad total MCLC)
    if (auth._type === 'offline') {
        auth.accessToken = 'null';
        auth.clientToken = 'null';
        auth.uuid = auth.uuid || '00000000-0000-0000-0000-000000000000';
        auth.userType = 'mojang';
    } else {
        // MSA mapping simplificado (la normalización real ocurre en el lanzamiento)
        auth.userType = 'msa';
    }

    // --- LANZAMIENTO ---
    const settings = await db.get('launcher_settings', { ram: 4, res: '1280x720' });
    const [width, height] = settings.res === 'fullscreen' ? [null, null] : settings.res.split('x').map(Number);

    // Guardar inicio de sesión para estadísticas
    const startTime = Date.now();
    const sessionDate = new Date().toLocaleDateString();
    await db.set('last_session_date', sessionDate);
    logger.info(`Sesión iniciada el ${sessionDate}. Rastreo de tiempo activado.`);

    // Determinar la versión e instancia (local o remota)
    let mcVersion = { version: '1.21.1', type: 'release' };
    let loader = { type: 'vanilla', version: null };
    let customMods = null;

    if (code) {
        const searchCode = code.toUpperCase();
        logger.info(`Buscando instancia para el código: [${searchCode}]`);
        
        // 1. Obtener instancias locales de la DB
        const localInstances = await db.get('local_instances', {});
        
        // 2. Prioridad: Buscar en remotas o locales por CÓDIGO (key del objeto)
        let inst = remoteInstances[searchCode] || localInstances[searchCode];

        // 3. Si no se encuentra por código exacto, buscar dentro del objeto por propiedad .code o .name
        if (!inst) {
            inst = Object.values(remoteInstances).find(i => (i.code && i.code.toUpperCase() === searchCode) || (i.name && i.name.toUpperCase() === searchCode)) ||
                   Object.values(localInstances).find(i => (i.code && i.code.toUpperCase() === searchCode) || (i.name && i.name.toUpperCase() === searchCode));
        }

        if (inst) {
            logger.info(`¡Instancia encontrada! Nombre: ${inst.name}, Versión: ${inst.version}`);
            mcVersion = { version: inst.version || '1.21.1', type: 'release' };
            loader = { type: (inst.loader || 'vanilla').toLowerCase(), version: inst.loader_version || null };
            if (inst.mods) customMods = inst.mods;
        } else {
            // No se encontró una instancia con ese código exacto, probar detección de versión
            logger.warn(`No se encontró instancia para [${searchCode}]. Probando detección de versión manual...`);
            let detectVersion = code;
            
            // Caso 188 -> 1.8.8
            if (/^\d{3}$/.test(code)) {
                detectVersion = `${code[0]}.${code[1]}.${code[2]}`;
            } 
            // Caso 112 -> 1.12
            else if (/^\d{2}$/.test(code)) {
                detectVersion = `1.${code}`;
            }

            // Validar si el formato final parece una versión de Minecraft
            if (/^\d+\.\d+(\.\d+)?$/.test(detectVersion)) {
                mcVersion.version = detectVersion;
                logger.info(`Iniciando versión vanilla detectada: ${detectVersion}`);
            } else {
                const { response } = await dialog.showMessageBox({
                    type: 'warning',
                    title: 'Instancia no encontrada',
                    message: `El código "${code}" no coincide con ninguna instancia configurada ni es una versión válida de Minecraft.\n\n¿Quieres intentar iniciar la versión 1.21.1 por defecto?`,
                    buttons: ['Sí, iniciar 1.21.1', 'No, cancelar']
                });

                if (response === 1) {
                    event.reply('launch-finished'); // Resetear el botón de Play
                    return;
                }
                
                logger.error(`Código ${code} no reconocido. Iniciando 1.21.1 por elección del usuario.`);
            }
        }
    } else {
        logger.info("No se proporcionó código. Iniciando versión por defecto: 1.21.1");
    }

    const minecraftPath = path.join(app.getPath('userData'), 'minecraft');
    // Si hay código de instancia, usamos una carpeta separada para no mezclar mundos/mods
    const instancePath = (code && !/^\d+\.\d+(\.\d+)?$/.test(code)) 
        ? path.join(minecraftPath, 'instances', code.toLowerCase()) 
        : minecraftPath;

    if (!fs.existsSync(instancePath)) {
        fs.mkdirSync(instancePath, { recursive: true });
    }

    // Mapeo definitivo para MCLC (Asegura que Minecraft no reciba campos vacíos)
    const mclcAuth = {
        access_token: auth.accessToken || auth.access_token || auth.token || (auth.meta && auth.meta.access_token),
        client_token: auth.client_token || 'caos-launcher-client',
        uuid: auth.uuid || auth.id || (auth.profile && auth.profile.id),
        name: auth.name || (auth.profile && auth.profile.name) || 'Jugador',
        user_properties: auth.user_properties || '{}'
    };

    if (!mclcAuth.access_token || !mclcAuth.uuid) {
        logger.error(`Error crítico: Tokens inválidos para ${mclcAuth.name}. Re-login necesario.`);
        await db.set('lastUser', null);
        event.reply('launch-progress', { type: 'Sesión expirada. Reiniciando...', task: 0, total: 1 });
        setTimeout(() => { app.relaunch(); app.exit(); }, 2000);
        return;
    }

    const opts = {
        authorization: mclcAuth,
        root: instancePath,
        version: {
            number: mcVersion.version,
            type: mcVersion.type
        },
        memory: {
            max: `${settings.ram}G`,
            min: "1G"
        },
        window: {
            width: width,
            height: height,
            fullscreen: settings.res === 'fullscreen'
        }
    };

    // --- CONFIGURACIÓN DE MOD LOADERS (FORGE / FABRIC) ---
    if (loader.type === 'forge') {
        logger.info(`Configurando Forge para ${mcVersion.version}...`);
        opts.forge = loader.version; 
    } else if (loader.type === 'fabric') {
        logger.info(`Configurando Fabric para ${mcVersion.version}...`);
        const fabricVersion = loader.version || '0.17.3'; // Actualizado para compatibilidad con 1.21.1
        const fabricCustomName = `fabric-loader-${fabricVersion}-${mcVersion.version}`;
        
        // MCLC necesita que el JSON de Fabric exista localmente. 
        // Vamos a descargarlo automáticamente desde la API de Fabric Meta si no existe.
        const fabricDir = path.join(instancePath, 'versions', fabricCustomName);
        const fabricJsonPath = path.join(fabricDir, `${fabricCustomName}.json`);

        if (!fs.existsSync(fabricJsonPath)) {
            logger.info(`Descargando perfil de Fabric para MC ${mcVersion.version} (Loader ${fabricVersion})...`);
            try {
                if (!fs.existsSync(fabricDir)) fs.mkdirSync(fabricDir, { recursive: true });
                
                const fabricMetaUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion.version}/${fabricVersion}/profile/json`;
                const fabResp = await fetch(fabricMetaUrl);
                
                if (fabResp.ok) {
                    const fabJson = await fabResp.json();
                    fs.writeFileSync(fabricJsonPath, JSON.stringify(fabJson, null, 2));
                    logger.info("Perfil de Fabric generado con éxito.");
                    opts.version.custom = fabricCustomName;
                } else {
                    logger.error(`Error: Fabric no soporta la versión ${mcVersion.version}. ¿Es correcta?`);
                    event.reply('launch-progress', { type: `Error: Fabric no disponible para v${mcVersion.version}`, task: 0, total: 1 });
                    // No seteamos opts.version.custom para que MCLC no crashee intentando abrir un archivo que no existe
                }
            } catch (err) {
                logger.error("Error crítico configurando Fabric:", err);
            }
        } else {
            opts.version.custom = fabricCustomName;
        }
    }

    // Descarga de Mods con Detección de Cambios
    if (customMods) {
        try {
            const modsDir = path.join(instancePath, 'mods');
            const modSyncKey = `last_mods_url_${code.toLowerCase()}`;
            const lastModsUrl = await db.get(modSyncKey, "");

            // Solo descargamos si la URL ha cambiado o si la carpeta de mods está vacía
            const shouldDownload = (customMods !== lastModsUrl) || !fs.existsSync(modsDir) || fs.readdirSync(modsDir).length === 0;

            if (shouldDownload) {
                event.reply('launch-progress', { type: 'Descargando Mods...', task: 0, total: 1 });
                if (!fs.existsSync(modsDir)) {
                    fs.mkdirSync(modsDir, { recursive: true });
                } else {
                    // Limpieza profunda: borrar archivos de 0 KB o carpetas vacías que estorben
                    const existingItems = fs.readdirSync(modsDir);
                    for (const item of existingItems) {
                        const itemPath = path.join(modsDir, item);
                        const stats = fs.statSync(itemPath);
                        if (stats.isFile() && stats.size < 500) {
                            logger.warn(`Eliminando archivo basura/corrupto: ${item}`);
                            fs.unlinkSync(itemPath);
                        }
                    }
                }

                // Borrar también posibles archivos sueltos fuera de la carpeta /mods que se llamen "mods"
                const parentDir = path.dirname(modsDir);
                const parentItems = fs.readdirSync(parentDir);
                for (const item of parentItems) {
                    const itemPath = path.join(parentDir, item);
                    if (fs.statSync(itemPath).isFile() && item.toLowerCase().startsWith('mods')) {
                        logger.warn(`Limpiando archivo mal ubicado: ${item}`);
                        fs.unlinkSync(itemPath);
                    }
                }

                // Soportar múltiples URLs separadas por comas
                const urls = customMods.split(',').map(u => u.trim());
                logger.info(`Detectadas ${urls.length} URLs de mods para [${code}].`);

                for (let modUrl of urls) {
                    try {
                        // AUTO-CORRECCIÓN PARA DROPBOX: dl=0 -> dl=1 para descarga directa
                        if (modUrl.includes('dropbox.com') && modUrl.includes('dl=0')) {
                            modUrl = modUrl.replace('dl=0', 'dl=1');
                            logger.info(`Dropbox detectado. Convirtiendo a enlace directo: ${modUrl}`);
                        }

                        logger.info(`Descargando: ${modUrl}`);
                        const response = await fetch(modUrl, { 
                            follow: 5,
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                        });
                        
                        if (!response.ok) throw new Error(`Fallo ${response.status}`);
                        
                        const buffer = await response.buffer();
                        
                        // VALIDACIÓN DE ARCHIVO CORRUPTO O HTML
                        if (buffer.length < 500) {
                            logger.warn(`Omitiendo archivo demasiado pequeño (${buffer.length} bytes). Posible error.`);
                            continue;
                        }

                        // Verificar si es una página HTML (empieza por <!DOCTYPE o <html)
                        const startString = buffer.slice(0, 100).toString().toLowerCase();
                        if (startString.includes('<!doctype') || startString.includes('<html')) {
                            logger.error(`¡ERROR! El enlace no es una descarga directa, es una página web: ${modUrl}`);
                            continue;
                        }

                        // EXTRAER NOMBRE REAL USANDO CABECERAS SI ES POSIBLE
                        let fileName = "";
                        const contentDisp = response.headers.get('content-disposition');
                        if (contentDisp && contentDisp.includes('filename=')) {
                            const match = contentDisp.match(/filename=(?:["']?)(.*?)(?:["']?)(?:;|$)/);
                            fileName = match ? match[1] : "";
                        }
                        
                        if (!fileName) {
                            fileName = modUrl.split('/').pop().split('?')[0] || "mod_descargado.jar";
                        }

                        // DEBUG: Log de los primeros bytes para diagnosticar
                        const hexHeader = buffer.slice(0, 4).toString('hex').toUpperCase();
                        logger.info(`Analizando archivo: ${fileName}. Header (Hex): ${hexHeader}`);

                        // Verificar Magic Bytes (PK para ZIP/JAR es 504B)
                        const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;
                        const isRar = buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21;

                        if (isRar) {
                            logger.error("¡ERROR! Has subido un archivo .RAR. El launcher no puede extraer archivos .RAR automáticamente.");
                            event.reply('launch-progress', { type: 'Usa .ZIP en lugar de .RAR', task: 0, total: 1 });
                            // No hacemos continue; permitimos que se guarde el archivo para que el usuario lo vea
                        }

                        if (!isZip && !isRar) {
                            logger.warn(`El archivo no tiene cabecera ZIP ni RAR. Puede estar corrupto o ser otro formato.`);
                        }

                        // Lógica de extracción inteligente
                        let extracted = false;
                        if (isZip) {
                            try {
                                const zip = new AdmZip(buffer);
                                const zipEntries = zip.getEntries();
                                
                                // ¿Es un pack de mods (contiene otros .jar) o una carpeta con mods?
                                const hasJarsInside = zipEntries.some(e => e.entryName.toLowerCase().endsWith('.jar'));
                                const isSingleMod = zipEntries.some(e => e.entryName === 'fabric.mod.json' || e.entryName === 'mcmod.info' || e.entryName.startsWith('META-INF/'));

                                if (hasJarsInside || (!isSingleMod && (fileName.toLowerCase().endsWith('.zip') || fileName.toLowerCase().includes('mods')))) {
                                    logger.info(`Extrayendo paquete de mods ZIP: ${fileName}...`);
                                    event.reply('launch-progress', { type: `Extrayendo ${fileName}...`, task: 0.5, total: 1 });
                                    
                                    zip.extractAllTo(modsDir, true);
                                    
                                    // REVISIÓN: Sacar mods de subcarpetas si existen
                                    const extractedFiles = fs.readdirSync(modsDir);
                                    for (const f of extractedFiles) {
                                        const fullPath = path.join(modsDir, f);
                                        if (fs.statSync(fullPath).isDirectory()) {
                                            const subFiles = fs.readdirSync(fullPath);
                                            for (const subF of subFiles) {
                                                if (subF.toLowerCase().endsWith('.jar')) {
                                                    try {
                                                        fs.renameSync(path.join(fullPath, subF), path.join(modsDir, subF));
                                                    } catch (e) {}
                                                }
                                            }
                                        }
                                    }
                                    
                                    logger.info(`Extracción completada.`);
                                    event.reply('launch-progress', { type: 'Mods extraídos correctamente', task: 1, total: 1 });
                                    extracted = true;
                                }
                            } catch (zipErr) {
                                logger.error(`Error procesando el ZIP ${fileName}:`, zipErr);
                            }
                        }

                        if (!extracted) {
                            // Si es un RAR o un JAR individual, lo guardamos tal cual
                            // Si es RAR, le ponemos la extensión correcta para que el usuario lo vea
                            let finalName = fileName;
                            if (isRar && !finalName.toLowerCase().endsWith('.rar')) finalName += '.rar';
                            if (!isZip && !isRar && !finalName.toLowerCase().endsWith('.jar')) finalName += '.jar';

                            const savePath = path.join(modsDir, finalName);
                            fs.writeFileSync(savePath, buffer);
                            logger.info(`Archivo guardado (sin extraer): ${finalName}`);
                            
                            if (isRar) {
                                event.reply('launch-progress', { type: 'RAR guardado (Extraer a mano)', task: 1, total: 1 });
                            }
                        }
                    } catch (urlErr) {
                        logger.error(`Error bajando mod individual (${modUrl}):`, urlErr);
                    }
                }
                
                await db.set(modSyncKey, customMods);
                event.reply('launch-progress', { type: 'Mods Actualizados', task: 1, total: 1 });
            } else {
                logger.info("Los mods ya están actualizados en la carpeta: " + modsDir);
            }
        } catch (err) {
            logger.error("Error general en el motor de mods:", err);
        }
    }

    launcher.launch(opts);

    launcher.on('debug', (e) => logger.debug(e));
    launcher.on('data', (e) => logger.info(e));
    launcher.on('error', (e) => {
        logger.error("Error en el lanzamiento de Minecraft:", e);
        if (loginWindow && !loginWindow.isDestroyed()) {
            dialog.showErrorBox("Error de Inicio", `No se pudo iniciar Minecraft: ${e}`);
            loginWindow.webContents.send('launch-finished');
        }
    });
    launcher.on('progress', (e) => {
        event.reply('launch-progress', e);
    });
    launcher.on('close', async (code) => {
        logger.info(`Minecraft cerrado con código: ${code}`);
        
        // Calcular tiempo jugado
        const endTime = Date.now();
        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
        
        if (durationMinutes > 0) {
            const currentPlaytime = await db.get('total_playtime_minutes', 0);
            await db.set('total_playtime_minutes', currentPlaytime + durationMinutes);
            logger.info(`Sesión terminada. Jugado: ${durationMinutes} min. Total: ${currentPlaytime + durationMinutes} min.`);
        }

        if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.show();
            loginWindow.webContents.send('launch-finished');
        }
    });
});

/* =========================================
   6. EVENTOS GENERALES (NUEVO/CORREGIDO)
   ========================================= */

// Este evento es el que hace que el nombre y la foto funcionen en Settings
ipcMain.on('get-user-data', async (event) => {
    if (!currentUser) {
        currentUser = await db.get('lastUser');
    }
    const lastSession = await db.get('last_session_date', 'Hoy');
    const totalPlaytime = await db.get('total_playtime_minutes', 0);
    
    // Formatear tiempo jugado
    let playTimeStr = "0 min";
    if (totalPlaytime >= 60) {
        const hours = Math.floor(totalPlaytime / 60);
        const mins = totalPlaytime % 60;
        playTimeStr = `${hours}h ${mins}m`;
    } else {
        playTimeStr = `${totalPlaytime} min`;
    }

    const data = {
        ...currentUser,
        lastSession: lastSession,
        playTime: playTimeStr
    };
    event.reply('send-user-data', data);
});

ipcMain.on('get-instances', async (event) => {
    // Sincronizar con la web antes de enviar los datos al renderizador
    await updateInstances();
    
    const localInstances = await db.get('local_instances', {});
    // Fusionamos locales con remotas (prioridad local)
    const combined = { ...remoteInstances, ...localInstances };
    logger.debug(`Enviando ${Object.keys(combined).length} instancias al renderizador (${Object.keys(localInstances).length} locales).`);
    event.reply('send-instances', combined);
});

ipcMain.on('logout', async () => {
    currentUser = null;
    await db.set('lastUser', null); // Borramos la sesión de la DB
    logger.warn("Sesión cerrada por el usuario.");
    loginWindow.loadFile(path.join(__dirname, '../panel/login.html'));
});

/* =========================================
   6. INICIO
   ========================================= */
app.whenReady().then(createSplash);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});