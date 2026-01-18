// script.js - Frontend WODPulse (modificado para Vercel + Render)
// Use API_BASE_URL para o domínio do backend (Render)

const API_BASE_URL = 'https://wodpulse-back.onrender.com';  // seu backend no Render

let participants = [];
let activeParticipants = []; // IDs dos alunos selecionados para a aula atual
let tecnofitEnabled = false;
let connectedDevices = new Map();
let wodStartTime = 0;
let burnInterval = null;
let trimpInterval = null;
let reconnectInterval = null;
let autoClassInterval = null;
let currentActiveClassName = "";
let isManualClass = false;
let autoClassMonitorActive = true;  // ← controla se o monitor automático está ativo

// Controle de sessão e amostras HR
let currentSessionId = null;
let hrSampleInterval = null;

// Resumo da última aula para mostrar no setup
let lastSessionSummary = null;

// Histórico semanal e Campeão do dia
let weeklyHistory = { weekStart: "", participants: {} };
let dailyLeader = { date: "", name: "", queimaPoints: 0 };
let dailyCaloriesLeader = { date: "", name: "", calories: 0 };

// Tabela de pontos antiga (mantida por compatibilidade)
const pontosPorMinuto = {
    gray: 0,
    green: 0,
    blue: 1,
    yellow: 3,
    orange: 7,
    red: 12
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

// ── INICIALIZAÇÃO ───────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
    // Verifica se estamos em HTTPS (importante para Web Bluetooth)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        console.warn("A página não está em HTTPS. Web Bluetooth pode não funcionar.");
        alert("Atenção: Para parear dispositivos Bluetooth, acesse via HTTPS (Vercel já fornece).");
    }

    participants = await loadParticipantsFromDB();
    
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

    autoClassMonitorActive = true;  // garante que está ativo ao carregar
    startAutoClassMonitor();

    document.getElementById('startScanBtn')?.addEventListener('click', () => {
        autoClassMonitorActive = true;  // reativa ao iniciar manual
        autoStartClass("Aula Manual");
    });

    document.getElementById('fullRankingBtn')?.addEventListener('click', showFullRanking);
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportRankingToPDF);
    document.getElementById('resetWeeklyBtn')?.addEventListener('click', resetWeeklyRanking);

    document.getElementById('reportsBtn')?.addEventListener('click', () => {
        window.open('report.html', '_blank');
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

    renderParticipantList();
    renderLastSessionSummary();
});

function stopAllTimersAndLoops() {
    if (burnInterval) clearInterval(burnInterval);
    if (trimpInterval) clearInterval(trimpInterval);
    if (reconnectInterval) clearInterval(reconnectInterval);
    stopWODTimer();
    stopReconnectLoop();
    if (hrSampleInterval) {
        clearInterval(hrSampleInterval);
        hrSampleInterval = null;
    }
}

