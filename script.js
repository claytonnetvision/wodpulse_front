// script.js - Frontend WODPulse (modificado para Vercel + Render + SUPORTE A FOTO DO ALUNO)
// Use API_BASE_URL para o domínio do backend (Render)
const API_BASE_URL = 'https://wodpulse-back.onrender.com'; // seu backend no Render
let participants = [];
let activeParticipants = []; // IDs dos alunos selecionados para a aula atual
let tecnofitEnabled = false;
let connectedDevices = new Map();
let wodStartTime = 0;
let burnInterval = null;
let trimpInterval = null;
let autoClassInterval = null;
let zoneCounterInterval = null; // Novo: contador de zonas a cada 60s
let currentActiveClassName = "";
let isManualClass = false;
let autoClassMonitorActive = true; // controla se o monitor automático está ativo
// Controle de sessão e amostras HR
let currentSessionId = null;
let hrSampleInterval = null;
// Resumo da última aula para mostrar no setup
let lastSessionSummary = null;
// Histórico semanal e Campeão do dia
let weeklyHistory = { weekStart: "", participants: {} };
let dailyLeader = { date: "", name: "", queimaPoints: 0 };
let dailyCaloriesLeader = { date: "", name: "", calories: 0 };
// Tabela de pontos (como você deixou - valores por MINUTO)
const pontosPorMinuto = {
    gray: 0,
    green: 0,
    blue: 0.01,
    yellow: 0.02,
    orange: 0.03,
    red: 0.05
};
const classTimes = [
    { name: "Aula das 06:00", start: "06:00", end: "07:00" },
    { name: "Aula das 07:15", start: "07:15", end: "08:15" },
    { name: "Aula das 08:15", start: "08:15", end: "09:15" },
    { name: "Aula das 09:15", start: "09:15", end: "10:15" },
    { name: "Aula das 12:30", start: "12:30", end: "13:30" },
    { name: "Aula das 16:00", start: "16:00", end: "17:00" },
    { name: "Aula das 17:00", start: "17:00", end: "18:00" },
    { name: "Aula das 18:00", start: "18:00", end: "19:00" },
    { name: "Aula das 19:00", start: "19:00", end: "20:00" }
];
// Timer para captura de FC repouso após 60 segundos
let restingHRCaptureTimer = null;
// ── FUNÇÃO AUXILIAR PARA CONVERTER FILE → BASE64 (sem o prefixo data:...) ─────
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // só a parte base64
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
// ── INICIALIZAÇÃO ───────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
    console.log('[INIT] Página carregada - iniciando load inicial');
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        console.warn("A página não está em HTTPS. Web Bluetooth pode não funcionar.");
        alert("Atenção: Para parear dispositivos Bluetooth, acesse via HTTPS (Vercel já fornece).");
    }
    participants = await loadParticipantsFromDB();
    console.log('[INIT] Load do IndexedDB/local concluído - ' + participants.length + ' alunos (sem foto ainda)');
    loadWeeklyHistory();
    loadDailyLeader();
    loadDailyCaloriesLeader();
    renderWeeklyRankings();
    renderDailyLeader();
    renderDailyCaloriesLeader();
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('setup').classList.remove('hidden');
    currentActiveClassName = "";
    isManualClass = false;
    stopAllTimersAndLoops();
    autoClassMonitorActive = true;
    document.getElementById('startScanBtn')?.addEventListener('click', () => {
        autoClassMonitorActive = true;
        autoStartClass("Aula Manual");
    });
    document.getElementById('fullRankingBtn')?.addEventListener('click', showFullRanking);
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportRankingToPDF);
    document.getElementById('resetWeeklyBtn')?.addEventListener('click', resetWeeklyRanking);
    document.getElementById('reportsBtn')?.addEventListener('click', () => {
        window.open('relatorios-avancado.html', '_blank');
    });
    document.getElementById('reconnectDevicesBtn')?.addEventListener('click', async () => {
        await reconnectAllSavedDevices();
        alert("Reconexão manual solicitada!");
    });
    document.getElementById('authorizeReconnectBtn')?.addEventListener('click', async () => {
        await reconnectAllSavedDevices();
        alert("Autorização concluída!");
    });
    document.getElementById('backBtn')?.addEventListener('click', () => {
        if (confirm("Finalizar aula e voltar para cadastro?")) {
            autoEndClass();
        }
    });
    // ── PREVIEW DA FOTO NO CADASTRO ───────────────────────────────────────
    const photoInput = document.getElementById('photoInput');
    const photoPreview = document.getElementById('photoPreview');
    if (photoInput && photoPreview) {
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    photoPreview.src = ev.target.result;
                    photoPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                photoPreview.style.display = 'none';
                photoPreview.src = '';
            }
        });
    }
    renderLastSessionSummary();
    // FORÇA LOAD DO BACKEND NO INÍCIO PARA GARANTIR FOTO PERMANENTE
    console.log('[INIT] Forçando load do backend para carregar fotos permanentes...');
    await loadParticipantsFromBackend();
    // RENDER DA LISTA E TILES SÓ AQUI (após backend – garante foto)
    renderParticipantList();
    renderTiles();
});
function stopAllTimersAndLoops() {
    if (burnInterval) clearInterval(burnInterval);
    if (trimpInterval) clearInterval(trimpInterval);
    stopWODTimer();
    stopReconnectLoop();
    if (hrSampleInterval) {
        clearInterval(hrSampleInterval);
        hrSampleInterval = null;
    }
    if (restingHRCaptureTimer) {
        clearTimeout(restingHRCaptureTimer);
        restingHRCaptureTimer = null;
    }
    if (zoneCounterInterval) clearInterval(zoneCounterInterval); // limpa o contador de zonas
}
// Captura FC repouso após 60 segundos
function startRestingHRCapture() {
    if (restingHRCaptureTimer) clearTimeout(restingHRCaptureTimer);
    console.log('[RESTING HR] Agendando captura em 60 segundos');
    restingHRCaptureTimer = setTimeout(() => {
        console.log('[RESTING HR] === CAPTURA EXECUTANDO ===');
        let minHR = Infinity;
        let capturedCount = 0;
        let capturedDetails = [];
        activeParticipants.forEach(id => {
            const p = participants.find(part => part.id === id);
            if (p && p.connected && p.hr >= 30 && p.hr <= 120) {
                if (p.hr < minHR) minHR = p.hr;
                capturedCount++;
                capturedDetails.push({ name: p.name, hr: p.hr });
            }
        });
        if (capturedCount > 0 && minHR !== Infinity) {
            const restingValue = Math.round(minHR);
            console.log(`[RESTING HR] Captura OK: ${restingValue} bpm (${capturedCount} medições)`, capturedDetails);
            activeParticipants.forEach(id => {
                const p = participants.find(part => part.id === id);
                if (p) {
                    p.realRestingHR = restingValue;
                    p.restingHR = restingValue;
                }
            });
        } else {
            console.warn('[RESTING HR] Nenhuma HR válida 30-120 bpm após 60s');
        }
    }, 60000); // 60 segundos
}
// ── CARREGAR PARTICIPANTS DO BACKEND ────────────────────────────────────────────
async function loadParticipantsFromBackend() {
    try {
        console.log('[LOAD BACKEND] Iniciando request para /api/participants');
        const response = await fetch(`${API_BASE_URL}/api/participants`);
        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}`);
        }
        const data = await response.json();
        console.log('[LOAD BACKEND] Resposta recebida - ' + data.participants.length + ' alunos');
        participants = data.participants.map(p => {
            const hasPhoto = p.photo ? true : false;
            const photoLength = p.photo ? p.photo.length : 0;
            console.log(`[LOAD BACKEND] Aluno ${p.name} (ID ${p.id}): foto = ${hasPhoto ? 'sim (' + photoLength + ' chars)' : 'não'}`);
            return {
                id: p.id,
                name: p.name,
                age: p.age,
                weight: p.weight,
                heightCm: p.height_cm,
                gender: p.gender,
                restingHR: p.resting_hr,
                email: p.email,
                useTanaka: p.use_tanaka,
                maxHR: p.max_hr,
                historicalMaxHR: p.historical_max_hr,
                deviceId: p.device_id,
                deviceName: p.device_name,
                device: null,
                hr: 0,
                connected: false,
                lastUpdate: 0,
                lastZone: 'gray',
                queimaPoints: 0,
                trimpPoints: 0,
                lastSampleTime: null,
                calories: 0,
                minOrange: 0,
                minRed: 0,
                epocEstimated: 0,
                redStartTime: null,
                vo2ZoneActive: false,
                vo2GraceStart: null,
                vo2StartTime: null,
                vo2TimeSeconds: 0,
                vo2LastUpdate: 0,
                todayMaxHR: 0,
                maxHRReached: 0,
                externalId: null,
                minGray: 0,
                minGreen: 0,
                minBlue: 0,
                minYellow: 0,
                realRestingHR: null,
                zoneSeconds: { gray: 0, green: 0, blue: 0, yellow: 0, orange: 0, red: 0 },
                lastHR: null,
                lastZone: null,
                _hrListener: null,
                sumHR: 0,
                countHRMinutes: 0,
                photo: p.photo || null
            };
        });
        console.log('[LOAD BACKEND] Mapeamento concluído - fotos carregadas');
        // Renderiza lista e tiles aqui (garante foto ao recarregar)
        renderParticipantList();
        renderTiles();
        console.log('[LOAD BACKEND] Render da lista e tiles concluído');
    } catch (err) {
        console.error('Falha ao carregar do backend:', err);
        participants = await loadParticipantsFromDB();
        renderParticipantList();
        renderTiles();
    }
}
// ── CADASTRO MANUAL (COM UPLOAD DE FOTO) ───────────────────────────────────────
window.addNewParticipantFromSetup = async function() {
    const name = document.getElementById('nameInput')?.value.trim();
    const age = parseInt(document.getElementById('ageInput')?.value) || null;
    const weight = parseFloat(document.getElementById('weightInput')?.value) || null;
    const heightCm = parseInt(document.getElementById('heightInput')?.value) || null;
    const gender = document.getElementById('genderInput')?.value || null;
    const email = document.getElementById('emailInput')?.value.trim() || null;
    const useTanaka = document.getElementById('useTanakaInput')?.checked || false;
    // ── LEITURA DA FOTO ───────────────────────────────────────────────────────
    const photoInput = document.getElementById('photoInput');
    let photoBase64 = null;
    if (photoInput && photoInput.files && photoInput.files[0]) {
        try {
            photoBase64 = await fileToBase64(photoInput.files[0]);
            console.log('[CADASTRO] Foto convertida para base64 - tamanho: ' + photoBase64.length + ' chars');
        } catch (err) {
            alert("Erro ao processar a foto. Tente novamente.");
            return;
        }
    }
    if (!name) {
        return alert("Preencha pelo menos o nome do aluno!");
    }
    const estimatedMaxHR = useTanaka ? Math.round(208 - 0.7 * (age || 30)) : (220 - (age || 30));
    const data = {
        name,
        age,
        weight,
        height_cm: heightCm,
        gender,
        email,
        use_tanaka: useTanaka,
        max_hr: estimatedMaxHR,
        historical_max_hr: 0,
        device_id: null,
        device_name: null,
        photo: photoBase64 // envia base64 (backend salva como TEXT)
    };
    try {
        console.log('[CADASTRO] Enviando POST para /api/participants');
        const response = await fetch(`${API_BASE_URL}/api/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await response.json();
        if (!response.ok) {
            throw new Error(json.error || 'Erro ao cadastrar aluno');
        }
        const newP = json.participant;
        console.log('[CADASTRO] Resposta do backend - foto retornada: ' + (newP.photo ? 'sim (' + newP.photo.length + ' chars)' : 'não'));
        participants.push({
            id: newP.id,
            name: newP.name,
            age: data.age,
            weight: data.weight,
            heightCm: data.height_cm,
            gender: data.gender,
            email: data.email,
            useTanaka: data.use_tanaka,
            maxHR: data.max_hr,
            historicalMaxHR: data.historical_max_hr,
            deviceId: null,
            deviceName: null,
            device: null,
            hr: 0,
            connected: false,
            lastUpdate: 0,
            lastZone: 'gray',
            queimaPoints: 0,
            trimpPoints: 0,
            lastSampleTime: null,
            calories: 0,
            minOrange: 0,
            minRed: 0,
            epocEstimated: 0,
            redStartTime: null,
            vo2ZoneActive: false,
            vo2GraceStart: null,
            vo2StartTime: null,
            vo2TimeSeconds: 0,
            vo2LastUpdate: 0,
            todayMaxHR: 0,
            maxHRReached: 0,
            externalId: null,
            minGray: 0,
            minGreen: 0,
            minBlue: 0,
            minYellow: 0,
            realRestingHR: null,
            zoneSeconds: { gray: 0, green: 0, blue: 0, yellow: 0, orange: 0, red: 0 },
            lastHR: null,
            lastZone: null,
            _hrListener: null,
            sumHR: 0,
            countHRMinutes: 0,
            photo: newP.photo || null // recebe string base64 do backend
        });
        renderParticipantList();
        // Limpa o formulário
        document.getElementById('nameInput').value = '';
        document.getElementById('ageInput').value = '';
        document.getElementById('weightInput').value = '';
        document.getElementById('heightInput').value = '';
        document.getElementById('genderInput').value = '';
        document.getElementById('emailInput').value = '';
        if (document.getElementById('useTanakaInput')) {
            document.getElementById('useTanakaInput').checked = false;
        }
        if (photoInput) photoInput.value = '';
        if (document.getElementById('photoPreview')) {
            document.getElementById('photoPreview').style.display = 'none';
            document.getElementById('photoPreview').src = '';
        }
        alert(`Aluno ${name} cadastrado com sucesso!`);
        if (confirm(`Deseja parear uma pulseira agora para ${name}?`)) {
            await pairDeviceToParticipant(participants[participants.length - 1]);
        }
    } catch (err) {
        console.error('Erro ao cadastrar:', err);
        alert('Erro ao cadastrar aluno: ' + err.message);
    }
};
// ── EDITAR ALUNO COM GERENCIAMENTO DE PULSEIRA E FOTO ───────────────────────────
async function editParticipant(id) {
    const p = participants.find(part => part.id === id);
    if (!p) return alert('Aluno não encontrado');
    const action = prompt(
        "O que você quer editar?\n\n" +
        "1 - Nome, idade, peso, altura, email, etc.\n" +
        "2 - Gerenciar pulseira (remover ou trocar)\n" +
        "3 - Alterar foto do aluno\n\n" +
        "Digite 1, 2 ou 3 (ou cancele):"
    );
    if (action === null) {
        alert("Edição cancelada.");
        return;
    }
    if (action === "1") {
        const newName = prompt("Novo nome:", p.name);
        if (newName === null) return;
        const newAge = prompt("Nova idade:", p.age) || null;
        const newWeight = prompt("Novo peso (kg):", p.weight) || null;
        const newHeight = prompt("Nova altura (cm):", p.heightCm || '') || null;
        const newGender = prompt("Gênero (M/F/O):", p.gender || '') || null;
        const newEmail = prompt("Email:", p.email || '') || null;
        const newUseTanaka = confirm("Usar fórmula Tanaka?", p.useTanaka);
        const data = {
            name: newName ? newName.trim() : p.name,
            age: parseInt(newAge) || p.age,
            weight: parseFloat(newWeight) || p.weight,
            height_cm: parseInt(newHeight) || p.heightCm,
            gender: newGender || p.gender,
            email: newEmail ? newEmail.trim() : p.email,
            use_tanaka: newUseTanaka,
            max_hr: p.maxHR,
            historical_max_hr: p.historicalMaxHR
        };
        try {
            console.log('[EDIT] Enviando PUT para dados gerais do aluno ID ' + id);
            const res = await fetch(`${API_BASE_URL}/api/participants/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Erro ao editar dados');
            Object.assign(p, data);
            renderParticipantList();
            alert('Dados do aluno atualizados com sucesso!');
        } catch (err) {
            alert('Erro ao editar dados: ' + err.message);
        }
    } else if (action === "2") {
        if (p.deviceId) {
            const remove = confirm(`O aluno ${p.name} tem uma pulseira cadastrada (${p.deviceName || p.deviceId}).\nDeseja remover a pulseira atual?`);
            if (remove) {
                try {
                    await fetch(`${API_BASE_URL}/api/participants/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            device_id: null,
                            device_name: null
                        })
                    });
                    p.deviceId = null;
                    p.deviceName = null;
                    renderParticipantList();
                    alert('Pulseira removida com sucesso!');
                } catch (err) {
                    alert('Erro ao remover pulseira: ' + err.message);
                }
            }
        } else {
            const add = confirm(`O aluno ${p.name} não tem pulseira cadastrada.\nDeseja parear uma agora?`);
            if (add) {
                await pairDeviceToParticipant(p);
            }
        }
    } else if (action === "3") {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.click();
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const photoBase64 = await fileToBase64(file);
                console.log('[EDIT FOTO] Enviando PUT apenas com foto para aluno ID ' + id + ' (tamanho base64: ' + photoBase64.length + ' chars)');
                const res = await fetch(`${API_BASE_URL}/api/participants/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ photo: photoBase64 })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Erro ao salvar foto');
                }
                const json = await res.json();
                console.log('[EDIT FOTO] Resposta do backend - foto retornada: ' + (json.participant.photo ? 'sim (' + json.participant.photo.length + ' chars)' : 'não'));
                p.photo = json.participant.photo || photoBase64;
                renderParticipantList();
                if (currentActiveClassName) renderTiles();
                alert('Foto do aluno atualizada com sucesso!');
            } catch (err) {
                console.error('Erro ao atualizar foto:', err);
                alert('Erro ao atualizar foto: ' + err.message);
            }
        };
    } else {
        alert("Opção inválida. Edição cancelada.");
    }
}
// ── EXCLUIR ALUNO ──────────────────────────────────────────────────────────────
window.deleteParticipant = async function(id) {
    if (!confirm(`Tem certeza que deseja excluir o aluno com ID ${id}? Essa ação não pode ser desfeita.`)) {
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/participants/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erro ao excluir aluno');
        }
        participants = participants.filter(p => p.id !== id);
        renderParticipantList();
        alert('Aluno excluído com sucesso!');
    } catch (err) {
        console.error('Erro ao excluir aluno:', err);
        alert('Erro ao excluir aluno: ' + err.message);
    }
};
// ── ADICIONAR DURANTE AULA ──────────────────────────────────────────────────────
window.addParticipantDuringClass = async function() {
    try {
        const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
        const alreadyRegistered = participants.find(p => p.device?.id === device.id || p.deviceId === device.id);
        if (alreadyRegistered) {
            alert(`⚠️ Esta pulseira já está cadastrada para o aluno: ${alreadyRegistered.name}`);
            return;
        }
        const name = prompt("Nome do Aluno:");
        if (!name) return;
    
        let p = participants.find(x => x.name.toLowerCase() === name.toLowerCase().trim());
        if (!p) {
            const age = parseInt(prompt("Idade:", "30"));
            const weight = parseFloat(prompt("Peso (kg):", "75"));
            const heightCm = parseInt(prompt("Altura (cm):", "170")) || null;
            const gender = prompt("Gênero (M/F/O):", "M") || null;
            const email = prompt("Email (opcional):", "") || null;
            const estimatedMaxHR = 220 - age;
            const response = await fetch(`${API_BASE_URL}/api/participants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    age,
                    weight,
                    height_cm: heightCm,
                    gender,
                    email,
                    use_tanaka: false,
                    max_hr: Math.round(estimatedMaxHR),
                    historical_max_hr: 0,
                    device_id: null,
                    device_name: null
                })
            });
            if (!response.ok) throw new Error('Erro ao cadastrar aluno no backend');
            const json = await response.json();
            p = {
                id: json.participant.id,
                name: name.trim(),
                age,
                weight,
                heightCm,
                gender,
                email,
                useTanaka: false,
                maxHR: Math.round(estimatedMaxHR),
                historicalMaxHR: 0,
                todayMaxHR: 0,
                hr: 0,
                maxHRReached: 0,
                device: null,
                deviceId: null,
                deviceName: "",
                queimaPoints: 0,
                trimpPoints: 0,
                lastSampleTime: null,
                calories: 0,
                lastZone: 'gray',
                connected: false,
                externalId: null,
                minOrange: 0,
                minRed: 0,
                epocEstimated: 0,
                redStartTime: null,
                vo2ZoneActive: false,
                vo2GraceStart: null,
                vo2StartTime: null,
                vo2TimeSeconds: 0,
                vo2LastUpdate: 0,
                zoneSeconds: { gray: 0, green: 0, blue: 0, yellow: 0, orange: 0, red: 0 },
                _hrListener: null,
                sumHR: 0,
                countHRMinutes: 0,
                photo: null
            };
            participants.push(p);
        }
        p.device = device;
        p.deviceId = device.id;
        p.deviceName = device.name || "Dispositivo sem nome";
        await fetch(`${API_BASE_URL}/api/participants/${p.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                device_id: p.deviceId,
                device_name: p.deviceName
            })
        });
        await connectDevice(device, false);
        try {
            if (device.gatt && device.gatt.connected) {
                device.gatt.disconnect();
                console.log(`[ADD] Desconectado forçadamente ${p.name} para reset`);
            }
            p._hrListener = null;
            await connectDevice(device, false);
            console.log(`[ADD] Reconexão forçada concluída para ${p.name}`);
        } catch (cleanupErr) {
            console.warn(`[ADD] Erro na limpeza: ${cleanupErr.message}`);
        }
        renderTiles();
        alert(`Aluno ${p.name} adicionado e pulseira pareada!`);
    } catch (e) {
        console.log("Cancelado ou erro:", e);
        alert("Erro ao adicionar aluno durante aula.");
    }
};
// ── INICIAR AULA MANUAL ─────────────────────────────────────────────────────────
async function autoStartClass(className) {
    if (activeParticipants.length === 0) {
        alert("Selecione pelo menos 1 aluno para iniciar a aula!");
        return;
    }
    const nowStr = new Date().toTimeString().slice(0,5);
    const scheduled = classTimes.find(c => nowStr >= c.start && nowStr < c.end);
    if (className === "Aula Manual" && scheduled) {
        className = scheduled.name;
    }
    currentActiveClassName = className;
    isManualClass = className === "Aula Manual";
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('current-class-name').textContent = className;
    // Resetar contadores APENAS dos alunos selecionados
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (p) {
            p.todayMaxHR = 0;
            p.queimaPoints = 0;
            p.trimpPoints = 0;
            p.lastSampleTime = Date.now();
            p.maxHRReached = 0;
            p.minOrange = 0;
            p.minRed = 0;
            p.epocEstimated = 0;
            p.redStartTime = null;
            p.vo2ZoneActive = false;
            p.vo2GraceStart = null;
            p.vo2StartTime = null;
            p.vo2TimeSeconds = 0;
            p.vo2LastUpdate = 0;
            p.minGray = 0;
            p.minGreen = 0;
            p.minBlue = 0;
            p.minYellow = 0;
            p.realRestingHR = null;
            p.zoneSeconds = { gray: 0, green: 0, blue: 0, yellow: 0, orange: 0, red: 0 };
            p.min_zone2 = 0;
            p.min_zone3 = 0;
            p.min_zone4 = 0;
            p.min_zone5 = 0;
            p.sumHR = 0;
            p.countHRMinutes = 0;
        }
    });
    wodStartTime = Date.now();
    currentSessionId = null;
    startRestingHRCapture();
    startWODTimer(classTimes.find(c => c.name === className)?.start || null);
    if (zoneCounterInterval) clearInterval(zoneCounterInterval);
    zoneCounterInterval = setInterval(countZones, 60000);
    startReconnectLoop();
    if (hrSampleInterval) clearInterval(hrSampleInterval);
    hrSampleInterval = setInterval(async () => {
        if (!currentSessionId) return;
        let savedCount = 0;
        for (const id of activeParticipants) {
            const p = participants.find(p => p.id === id);
            if (p && p.connected && p.hr > 40 && currentSessionId) {
                await saveHRSample(p, currentSessionId);
                savedCount++;
            }
        }
    }, 120000);
    if (trimpInterval) clearInterval(trimpInterval);
    trimpInterval = setInterval(calculateTRIMPIncrement, 15000);
    renderTiles();
    updateReconnectButtonVisibility();
}
// ── CÁLCULO TRIMP COM BANISTER ──────────────────────────────────────────────────
function calculateTRIMPIncrement() {
    const now = Date.now();
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (!p || !p.connected || p.hr <= 40 || !p.maxHR || !p.lastSampleTime) return;
        const deltaMs = now - p.lastSampleTime;
        if (deltaMs < 5000) return;
        const deltaMin = deltaMs / 60000;
        const resting = Number(p.realRestingHR || p.restingHR) || 60;
        const hrr = p.maxHR - resting;
        if (hrr <= 0) return;
        let ratio = (p.hr - resting) / hrr;
        ratio = Math.max(0, Math.min(1, ratio));
        const y = p.gender === 'F' ? 1.67 : 1.92;
        const factor = 0.64 * Math.exp(y * ratio);
        const weight = Number(p.weight) || 70;
        const increment = deltaMin * ratio * factor * weight * 0.00008;
        p.trimpPoints += increment;
        p.trimpPoints = Number(p.trimpPoints.toFixed(2));
        p.lastSampleTime = now;
    });
    renderTiles();
    updateLeaderboard();
    updateVO2Leaderboard();
}
// ── CÁLCULO DO VO2 TIME ─────────────────────────────────────────────────────────
function updateVO2Time() {
    const now = Date.now();
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (!p || !p.connected || p.hr <= 40 || !p.maxHR) return;
        const percentMax = (p.hr / p.maxHR) * 100;
        const isInVO2Zone = percentMax >= 92;
        if (isInVO2Zone) {
            if (!p.vo2ZoneActive) {
                p.vo2ZoneActive = true;
                p.vo2GraceStart = now;
                p.vo2StartTime = null;
            }
            if (p.vo2GraceStart && (now - p.vo2GraceStart >= 60000)) {
                if (!p.vo2StartTime) p.vo2StartTime = now;
                const deltaSec = (now - (p.vo2LastUpdate || p.vo2StartTime)) / 1000;
                p.vo2TimeSeconds += deltaSec;
            }
        } else {
            p.vo2ZoneActive = false;
            p.vo2GraceStart = null;
            p.vo2StartTime = null;
        }
        p.vo2LastUpdate = now;
    });
}
// ── SALVAR MEDIÇÃO DE FC REPOUSO ───────────────────────────────────────────────
async function saveRestingHRSample(participantId, sessionId, hrValue) {
    if (!currentSessionId) return;
    try {
        await db.restingHrMeasurements.add({
            participantId,
            sessionId,
            measuredAt: new Date().toISOString(),
            hrValue,
            isValid: hrValue >= 30 && hrValue <= 120
        });
    } catch (err) {
        console.error('[RESTING HR] Erro ao salvar medição de repouso:', err);
    }
}
// ── CONTADOR DE ZONAS 2 A 5 (a cada 60 segundos) ────────────────────────────────
function countZones() {
    const now = Date.now();
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (!p || !p.connected || p.hr <= 40 || !p.maxHR) return;
        const percent = (p.hr / p.maxHR) * 100;
        if (percent >= 60 && percent < 70) {
            p.min_zone2 = (p.min_zone2 || 0) + 1;
        } else if (percent >= 70 && percent < 80) {
            p.min_zone3 = (p.min_zone3 || 0) + 1;
        } else if (percent >= 80 && percent < 90) {
            p.min_zone4 = (p.min_zone4 || 0) + 1;
        } else if (percent >= 90) {
            p.min_zone5 = (p.min_zone5 || 0) + 1;
        }
        if (p.hr > 40) {
            p.sumHR += p.hr;
            p.countHRMinutes += 1;
            console.log(`[ZONE COUNTER + FC MÉDIA] ${p.name} - HR: ${p.hr} bpm (acumulado: soma=${p.sumHR}, minutos=${p.countHRMinutes})`);
        }
        console.log(`[ZONE COUNTER] ${p.name} - FC: ${p.hr} (${percent.toFixed(1)}%) → zona atual incrementada`);
    });
    renderTiles(); // atualiza a interface
}
// ── FINALIZAR AULA (SALVA SEM PERGUNTAR AGORA) ────────────────────────────────
async function autoEndClass() {
    console.log(`Finalizando aula: ${currentActiveClassName || '(sem nome)'}`);
    const sessionStart = new Date(wodStartTime || Date.now());
    const sessionEnd = new Date();
    const durationMinutes = Math.round((sessionEnd - sessionStart) / 60000);
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (p) {
            if (p.countHRMinutes > 0) {
                p.avg_hr = Math.round(p.sumHR / p.countHRMinutes);
                console.log(`[FC MÉDIA FINAL] ${p.name}: ${p.avg_hr} bpm (baseado em ${p.countHRMinutes} minutos coletados)`);
            } else {
                p.avg_hr = null;
                console.log(`[FC MÉDIA FINAL] ${p.name}: sem coletas válidas`);
            }
        }
    });
    for (const id of activeParticipants) {
        const p = participants.find(p => p.id === id);
        if (p && p.id && currentSessionId) {
            const restingSamples = await db.restingHrMeasurements
                .where('[participantId+sessionId]')
                .equals([p.id, currentSessionId])
                .toArray();
            if (restingSamples.length >= 1) {
                const validHRs = restingSamples
                    .map(s => s.hrValue)
                    .filter(v => v >= 30 && v <= 120);
                if (validHRs.length >= 1) {
                    const avgResting = Math.round(validHRs.reduce((a,b)=>a+b,0) / validHRs.length);
                    p.realRestingHR = avgResting;
                }
            }
        }
    }
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (p) {
            const timeHighZone = (p.minOrange || 0) + (p.minRed || 0);
            const intensityFactor = p.maxHR ? (p.avg_hr / p.maxHR) : 0.8;
            const baseEPOC = timeHighZone * 6 * intensityFactor;
            const trimpBonus = (p.trimpPoints || 0) * 0.15;
            const vo2Bonus = (p.vo2TimeSeconds || 0) / 60 * 15;
            p.epocEstimated = Math.round(baseEPOC + trimpBonus + vo2Bonus);
        }
    });
    if (currentActiveClassName === "Aula Manual") {
        await limitManualSessionsToday();
    }
    const participantsData = participants.filter(p => activeParticipants.includes(p.id)).map(p => ({
        participantId: p.id,
        avg_hr: p.avg_hr,
        min_gray: Math.round(p.minGray || 0),
        min_green: Math.round(p.minGreen || 0),
        min_blue: Math.round(p.minBlue || 0),
        min_yellow: Math.round(p.minYellow || 0),
        min_orange: Math.round(p.minOrange || 0),
        min_red: Math.round(p.minRed || 0),
        trimp_total: Number(p.trimpPoints.toFixed(2)),
        calories_total: Math.round(p.calories || 0),
        vo2_time_seconds: Math.round(p.vo2TimeSeconds || 0),
        epoc_estimated: p.epocEstimated || 0,
        max_hr_reached: p.maxHRReached || null,
        real_resting_hr: p.realRestingHR || p.restingHR || null,
        min_zone2: Math.round(p.min_zone2 || 0),
        min_zone3: Math.round(p.min_zone3 || 0),
        min_zone4: Math.round(p.min_zone4 || 0),
        min_zone5: Math.round(p.min_zone5 || 0),
        queima_points: Number(p.queimaPoints.toFixed(2))
    }));
    const sessionData = {
        class_name: currentActiveClassName || 'Aula Manual (fallback)',
        date_start: sessionStart.toISOString(),
        date_end: sessionEnd.toISOString(),
        duration_minutes: durationMinutes,
        box_id: 1,
        participantsData
    };
    try {
        const res = await fetch(`${API_BASE_URL}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Erro ao salvar sessão: ${errText}`);
        }
        const json = await res.json();
        lastSessionSummary = {
            className: currentActiveClassName,
            dateTime: sessionEnd.toLocaleString('pt-BR'),
            leaderPoints: participantsData.reduce((a,b) => b.trimp_total > a.trimp_total ? b : a, {trimp_total:0, name:'--'}),
            leaderCalories: participantsData.reduce((a,b) => b.calories_total > a.calories_total ? b : a, {calories_total:0, name:'--'}),
            topPoints: [...participantsData].sort((a,b)=>b.trimp_total-a.trimp_total).slice(0,3),
            topCalories: [...participantsData].sort((a,b)=>b.calories_total-a.calories_total).slice(0,3)
        };
        renderLastSessionSummary();
        updateWeeklyTotals();
        updateDailyLeader();
        updateDailyCaloriesLeader();
        stopAllTimersAndLoops();
        currentSessionId = null;
        if (currentActiveClassName) {
            localStorage.removeItem(`v6Session_${currentActiveClassName}_${getTodayDate()}`);
        }
        currentActiveClassName = "";
        isManualClass = false;
        activeParticipants = [];
        document.getElementById('current-class-name').textContent = "Aula: --";
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('setup').classList.remove('hidden');
        renderTiles();
        updateReconnectButtonVisibility();
        autoClassMonitorActive = false;
        if (autoClassInterval) {
            clearInterval(autoClassInterval);
            autoClassInterval = null;
        }
        alert('Aula finalizada e salva automaticamente no banco!');
    } catch (err) {
        console.error('[SESSION] Erro ao salvar sessão:', err);
        alert('Erro ao salvar sessão: ' + err.message);
    }
}
async function limitManualSessionsToday() {
    const todayStart = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
    const manualsToday = await db.sessions
        .where('className').equals('Aula Manual')
        .filter(s => s.dateStart >= todayStart)
        .sortBy('dateStart');
    while (manualsToday.length > 3) {
        const oldest = manualsToday.shift();
        await db.sessions.delete(oldest.id);
    }
}
function renderLastSessionSummary() {
    const container = document.getElementById('last-class-summary');
    if (!container) return;
    if (!lastSessionSummary) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    let html = `
        <p><strong>${lastSessionSummary.className}</strong> – ${lastSessionSummary.dateTime}</p>
        <p><strong>Campeão em Pontos:</strong> ${lastSessionSummary.leaderPoints.name} (${lastSessionSummary.leaderPoints.points} pts)</p>
        <p><strong>Mais Calorias:</strong> ${lastSessionSummary.leaderCalories.name} (${lastSessionSummary.leaderCalories.calories} kcal)</p>
        <h3>Top 3 Pontos:</h3>
        <ul style="margin:5px 0 15px 20px; color:#ccc;">
    `;
    lastSessionSummary.topPoints.forEach((p, i) => {
        html += `<li>${i+1}º ${p.name} - ${p.queimaPoints} pts</li>`;
    });
    html += `</ul>
        <h3 style="margin-top:30px;">Top 3 Calorias:</h3>
        <ul style="margin:5px 0 15px 20px; color:#ccc;">
    `;
    lastSessionSummary.topCalories.forEach((p, i) => {
        html += `<li>${i+1}º ${p.name} - ${p.calories} kcal</li>`;
    });
    html += `</ul>
        <button onclick="window.open('relatorios-avancado.html', '_blank')" style="padding:10px 20px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:1.1rem;">Ver Relatório Avançado</button>
    `;
    document.getElementById('summary-content').innerHTML = html;
}
function renderParticipantList() {
    const container = document.getElementById('participantListContainer');
    if (!container) return;
    container.innerHTML = '<h2>Alunos Cadastrados</h2><p>Marque quem vai participar da próxima aula antes de iniciar:</p>';
    const table = document.createElement('table');
    table.id = 'participantTable';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Participar</th>
                <th>Foto</th>
                <th>Nome</th>
                <th>Idade</th>
                <th>Peso (kg)</th>
                <th>Altura (cm)</th>
                <th>Gênero</th>
                <th>Email</th>
                <th>Pulseira</th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    participants.forEach(p => {
        const tr = document.createElement('tr');
        const photoSrc = p.photo
            ? `data:image;base64,${p.photo}` // genérico – detecta png/jpeg automático
            : `https://i.pravatar.cc/100?u=${p.name.toLowerCase().replace(/\s+/g, '-')}`;
        console.log(`[RENDER LISTA] Aluno ${p.name} - foto presente: ${p.photo ? 'sim (' + p.photo.length + ' chars)' : 'não'}`);
        tr.innerHTML = `
            <td><input type="checkbox" class="participant-checkbox" data-id="${p.id}" ${activeParticipants.includes(p.id) ? 'checked' : ''}></td>
            <td><img src="${photoSrc}" alt="${p.name}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #FF5722;"></td>
            <td>${p.name}</td>
            <td>${p.age || '--'}</td>
            <td>${p.weight || '--'}</td>
            <td>${p.heightCm || '--'}</td>
            <td>${p.gender || '--'}</td>
            <td>${p.email || '--'}</td>
            <td>${p.deviceName ? `📱 ${p.deviceName}` : (p.deviceId ? `📱 ID salvo` : 'Sem pulseira')}</td>
            <td class="action-buttons">
                <button class="edit-btn" onclick="editParticipant(${p.id})">Editar</button>
                <button class="delete-btn" onclick="deleteParticipant(${p.id})">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    container.appendChild(table);
    document.querySelectorAll('.participant-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = Number(cb.dataset.id);
            if (cb.checked) {
                if (!activeParticipants.includes(id)) activeParticipants.push(id);
            } else {
                activeParticipants = activeParticipants.filter(i => i !== id);
            }
            const startBtn = document.getElementById('startScanBtn');
            if (startBtn) {
                startBtn.disabled = activeParticipants.length === 0;
                startBtn.style.opacity = activeParticipants.length === 0 ? '0.5' : '1';
                startBtn.title = activeParticipants.length === 0 ? 'Selecione pelo menos 1 aluno para iniciar' : 'Iniciar Aula / Escaneamento';
            }
        });
    });
    const startBtn = document.getElementById('startScanBtn');
    if (startBtn) {
        startBtn.disabled = activeParticipants.length === 0;
        startBtn.style.opacity = activeParticipants.length === 0 ? '0.5' : '1';
        startBtn.title = activeParticipants.length === 0 ? 'Selecione pelo menos 1 aluno para iniciar' : 'Iniciar Aula / Escaneamento';
    }
    if (participants.length === 0) {
        container.innerHTML += '<p style="color:#888;">Nenhum aluno cadastrado ainda.</p>';
    }
}
function startWODTimer(officialStartTimeStr) {
    if (officialStartTimeStr) {
        const now = new Date();
        const [hours, minutes] = officialStartTimeStr.split(':').map(Number);
        const officialStart = new Date();
        officialStart.setHours(hours, minutes, 0, 0);
        wodStartTime = officialStart.getTime();
    } else {
        wodStartTime = Date.now();
    }
    if (burnInterval) clearInterval(burnInterval);
    burnInterval = setInterval(updateQueimaCaloriesAndTimer, 1000);
}
function stopWODTimer() {
    if (burnInterval) clearInterval(burnInterval);
}
function updateQueimaCaloriesAndTimer() {
    const elapsedSeconds = Math.floor((Date.now() - wodStartTime) / 1000);
    document.getElementById('timer').textContent = formatTime(Math.max(0, elapsedSeconds));
    if (currentActiveClassName) {
        localStorage.setItem(`v6Session_${currentActiveClassName}_${getTodayDate()}`, JSON.stringify(participants));
    }
    const now = Date.now();
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (p && p.connected && p.hr > 0) {
            if (p.hr > (p.maxHRReached || 0)) p.maxHRReached = p.hr;
            if (p.hr > (p.todayMaxHR || 0)) p.todayMaxHR = p.hr;
            if (p.todayMaxHR > (p.historicalMaxHR || 0)) {
                p.historicalMaxHR = p.todayMaxHR;
            }
            const percent = Math.round((p.hr / p.maxHR) * 100);
            const zone = getZone(percent);
            if (!p.zoneSeconds) p.zoneSeconds = { gray: 0, green: 0, blue: 0, yellow: 0, orange: 0, red: 0 };
            p.zoneSeconds[zone] += 1;
            if (p.zoneSeconds[zone] >= 60) {
                let pontosThisMinute = pontosPorMinuto[zone] || 0;
                if (zone === 'red' && (p.minRed || 0) > 3) {
                    pontosThisMinute *= 0.5;
                }
                const trimpBonus = p.trimpPoints > 0 ? p.trimpPoints * 10 : 0;
                p.queimaPoints += pontosThisMinute + trimpBonus;
                p.zoneSeconds[zone] = 0;
            }
            if (zone === 'gray') p.minGray = (p.minGray || 0) + 1/60;
            if (zone === 'green') p.minGreen = (p.minGreen || 0) + 1/60;
            if (zone === 'blue') p.minBlue = (p.minBlue || 0) + 1/60;
            if (zone === 'yellow') p.minYellow = (p.minYellow || 0) + 1/60;
            if (zone === 'orange') p.minOrange = (p.minOrange || 0) + 1/60;
            if (zone === 'red') p.minRed = (p.minRed || 0) + 1/60;
            const age = p.age || 30;
            let calMin = (-55.0969 + (0.6309 * p.hr) + (0.1988 * p.weight) + (0.2017 * age)) / 4.184;
            p.calories = (p.calories || 0) + (Math.max(0, calMin) / 60);
            if (zone === 'red') {
                if (!p.redStartTime) p.redStartTime = now;
            } else {
                p.redStartTime = null;
            }
            if (p.lastHR && p.lastZone === 'red' && zone !== 'red' && (p.lastHR - p.hr > 25)) {
                p.queimaPoints += 5;
            }
            p.lastHR = p.hr;
            p.lastZone = zone;
            p.lastUpdate = now;
        }
    });
    updateVO2Time();
    renderTiles();
    updateLeaderboard();
    updateVO2Leaderboard();
    updateDailyLeader();
    updateDailyCaloriesLeader();
    renderWeeklyRankings();
}
// ── RENDER TILES (VERSÃO FINAL COM FOTO E RESPONSIVIDADE) ───────────────────────
function renderTiles() {
    const container = document.getElementById('participants');
    if (!container) return;
    const activeOnScreen = participants.filter(p =>
        activeParticipants.includes(p.id) && (p.connected || (p.hr > 0))
    );
    const sorted = activeOnScreen.sort((a, b) =>
        (b.queimaPoints || 0) - (a.queimaPoints || 0)
    );
    container.innerHTML = '';
    const now = Date.now();
    sorted.forEach((p, index) => {
        let percent = 0;
        if (p.maxHR && p.hr > 0) {
            percent = Math.min(Math.max(Math.round((p.hr / p.maxHR) * 100), 0), 100);
        }
        let zoneName = 'CINZA';
        let zoneColor = '#aaaaaa';
        if (percent >= 90) {
            zoneName = 'VERMELHA';
            zoneColor = '#FF1744';
        } else if (percent >= 80) {
            zoneName = 'LARANJA';
            zoneColor = '#FF5722';
        } else if (percent >= 70) {
            zoneName = 'AMARELA';
            zoneColor = '#FF9800';
        } else if (percent >= 60) {
            zoneName = 'VERDE';
            zoneColor = '#4CAF50';
        } else if (percent >= 50) {
            zoneName = 'AZUL';
            zoneColor = '#2196F3';
        }
        const isInactive = p.connected && p.lastUpdate && (now - p.lastUpdate > 15000);
        const isRedAlert = p.redStartTime && (now - p.redStartTime > 30000);
        const hasSignal = p.connected && p.hr > 0;
        const bpmDisplay = hasSignal ? p.hr : '--';
        const zoneDisplay = hasSignal ? `ZONA ${zoneName} (${percent}%)` : 'SEM SINAL';
        const zoneLabelColor = hasSignal ? zoneColor : '#ffeb3b';
        let avatarUrl = `https://i.pravatar.cc/300?u=${p.name.toLowerCase().replace(/\s+/g, '-')}`;
        if (p.photo) {
            avatarUrl = `data:image;base64,${p.photo}`; // genérico – detecta png/jpeg automático
        }
        console.log(`[RENDER TILES] Aluno ${p.name} - foto presente: ${p.photo ? 'sim (' + p.photo.length + ' chars)' : 'não'}`);
        const tile = document.createElement('div');
        tile.className = `tile ${index === 0 ? 'leader' : ''} ${!p.connected ? 'disconnected' : ''} ${isInactive ? 'inactive-alert' : ''} ${isRedAlert ? 'red-alert-blink' : ''}`;
        tile.innerHTML = `
            <div class="profile-header">
                <div class="avatar-container">
                    <img src="${avatarUrl}" alt="${p.name}" class="avatar">
                    <div class="rank-badge">#${index + 1}</div>
                </div>
                <div class="user-info">
                    <div class="name">${p.name.toUpperCase()}</div>
                    ${p.deviceName ? `<div class="device"><span style="color:#00BCD4; margin-right:8px;">📊</span>${p.deviceName}</div>` : ''}
                </div>
            </div>
            <div class="main-stats">
                <div class="bpm" style="color: ${hasSignal ? '#ffffff' : '#aaaaaa'};">
                    ${bpmDisplay}<span>BPM</span>
                </div>
                <div class="zone-label" style="color: ${zoneLabelColor};">${zoneDisplay}</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="grid-stats">
                <div class="stat-box">
                    <div class="stat-label">PONTOS</div>
                    <div class="stat-value" style="color: var(--orange);">
                        ${p.queimaPoints ? p.queimaPoints.toFixed(2) : '0.00'}
                    </div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">CALORIAS</div>
                    <div class="stat-value" style="color: var(--blue);">
                        ${Math.round(p.calories || 0)}
                    </div>
                </div>
            </div>
            ${p.vo2TimeSeconds > 0 ? `
                <div class="vo2-badge">
                    VO2 TIME: ${formatTime(Math.round(p.vo2TimeSeconds))}
                </div>
            ` : ''}
            <div class="epoc">
                EPOC: +<strong>${Math.round(p.epocEstimated || 0)}</strong> kcal
            </div>
            ${isInactive ? `
                <div style="text-align:center; color:#ffeb3b; margin-top:10px; font-size:0.9rem; font-weight:bold;">
                    ⚠️ SEM SINAL
                </div>
            ` : ''}
        `;
        container.appendChild(tile);
    });
    // RESPONSIVIDADE POR QUANTIDADE DE PESSOAS
    const tileCount = sorted.length;
    container.classList.remove(...Array.from(container.classList).filter(c => c.startsWith('count-')));
    if (tileCount === 1) {
        container.classList.add('count-1');
    } else if (tileCount === 2) {
        container.classList.add('count-2');
    } else if (tileCount <= 4) {
        container.classList.add('count-3-4');
    } else {
        container.classList.add('count-5plus');
    }
}
// ── RANKINGS ────────────────────────────────────────────────────────────────────
function updateLeaderboard() {
    if (!participants.length) return;
    const active = participants.filter(p => activeParticipants.includes(p.id));
    if (!active.length) return;
    const l = active.reduce((a, b) => (b.queimaPoints || 0) > (a.queimaPoints || 0) ? b : a, {queimaPoints:0});
    const el = document.getElementById('leaderboard-top');
    if (el) el.textContent = `Líder Aula: ${l.name || '--'} (${l.queimaPoints.toFixed(2)} PTS)`;
}
function updateVO2Leaderboard() {
    const active = participants.filter(p => activeParticipants.includes(p.id));
    const topVO2 = active
        .filter(p => p.vo2TimeSeconds >= 60)
        .sort((a, b) => b.vo2TimeSeconds - a.vo2TimeSeconds)
        .slice(0, 5);
    let html = '<div id="vo2-ranking-block" class="ranking-block" style="background:#1e1e1e; border-radius:14px; padding:16px; margin-top:12px; border-left:6px solid #FF1744;">';
    html += '<h3 style="margin:0 0 10px 0; color:#FF1744;">🔥 TOP 5 VO2 TIME (Aula)</h3>';
    if (topVO2.length === 0) {
        html += '<div style="color:#aaa; font-size:1.3rem;">Nenhum aluno com tempo VO2 ainda</div>';
    } else {
        topVO2.forEach((p, i) => {
            html += `<div class="position-${i+1}" style="font-size:1.45rem; margin:6px 0;">
                ${i+1}º ${p.name}: <strong>${formatTime(Math.round(p.vo2TimeSeconds))}</strong>
            </div>`;
        });
    }
    html += '</div>';
    const existing = document.getElementById('vo2-ranking-block');
    if (existing) {
        existing.outerHTML = html;
    } else {
        document.getElementById('weekly-rankings')?.insertAdjacentHTML('beforeend', html);
    }
}
function showFullRanking() {
    const modal = document.getElementById('full-ranking-modal');
    const content = document.getElementById('full-ranking-content');
    let html = '<h3>Ranking Semanal Completo - Pontos TRIMP</h3>';
    html += '<table><tr><th>Posição</th><th>Aluno</th><th>Pontos</th></tr>';
    const queimaFull = Object.entries(weeklyHistory.participants)
        .map(([n, d]) => ({n, p: d.totalQueimaPontos || 0}))
        .sort((a,b)=>b.p-a.p);
    queimaFull.forEach((item, i) => {
        html += `<tr><td>${i+1}º</td><td>${item.n}</td><td>${item.p.toFixed(2)}</td></tr>`;
    });
    html += '</table>';
    html += '<h3 style="margin-top:30px;">Ranking Semanal Completo - Calorias</h3>';
    html += '<table><tr><th>Posição</th><th>Aluno</th><th>Calorias</th></tr>';
    const caloriasFull = Object.entries(weeklyHistory.participants)
        .map(([n, d]) => ({n, c: d.totalCalorias || 0}))
        .sort((a,b)=>b.c-a.c);
    caloriasFull.forEach((item, i) => {
        html += `<tr><td>${i+1}º</td><td>${item.n}</td><td>${Math.round(item.c)} kcal</td></tr>`;
    });
    html += '</table>';
    content.innerHTML = html;
    modal.style.display = 'flex';
}
function exportRankingToPDF() {
    const element = document.getElementById('weekly-rankings');
    const opt = {
        margin: 1,
        filename: `Ranking_Semanal_${getTodayDate()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}
// ── UTILITÁRIOS ─────────────────────────────────────────────────────────────────
function getZone(p) {
    if (p < 50) return 'gray';
    if (p < 60) return 'green';
    if (p < 70) return 'blue';
    if (p < 80) return 'yellow';
    if (p < 90) return 'orange';
    return 'red';
}
function formatTime(s) {
    return Math.floor(s/60).toString().padStart(2,'0') + ":" + (s%60).toString().padStart(2,'0');
}
function loadWeeklyHistory() {
    const saved = localStorage.getItem('v6WeeklyHistory');
    if (saved) weeklyHistory = JSON.parse(saved);
    const currentWeek = getCurrentWeekStart();
    if (weeklyHistory.weekStart !== currentWeek) {
        weeklyHistory = { weekStart: currentWeek, participants: {} };
        saveWeeklyHistory();
    }
}
function saveWeeklyHistory() {
    localStorage.setItem('v6WeeklyHistory', JSON.stringify(weeklyHistory));
}
function updateWeeklyTotals() {
    loadWeeklyHistory();
    participants.forEach(p => {
        if (p.queimaPoints > 0 || p.calories > 0) {
            if (!weeklyHistory.participants[p.name]) weeklyHistory.participants[p.name] = { totalQueimaPontos: 0, totalCalorias: 0 };
            weeklyHistory.participants[p.name].totalQueimaPontos += p.queimaPoints;
            weeklyHistory.participants[p.name].totalCalorias += Math.round(p.calories);
        }
    });
    saveWeeklyHistory();
    renderWeeklyRankings();
}
function resetWeeklyRanking() {
    if (!confirm("Resetar ranking semanal? Todos os dados da semana serão perdidos!")) return;
    const currentWeek = getCurrentWeekStart();
    weeklyHistory = { weekStart: currentWeek, participants: {} };
    saveWeeklyHistory();
    renderWeeklyRankings();
    alert("Ranking semanal resetado!");
}
function loadDailyLeader() {
    const saved = localStorage.getItem('v6DailyLeader');
    if (saved) dailyLeader = JSON.parse(saved);
    const today = getTodayDate();
    if (dailyLeader.date !== today) {
        dailyLeader = { date: today, name: "", queimaPoints: 0 };
        saveDailyLeader();
    }
}
function saveDailyLeader() {
    localStorage.setItem('v6DailyLeader', JSON.stringify(dailyLeader));
}
function updateDailyLeader() {
    const active = participants.filter(p => activeParticipants.includes(p.id));
    const best = active.reduce((a, b) => (b.queimaPoints || 0) > (a.queimaPoints || 0) ? b : a, {queimaPoints:0});
    if (best.queimaPoints > dailyLeader.queimaPoints) {
        dailyLeader.name = best.name;
        dailyLeader.queimaPoints = best.queimaPoints;
        saveDailyLeader();
    }
    renderDailyLeader();
}
function renderDailyLeader() {
    const el = document.getElementById('daily-leader');
    if (el) el.textContent = dailyLeader.name ? `Campeão do Dia: ${dailyLeader.name} - ${dailyLeader.queimaPoints.toFixed(2)} PTS` : "Campeão do Dia: --";
}
function loadDailyCaloriesLeader() {
    const saved = localStorage.getItem('v6DailyCaloriesLeader');
    if (saved) dailyCaloriesLeader = JSON.parse(saved);
    const today = getTodayDate();
    if (dailyCaloriesLeader.date !== today) {
        dailyCaloriesLeader = { date: today, name: "", calories: 0 };
        saveDailyCaloriesLeader();
    }
}
function saveDailyCaloriesLeader() {
    localStorage.setItem('v6DailyCaloriesLeader', JSON.stringify(dailyCaloriesLeader));
}
function updateDailyCaloriesLeader() {
    const active = participants.filter(p => activeParticipants.includes(p.id));
    const best = active.reduce((a, b) => (b.calories || 0) > (a.calories || 0) ? b : a, {calories:0});
    if (best.calories > (dailyCaloriesLeader.calories || 0)) {
        dailyCaloriesLeader.name = best.name;
        dailyCaloriesLeader.calories = Math.round(best.calories);
        saveDailyCaloriesLeader();
    }
    renderDailyCaloriesLeader();
}
function renderDailyCaloriesLeader() {
    const el = document.getElementById('daily-calories-leader');
    if (el) el.textContent = dailyCaloriesLeader.name ? `Mais calorias hoje: ${dailyCaloriesLeader.name} (${dailyCaloriesLeader.calories} kcal)` : "Mais calorias hoje: --";
}
function renderWeeklyRankings() {
    const queimaEl = document.getElementById('queima-ranking-top5');
    const caloriasEl = document.getElementById('calorias-ranking-top5');
    const vo2El = document.getElementById('vo2-ranking-top5');
    if (!queimaEl || !caloriasEl) return;
    const queima = Object.entries(weeklyHistory.participants)
        .map(([n, d]) => ({n, p: d.totalQueimaPontos || 0}))
        .sort((a,b)=>b.p-a.p)
        .slice(0,5);
    queimaEl.innerHTML = queima.length ? queima.map((x,i)=>`<div class="position-${i+1}">${i+1}º ${x.n}: <strong>${x.p.toFixed(2)}</strong></div>`).join('') : 'Nenhum dado ainda';
    const calorias = Object.entries(weeklyHistory.participants)
        .map(([n, d]) => ({n, c: d.totalCalorias || 0}))
        .sort((a,b)=>b.c-a.c)
        .slice(0,5);
    caloriasEl.innerHTML = calorias.length ? calorias.map((x,i)=>`<div class="position-${i+1}">${i+1}º ${x.n}: <strong>${Math.round(x.c)} kcal</strong></div>`).join('') : 'Nenhum dado ainda';
    const active = participants.filter(p => activeParticipants.includes(p.id));
    const topVO2 = active
        .filter(p => p.vo2TimeSeconds >= 60)
        .sort((a, b) => b.vo2TimeSeconds - a.vo2TimeSeconds)
        .slice(0,5);
    let vo2Html = '';
    if (topVO2.length > 0) {
        vo2Html = topVO2.map((p, i) => `<div class="position-${i+1}">${i+1}º ${p.name}: <strong>${formatTime(Math.round(p.vo2TimeSeconds))}</strong></div>`).join('');
    } else {
        vo2Html = 'Nenhum dado ainda';
    }
    if (vo2El) {
        vo2El.innerHTML = vo2Html;
    }
}
function getCurrentWeekStart() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
}
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}
// Placeholders Tecnofit
async function checkTecnofitStatus() { }
async function fetchDailyWorkout() { }