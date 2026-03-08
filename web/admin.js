document.addEventListener('DOMContentLoaded', () => {
    // Simulación de datos guardados
    let instances = JSON.parse(localStorage.getItem('mc_instances')) || [
        { name: 'Survival 1.20', code: 'SURVIVAL', version: '1.20.1', loader: 'vanilla', desc: 'Servidor principal de supervivencia.' },
        { name: 'Nostalgia', code: 'ALPHA', version: '1.0', loader: 'vanilla', desc: 'Versión nostálgica.' }
    ];

    const instanceList = document.getElementById('instance-list');
    const addForm = document.getElementById('add-instance-form');

    // --- LÓGICA DE CONTROL DE VERSIÓN ---
    const verInput = document.getElementById('launcher-version');
    const urlInput = document.getElementById('launcher-url');
    const notesInput = document.getElementById('launcher-notes');

    // Cargar versión guardada
    verInput.value = localStorage.getItem('launcher_ver') || '1.0.0';
    urlInput.value = localStorage.getItem('launcher_url') || '';
    notesInput.value = localStorage.getItem('launcher_notes') || '';

    document.getElementById('save-version').onclick = () => {
        localStorage.setItem('launcher_ver', verInput.value);
        localStorage.setItem('launcher_url', urlInput.value);
        localStorage.setItem('launcher_notes', notesInput.value);
        alert('Configuración de versión guardada en el navegador.');
    };

    document.getElementById('export-update-json').onclick = () => {
        const updateData = {
            version: verInput.value,
            url: urlInput.value,
            notes: notesInput.value
        };
        const jsonStr = JSON.stringify(updateData, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            alert('¡JSON de actualización copiado!\n\nPASOS IMPORTANTES:\n1. Crea un archivo llamado "update.json" en tu PC.\n2. Pega este código dentro.\n3. Sube ese archivo a tu Netlify/Hosting.\n\nEl launcher leerá ese archivo al abrirse para saber si hay una versión nueva.');
        });
    };

    // --- LÓGICA DE INSTANCIAS ---
    function saveInstances() {
        localStorage.setItem('mc_instances', JSON.stringify(instances));
    }

    function renderInstances() {
        instanceList.innerHTML = '';
        instances.forEach((inst, index) => {
            const div = document.createElement('div');
            div.className = 'instance';
            
            // Construir URL del protocolo
            const protocolUrl = `chaos-launcher://add-instance?name=${encodeURIComponent(inst.name)}&code=${encodeURIComponent(inst.code)}&version=${encodeURIComponent(inst.version)}&loader=${encodeURIComponent(inst.loader)}&loader_version=${encodeURIComponent(inst.loader_version || '')}&mods=${encodeURIComponent(inst.mods || '')}&desc=${encodeURIComponent(inst.desc || '')}`;

            div.innerHTML = `
                <div class="info">
                    <strong>${inst.name}</strong> [${inst.code}] (v${inst.version}) 
                    <br>
                    <small>Loader: ${inst.loader} ${inst.loader_version || ''}</small>
                    <p>${inst.desc || 'Sin descripción'}</p>
                </div>
                <div class="actions">
                    <button class="edit-btn" data-index="${index}">Editar</button>
                    <a href="${protocolUrl}" class="send-btn" onclick="alert('¡Solicitud enviada al launcher! Si el launcher no se abre, asegúrate de tenerlo instalado.')">ENVIAR</a>
                    <button class="delete-btn" data-index="${index}">Eliminar</button>
                </div>
            `;
            instanceList.appendChild(div);
        });
    }

    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const editIndex = parseInt(document.getElementById('edit-index').value);
        
        const newInstance = {
            name: document.getElementById('instance-name').value,
            code: document.getElementById('instance-code').value.toUpperCase(),
            version: document.getElementById('instance-version').value,
            loader: document.getElementById('instance-loader').value,
            loader_version: document.getElementById('instance-loader-version').value || null,
            mods: document.getElementById('instance-mods').value || null,
            desc: document.getElementById('instance-desc').value
        };

        if (editIndex === -1) {
            instances.push(newInstance);
        } else {
            instances[editIndex] = newInstance;
            document.getElementById('edit-index').value = "-1";
            document.getElementById('form-title').innerText = "Crear Nueva Instancia";
            addForm.querySelector('button[type="submit"]').innerText = "AÑADIR INSTANCIA";
        }

        saveInstances();
        renderInstances();
        addForm.reset();
    });

    // Nueva función para exportar a JSON
    document.getElementById('export-json').addEventListener('click', () => {
        const exportData = {};
        instances.forEach(inst => {
            exportData[inst.code] = {
                name: inst.name,
                version: inst.version,
                loader: inst.loader,
                loader_version: inst.loader_version,
                mods: inst.mods,
                desc: inst.desc
            };
        });
        const jsonStr = JSON.stringify(exportData, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            alert('¡JSON copiado al portapapeles! Pégalo en tu archivo instances.json de la web.');
        });
    });

    instanceList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const index = e.target.getAttribute('data-index');
            instances.splice(index, 1);
            saveInstances();
            renderInstances();
        } else if (e.target.classList.contains('edit-btn')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            const inst = instances[index];
            
            // Cargar datos en el formulario
            document.getElementById('instance-name').value = inst.name;
            document.getElementById('instance-code').value = inst.code;
            document.getElementById('instance-version').value = inst.version;
            document.getElementById('instance-loader').value = inst.loader;
            document.getElementById('instance-loader-version').value = inst.loader_version || '';
            document.getElementById('instance-mods').value = inst.mods || '';
            document.getElementById('instance-desc').value = inst.desc || '';
            
            // Cambiar modo a edición
            document.getElementById('edit-index').value = index;
            document.getElementById('form-title').innerText = "Editar Instancia: " + inst.name;
            addForm.querySelector('button[type="submit"]').innerText = "GUARDAR CAMBIOS";
            
            // Hacer scroll hacia arriba para ver el formulario
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        window.location.href = 'login.html';
    });

    renderInstances();
});