// ── CARREGAR PARTICIPANTS DO BACKEND ────────────────────────────────────────────
async function loadParticipantsFromBackend() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/participants`);

        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[LOAD DEBUG] Dados brutos do backend:', data);  // log extra para ver o que chega

        participants = data.participants.map(p => ({
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
            minYellow: 0
        }));

        console.log(`Carregados ${participants.length} alunos do backend`);
        renderParticipantList();
    } catch (err) {
        console.error('Falha ao carregar do backend:', err);
        participants = await loadParticipantsFromDB();
        renderParticipantList();
    }
}

// ── CADASTRO MANUAL ─────────────────────────────────────────────────────────────
window.addNewParticipantFromSetup = async function() {
    const name = document.getElementById('nameInput').value.trim();
    const age = parseInt(document.getElementById('ageInput').value) || null;
    const weight = parseFloat(document.getElementById('weightInput').value) || null;
    const heightCm = parseInt(document.getElementById('heightInput').value) || null;
    const gender = document.getElementById('genderInput').value || null;
    const restingHR = parseInt(document.getElementById('restingHRInput').value) || null;
    const email = document.getElementById('emailInput').value.trim() || null;
    const useTanaka = document.getElementById('useTanakaInput').checked;

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
        resting_hr: restingHR,
        email,
        use_tanaka: useTanaka,
        max_hr: estimatedMaxHR,
        historical_max_hr: 0,
        device_id: null,
        device_name: null
    };

    try {
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
        participants.push({
            id: newP.id,
            name: newP.name,
            age: data.age,
            weight: data.weight,
            heightCm: data.height_cm,
            gender: data.gender,
            restingHR: data.resting_hr,
            email: data.email,
            useTanaka: data.use_tanaka,
            maxHR: data.max_hr,
            historicalMaxHR: data.historical_max_hr,
            deviceId: null,
            deviceName: null,
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
            minYellow: 0
        });

        renderParticipantList();

        document.getElementById('nameInput').value = '';
        document.getElementById('ageInput').value = '';
        document.getElementById('weightInput').value = '';
        document.getElementById('heightInput').value = '';
        document.getElementById('genderInput').value = '';
        document.getElementById('restingHRInput').value = '';
        document.getElementById('emailInput').value = '';
        document.getElementById('useTanakaInput').checked = false;

        alert(`Aluno ${name} cadastrado com sucesso!`);

        if (confirm(`Deseja parear uma pulseira agora para ${name}?`)) {
            await pairDeviceToParticipant(participants[participants.length - 1]);
        }

    } catch (err) {
        console.error('Erro ao cadastrar:', err);
        alert('Erro ao cadastrar aluno: ' + err.message);
    }
};

// ── PAIR DEVICE COM EMPRÉSTIMO ─────────────────────────────────────────────────
async function pairDeviceToParticipant(p) {
    try {
        const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });

        const alreadyRegistered = participants.find(existing => existing.deviceId === device.id && existing.id !== p.id);
        if (alreadyRegistered) {
            const confirmBorrow = confirm(
                `⚠️ Esta pulseira já está cadastrada para o aluno: ${alreadyRegistered.name}\n` +
                `Deseja pegar emprestado? (SIM = desvincula do ${alreadyRegistered.name} e vincula aqui)`
            );

            if (!confirmBorrow) {
                alert("Pareamento cancelado.");
                return;
            }

            // Desvincula do aluno antigo
            try {
                await fetch(`${API_BASE_URL}/api/participants/${alreadyRegistered.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        device_id: null,
                        device_name: null
                    })
                });
                console.log(`Pulseira desvinculada do aluno antigo: ${alreadyRegistered.name}`);
                alreadyRegistered.deviceId = null;
                alreadyRegistered.deviceName = null;
            } catch (err) {
                console.error("Erro ao desvincular pulseira antiga:", err);
                alert("Erro ao desvincular pulseira do aluno antigo.");
                return;
            }
        }

        p.device = device;
        p.deviceId = device.id;
        p.deviceName = device.name || "Dispositivo sem nome";

        const response = await fetch(`${API_BASE_URL}/api/participants/${p.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                device_id: p.deviceId,
                device_name: p.deviceName
            })
        });

        if (!response.ok) {
            throw new Error('Falha ao salvar pulseira');
        }

        await connectDevice(device, false);
        alert(`Pulseira pareada com sucesso para ${p.name}! (${p.deviceName})`);
        renderParticipantList();
        if (currentActiveClassName) renderTiles();

    } catch (e) {
        console.log("Scanner cancelado ou erro:", e);
        alert("Pulseira não pareada.");
    }
};

// ── EDITAR ALUNO COM GERENCIAMENTO DE PULSEIRA ──────────────────────────────────
async function editParticipant(id) {
    const p = participants.find(part => part.id === id);
    if (!p) return alert('Aluno não encontrado');

    const action = prompt(
        "O que você quer editar?\n\n" +
        "1 - Nome, idade, peso, altura, email, etc.\n" +
        "2 - Gerenciar pulseira (remover ou trocar)\n\n" +
        "Digite 1 ou 2 (ou cancele):"
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
        const newResting = prompt("FC Repouso:", p.restingHR || '') || null;
        const newEmail = prompt("Email:", p.email || '') || null;
        const newUseTanaka = confirm("Usar fórmula Tanaka?", p.useTanaka);

        const data = {
            name: newName ? newName.trim() : p.name,
            age: parseInt(newAge) || p.age,
            weight: parseFloat(newWeight) || p.weight,
            height_cm: parseInt(newHeight) || p.heightCm,
            gender: newGender || p.gender,
            resting_hr: parseInt(newResting) || p.restingHR,
            email: newEmail ? newEmail.trim() : p.email,
            use_tanaka: newUseTanaka,
            max_hr: p.maxHR,
            historical_max_hr: p.historicalMaxHR
        };

        try {
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

        // Remove do array local
        participants = participants.filter(p => p.id !== id);

        // Atualiza a lista na tela
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
            const restingHR = parseInt(prompt("FC Repouso (opcional):", "")) || null;
            const email = prompt("Email (opcional):", "") || null;
            const useTanaka = confirm("Usar fórmula Tanaka?");

            const estimatedMaxHR = useTanaka ? (208 - 0.7 * age) : (220 - age);

            // NOVO: Salva no backend como aluno real
            const response = await fetch(`${API_BASE_URL}/api/participants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    age,
                    weight,
                    height_cm: heightCm,
                    gender,
                    resting_hr: restingHR,
                    email,
                    use_tanaka: useTanaka,
                    max_hr: Math.round(estimatedMaxHR),
                    historical_max_hr: 0,
                    device_id: null,
                    device_name: null
                })
            });

            if (!response.ok) throw new Error('Erro ao cadastrar aluno no backend');

            const json = await response.json();
            p = {
                id: json.participant.id,  // ID real do banco
                name: name.trim(),
                age,
                weight,
                heightCm,
                gender,
                restingHR,
                email,
                useTanaka,
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
                vo2LastUpdate: 0
            };
            participants.push(p);  // adiciona na lista local
        }

        p.device = device;
        p.deviceId = device.id;
        p.deviceName = device.name || "Dispositivo sem nome";

        // Vincula pulseira no backend
        await fetch(`${API_BASE_URL}/api/participants/${p.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                device_id: p.deviceId,
                device_name: p.deviceName
            })
        });

        await connectDevice(device, false);
        renderTiles();
        alert(`Aluno ${p.name} adicionado e pulseira pareada!`);
    } catch (e) {
        console.log("Cancelado ou erro:", e);
        alert("Erro ao adicionar aluno durante aula.");
    }
};

// ── MONITORAMENTO AUTOMÁTICO ────────────────────────────────────────────────────
function startAutoClassMonitor() {
    if (!autoClassMonitorActive) {
        console.log("Monitor automático pausado manualmente");
        return;
    }
    console.log("Monitor de aulas automático iniciado...");
    checkCurrentClassTime();
    autoClassInterval = setInterval(checkCurrentClassTime, 30000);
}

function checkCurrentClassTime() {
    const now = new Date();
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    const activeClass = classTimes.find(c => currentTimeStr >= c.start && currentTimeStr < c.end);
    
    if (activeClass && currentActiveClassName === "") {
        console.log(`Aula detectada: ${activeClass.name}. Iniciando...`);
        autoStartClass(activeClass.name);
    } else if (!activeClass && currentActiveClassName !== "" && !isManualClass) {
        console.log("Horário de aula encerrado. Finalizando automaticamente...");
        autoEndClass();
    }
}

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
        }
    });

    wodStartTime = Date.now();
    currentSessionId = null;

    startWODTimer(classTimes.find(c => c.name === className)?.start || null);
    
    // Reconexão apenas dos alunos selecionados
    for (const id of activeParticipants) {
        const p = participants.find(p => p.id === id);
        if (p && p.deviceId && !p.connected) {
            console.log(`Forçando reconexão imediata para ${p.name} (${p.deviceName})`);
            await connectDevice({ id: p.deviceId, name: p.deviceName }, true).catch(e => {
                console.log(`Falha na reconexão imediata de ${p.name}:`, e);
            });
        }
    }

    startReconnectLoop();

    if (hrSampleInterval) clearInterval(hrSampleInterval);
    hrSampleInterval = setInterval(async () => {
        if (!currentSessionId) return;
        console.log("[HR Sample] Tentando salvar amostras...");
        let savedCount = 0;
        for (const id of activeParticipants) {
            const p = participants.find(p => p.id === id);
            if (p && p.connected && p.hr > 40 && currentSessionId) {
                await saveHRSample(p, currentSessionId);
                savedCount++;
            }
        }
        console.log(`[HR Sample] ${savedCount} amostras salvas nesta rodada.`);
    }, 120000);

    if (trimpInterval) clearInterval(trimpInterval);
    trimpInterval = setInterval(calculateTRIMPIncrement, 15000);

    renderTiles();
    updateReconnectButtonVisibility();
}

async function tryAutoReconnectSavedDevices() {
    console.log("Tentando reconexão automática...");
    let connectedCount = 0;

    for (const id of activeParticipants) {
        const p = participants.find(p => p.id === id);
        if (p && p.device && !p.connected) {
            try {
                console.log(`Reconectando ${p.name} (${p.deviceName})`);
                await connectDevice(p.device, true);
                connectedCount++;
            } catch (e) {
                console.log(`Falha na reconexão de ${p.name}:`, e);
                document.getElementById('authorizeReconnectBtn')?.classList.remove('hidden');
            }
        }
    }

    if (connectedCount > 0) {
        console.log(`Reconexão automática para ${connectedCount} dispositivos.`);
    }
}

async function reconnectAllSavedDevices() {
    console.log("Reconexão manual solicitada...");
    let connectedCount = 0;
    let failedCount = 0;

    for (const id of activeParticipants) {
        const p = participants.find(p => p.id === id);
        if (p && p.deviceId && !p.connected) {
            console.log(`Tentando reconectar ${p.name} (${p.deviceName || p.deviceId})`);
            try {
                const device = await navigator.bluetooth.requestDevice({
                    filters: [{ services: ['heart_rate'] }],
                    optionalServices: ['heart_rate']
                });

                if (device.id === p.deviceId) {
                    p.device = device;
                    await connectDevice(device, true);
                    connectedCount++;
                    console.log(`Reconectado manualmente: ${p.name}`);
                } else {
                    console.log(`Device errado selecionado`);
                    failedCount++;
                }
            } catch (e) {
                console.log(`Falha ao reconectar ${p.name}:`, e);
                failedCount++;
            }
        }
    }

    alert(`Reconexão manual concluída!\nConectados: ${connectedCount}\nFalhas: ${failedCount}`);
    if (connectedCount > 0) {
        document.getElementById('authorizeReconnectBtn')?.classList.add('hidden');
    }
}

function updateReconnectButtonVisibility() {
    const btn = document.getElementById('reconnectDevicesBtn');
    if (btn) {
        btn.classList.toggle('hidden', !currentActiveClassName);
    }
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

        const resting = Number(p.restingHR) || 60;
        const hrr = p.maxHR - resting;
        if (hrr <= 0) return;

        let ratio = (p.hr - resting) / hrr;
        ratio = Math.max(0, Math.min(1, ratio));

        const y = p.gender === 'F' ? 1.67 : 1.92;
        const factor = 0.64 * Math.exp(y * ratio);

        const weight = Number(p.weight) || 70;
        const increment = deltaMin * ratio * factor * weight * 0.00008;

        p.trimpPoints += increment;
        p.queimaPoints = Math.round(p.trimpPoints);

        // Arredonda TRIMP para 2 casas decimais (evita valores como 0.001898)
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

// ── SALVAR MEDIÇÃO DE FC REPOUSO (primeiros 3 minutos) ─────────────────────────
async function saveRestingHRSample(participantId, sessionId, hrValue) {
    if (!currentSessionId) return;

    try {
        await db.restingHrMeasurements.add({
            participantId,
            sessionId,
            measuredAt: new Date().toISOString(),
            hrValue,
            isValid: hrValue >= 30 && hrValue <= 120  // filtro simples
        });
        console.log(`[RESTING HR] Medição salva: ${hrValue} bpm (participante ${participantId}, sessão ${sessionId})`);
    } catch (err) {
        console.error('[RESTING HR] Erro ao salvar medição de repouso:', err);
    }
}

// ── FINALIZAR AULA ──────────────────────────────────────────────────────────────
async function autoEndClass() {
    console.log(`Finalizando aula: ${currentActiveClassName || '(sem nome)'}`);
    
    const sessionStart = new Date(wodStartTime || Date.now()); // fallback se wodStartTime não setado
    const sessionEnd = new Date();
    const durationMinutes = Math.round((sessionEnd - sessionStart) / 60000);

    console.log(`[DEBUG FINALIZAR] wodStartTime: ${wodStartTime}, duration: ${durationMinutes} min`);

    // Atualiza FC média apenas dos ativos
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (p) p.avg_hr = p.hr > 0 ? Math.round(p.hr) : null;
    });

    // Calcular FC de repouso dinâmica para cada aluno ativo - RELAXADO PARA ≥1 AMOSTRA VÁLIDA
    for (const id of activeParticipants) {
        const p = participants.find(p => p.id === id);
        if (p && p.id && currentSessionId) {
            const restingSamples = await db.restingHrMeasurements
                .where('[participantId+sessionId]')
                .equals([p.id, currentSessionId])
                .toArray();

            console.log(`[DEBUG FC REPOUSO] Aluno ${p.name} (ID ${p.id}): ${restingSamples.length} amostras totais na sessão ${currentSessionId}`);

            if (restingSamples.length >= 1) {
                const validHRs = restingSamples
                    .map(s => s.hrValue)
                    .filter(v => v >= 30 && v <= 120);

                console.log(`[DEBUG FC REPOUSO] Aluno ${p.name}: ${validHRs.length} amostras válidas (30-120 bpm)`);

                if (validHRs.length >= 1) {
                    const avgResting = Math.round(validHRs.reduce((a,b)=>a+b,0) / validHRs.length);
                    p.real_resting_hr = avgResting;
                    console.log(`[RESTING HR] FC repouso calculada para ${p.name}: ${avgResting} bpm (${validHRs.length} medições válidas)`);
                } else {
                    console.log(`[RESTING HR] Nenhuma amostra válida para ${p.name} (${validHRs.length})`);
                }
            } else {
                console.log(`[RESTING HR] Nenhuma amostra para ${p.name} (${restingSamples.length})`);
            }
        }
    }

    // EPOC apenas para ativos
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (p) {
            const timeHighZone = (p.minOrange || 0) + (p.minRed || 0);
            const intensityFactor = p.maxHR ? (p.avg_hr / p.maxHR) : 0.8;
            const baseEPOC = timeHighZone * 6 * intensityFactor;
            const trimpBonus = (p.trimpPoints || 0) * 0.15;
            const vo2Bonus = (p.vo2TimeSeconds || 0) / 60 * 15;

            p.epocEstimated = Math.round(baseEPOC + trimpBonus + vo2Bonus);
            console.log(`[EPOC] Estimado para ${p.name}: ${p.epocEstimated} kcal`);
        }
    });

    if (currentActiveClassName === "Aula Manual") {
        await limitManualSessionsToday();
    }

    // Log debug para verificar calorias antes de enviar
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (p) console.log(`[DEBUG CALORIAS ANTES DE ENVIAR] ${p.name}: ${p.calories || 0} kcal (calories_total será ${Math.round(p.calories || 0)})`);
    });

    const participantsData = participants.filter(p => activeParticipants.includes(p.id)).map(p => {
        console.log(`[DEBUG PARTICIPANT] ${p.name}: id=${p.id}, connected=${p.connected}, hr=${p.hr}, minRed=${p.minRed || 0}, trimp=${p.trimpPoints || 0}, real_resting_hr=${p.real_resting_hr || 'null'}`);
        return {
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
            real_resting_hr: p.real_resting_hr || null
        };
    });

    const sessionData = {
        class_name: currentActiveClassName || 'Aula Manual (fallback)',
        date_start: sessionStart.toISOString(),
        date_end: sessionEnd.toISOString(),
        duration_minutes: durationMinutes,
        box_id: 1,
        participantsData
    };

    const confirmarSalvar = confirm("Aula finalizada. Deseja salvar os dados no banco agora?\n\n(Sim = salva normalmente)\n(Não = descarta esta aula, útil para testes)");

    if (!confirmarSalvar) {
        console.log("[TEST MODE] Aula descartada pelo usuário - não enviada ao banco");
        alert("Aula descartada (não salva no banco). Útil para testes!");
        
        currentActiveClassName = "";
        isManualClass = false;
        activeParticipants = []; // limpa seleção
        document.getElementById('current-class-name').textContent = "Aula: --";
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('setup').classList.remove('hidden');
        renderTiles();
        updateReconnectButtonVisibility();

        autoClassMonitorActive = false;
        if (autoClassInterval) {
            clearInterval(autoClassInterval);
            autoClassInterval = null;
            console.log("Monitor automático pausado");
        }

        return;
    }

    console.log("[SALVAR] Usuário confirmou salvamento da aula");

    console.log('[SESSION DEBUG] Enviando sessão para o backend:');
    console.log('JSON completo:', JSON.stringify(sessionData, null, 2));
    console.log('participantsData length:', participantsData.length);
    console.log('duration_minutes enviado:', durationMinutes);

    try {
        const res = await fetch(`${API_BASE_URL}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[SESSION DEBUG] Erro na resposta do backend:', errText);
            throw new Error(`Erro ao salvar sessão: ${errText}`);
        }

        const json = await res.json();
        console.log('[SESSION] Sessão salva com ID:', json.sessionId);

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
        activeParticipants = []; // limpa seleção após finalizar
        document.getElementById('current-class-name').textContent = "Aula: --";
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('setup').classList.remove('hidden');
        renderTiles();
        updateReconnectButtonVisibility();

        autoClassMonitorActive = false;
        if (autoClassInterval) {
            clearInterval(autoClassInterval);
            autoClassInterval = null;
            console.log("Monitor automático pausado após sair da aula");
        }

        alert('Aula finalizada e salva no banco com sucesso!');
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
        console.log(`Aula manual mais antiga deletada (limite de 3/dia): ${oldest.id}`);
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
        <button onclick="window.open('report.html', '_blank')" style="padding:10px 20px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:1.1rem;">Ver Relatório Completo</button>
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
        tr.innerHTML = `
            <td><input type="checkbox" class="participant-checkbox" data-id="${p.id}" ${activeParticipants.includes(p.id) ? 'checked' : ''}></td>
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

    // Salvar seleção ao mudar checkbox
    document.querySelectorAll('.participant-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = Number(cb.dataset.id);
            if (cb.checked) {
                if (!activeParticipants.includes(id)) activeParticipants.push(id);
            } else {
                activeParticipants = activeParticipants.filter(i => i !== id);
            }
            console.log('[SELEÇÃO] Alunos ativos para aula:', activeParticipants);

            // Desabilitar botão Iniciar se nenhum aluno marcado
            const startBtn = document.getElementById('startScanBtn');
            if (startBtn) {
                startBtn.disabled = activeParticipants.length === 0;
                startBtn.style.opacity = activeParticipants.length === 0 ? '0.5' : '1';
                startBtn.title = activeParticipants.length === 0 ? 'Selecione pelo menos 1 aluno para iniciar' : 'Iniciar Aula / Escaneamento';
            }
        });
    });

    // Inicializar estado do botão ao carregar a lista
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

    // Processa apenas os alunos selecionados
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

function renderTiles() {
    const container = document.getElementById('participants');
    if (!container) return;

    // Só mostra tiles dos alunos selecionados
    const activeOnScreen = participants.filter(p => activeParticipants.includes(p.id) && (p.connected || (p.hr > 0)));
    const sorted = activeOnScreen.sort((a, b) => (b.queimaPoints || 0) - (a.queimaPoints || 0));
    
    container.innerHTML = '';
    const now = Date.now();

    sorted.forEach((p, index) => {
        let percent = 0;
        if (p.maxHR && p.hr > 0) {
            percent = Math.min(Math.max(Math.round((p.hr / p.maxHR) * 100), 0), 100);
        }

        const zoneClass = getZone(percent);
        const isInactive = p.connected && p.lastUpdate && (now - p.lastUpdate > 15000);
        const isRedAlert = p.redStartTime && (now - p.redStartTime > 30000);

        const vo2ActiveAndCounting = p.vo2ZoneActive && p.vo2TimeSeconds > 0;

        const tile = document.createElement('div');
        tile.className = `tile ${zoneClass ? 'zone-' + zoneClass : 'zone-gray'} ${!p.connected ? 'disconnected' : ''} ${index === 0 ? 'leader' : ''} ${isInactive ? 'inactive-alert' : ''} ${isRedAlert ? 'red-alert-blink' : ''}`;

        tile.innerHTML = `
            <div class="name-and-device">
                <div class="name">${p.name}</div>
                ${p.deviceName ? `<div class="device-name">📱 ${p.deviceName}</div>` : ''}
            </div>

            <div class="bpm-container" style="position: relative; display: flex; align-items: center; justify-content: center; width: 100%; min-height: 180px;">
                <div class="bpm">${p.connected && p.hr > 0 ? p.hr : '--'}<span class="bpm-label">BPM</span></div>
                
                ${vo2ActiveAndCounting ? `
                    <div class="vo2-indicator" style="position: absolute; right: -20px; top: 50%; transform: translateY(-50%); font-size: 5.8rem; font-weight: 900; color: #FF1744; white-space: nowrap; letter-spacing: -2px;">
                        VO2↑
                    </div>
                ` : ''}
            </div>

            <div class="max-bpm">Máx hoje: ${p.todayMaxHR || '--'} | Hist: ${p.historicalMaxHR || '--'}</div>
            <div class="percent">${percent}%</div>
            <div class="queima-points">${p.queimaPoints.toFixed(2)} PTS</div>
            <div class="calories">${Math.round(p.calories || 0)} kcal</div>

            ${p.vo2TimeSeconds > 0 ? `
                <div style="font-size:1.9rem; font-weight:bold; color:#FF1744; margin:10px 0; text-align:center;">
                    VO2 Time: ${formatTime(Math.round(p.vo2TimeSeconds))}
                </div>
            ` : ''}

            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}% !important;"></div>
            </div>
            ${isInactive ? '<div style="color:#ffeb3b; font-size:0.8rem; margin-top:5px;">⚠️ SEM SINAL</div>' : ''}
            <div style="font-size:1.3rem; color:#FF9800; margin-top:12px;">
                EPOC estimado: +${Math.round(p.epocEstimated || 0)} kcal pós-treino
            </div>
        `;
        container.appendChild(tile);
    });
}

function startReconnectLoop() {
    if (reconnectInterval) clearInterval(reconnectInterval);
    reconnectInterval = setInterval(() => {
        // Reconecta apenas os selecionados
        activeParticipants.forEach(id => {
            const p = participants.find(p => p.id === id);
            if (p && p.device && !p.connected) {
                console.log(`Tentando reconectar ${p.name} (${p.deviceName || 'sem nome'})`);
                connectDevice(p.device, true).catch(e => console.log("Falha reconexão:", e));
            }
        });
    }, 5000);
}

function stopReconnectLoop() {
    if (reconnectInterval) clearInterval(reconnectInterval);
}

async function connectDevice(device, isReconnect = false) {
    let p = participants.find(x => x.device?.id === device.id || x.deviceId === device.id);
    if (!p) {
        console.log("Device não encontrado no array de participants");
        return;
    }
    
    try {
        console.log(`Conectando device de ${p.name}: ${device.id}`);
        const server = await device.gatt.connect();
        device.addEventListener('gattserverdisconnected', () => {
            p.connected = false;
            p.hr = 0;
            renderTiles();
            console.log(`Device de ${p.name} desconectado`);
        });

        const service = await server.getPrimaryService('heart_rate');
        const char = await service.getCharacteristic('heart_rate_measurement');
        await char.startNotifications();

        char.addEventListener('characteristicvaluechanged', (e) => {
            const val = e.target.value;
            const flags = val.getUint8(0);
            let hr;
            if (flags & 0x01) {
                hr = val.getUint16(1, true);
            } else {
                hr = val.getUint8(1);
            }
            p.hr = hr;
            p.lastUpdate = Date.now();
            p.connected = true;

            if (!p.lastSampleTime) {
                p.lastSampleTime = Date.now();
            }

            // Salvar medição de repouso nos primeiros 3 minutos da aula
            if (currentSessionId && (Date.now() - wodStartTime) <= 180000) {
                saveRestingHRSample(p.id, currentSessionId, hr);
            }

            renderTiles();
        });

        p.connected = true;
        p.lastUpdate = Date.now();
        p.lastSampleTime = p.lastSampleTime || Date.now();
        renderTiles();
        console.log(`Conectado com sucesso: ${p.name} (${p.hr || 'aguardando HR'})`);

        // NOVO: Salvar FC repouso imediatamente na primeira conexão do aluno na sessão
        if (currentSessionId && p.connected && p.lastSampleTime === p.lastUpdate) {  // primeira conexão na sessão
            if (p.hr >= 30 && p.hr <= 120) {
                console.log(`[RESTING HR ON CONNECT] Primeira conexão de ${p.name} na sessão ${currentSessionId} - salvando amostra inicial: ${p.hr} bpm`);
                await saveRestingHRSample(p.id, currentSessionId, p.hr);
            } else {
                console.log(`[RESTING HR ON CONNECT] HR inicial inválido para ${p.name}: ${p.hr} bpm (fora de 30-120)`);
            }
        }

    } catch (e) {
        console.error("Erro ao conectar device:", e);
        p.connected = false;
        renderTiles();
    }
}

// ── RANKINGS ────────────────────────────────────────────────────────────────────
function updateLeaderboard() {
    if (!participants.length) return;
    const active = participants.filter(p => activeParticipants.includes(p.id));
    if (!active.length) return;
    const l = active.reduce((a, b) => (b.queimaPoints || 0) > (a.queimaPoints || 0) ? b : a, {queimaPoints:0});
    const el = document.getElementById('leaderboard-top');
    if (el) el.textContent = `Líder Aula: ${l.name || '--'} (${Math.round(l.queimaPoints || 0)} PTS)`;
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
        html += `<tr><td>${i+1}º</td><td>${item.n}</td><td>${Math.round(item.p)}</td></tr>`;
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
            weeklyHistory.participants[p.name].totalQueimaPontos += Math.round(p.queimaPoints);
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
        dailyLeader.queimaPoints = Math.round(best.queimaPoints);
        saveDailyLeader();
    }
    renderDailyLeader();
}

function renderDailyLeader() {
    const el = document.getElementById('daily-leader');
    if (el) el.textContent = dailyLeader.name ? `Campeão do Dia: ${dailyLeader.name} - ${dailyLeader.queimaPoints} PTS` : "Campeão do Dia: --";
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

    queimaEl.innerHTML = queima.length ? queima.map((x,i)=>`<div class="position-${i+1}">${i+1}º ${x.n}: <strong>${Math.round(x.p)}</strong></div>`).join('') : 'Nenhum dado ainda';

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
async function checkTecnofitStatus() { console.log("Buscando check-ins..."); }
async function fetchDailyWorkout() { console.log("Buscando WOD..."); }