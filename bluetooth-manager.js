// bluetooth-manager.js - Gerenciamento de dispositivos Bluetooth (pareamento, conexão e reconexão)

let reconnectInterval = null;

// ── PAIR DEVICE COM EMPRÉSTIMO ─────────────────────────────────────────────────
async function pairDeviceToParticipant(p) {
    try {
        const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
        const alreadyRegistered = participants.find(existing => existing.deviceId === device.id && existing.id !== p.id);
        
        // ALTERAÇÃO: Pegando o token do localStorage para usar nas requisições.
        const token = localStorage.getItem('wodpulse_token');

        if (alreadyRegistered) {
            const confirmBorrow = confirm(
                `⚠️ Esta pulseira já está cadastrada para o aluno: ${alreadyRegistered.name}\n` +
                `Deseja pegar emprestado? (SIM = desvincula do ${alreadyRegistered.name} e vincula aqui)`
            );
            if (!confirmBorrow) {
                alert("Pareamento cancelado.");
                return;
            }
            try {
                // ALTERAÇÃO: Adicionando o cabeçalho de autorização para desvincular a pulseira.
                await fetch(`${API_BASE_URL}/api/participants/${alreadyRegistered.id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
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

        // ALTERAÇÃO: Adicionando o cabeçalho de autorização para salvar a nova pulseira.
        const response = await fetch(`${API_BASE_URL}/api/participants/${p.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                device_id: p.deviceId,
                device_name: p.deviceName
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`Falha ao salvar pulseira: ${response.status}`, errorData);
            throw new Error('Falha ao salvar pulseira');
        }

        await connectDevice(device, false);
        // Força limpeza e reconexão fresca para garantir notificações
        try {
            if (device.gatt && device.gatt.connected) {
                device.gatt.disconnect();
                console.log(`[PAIR] Desconectado forçadamente ${p.name} para reset limpo`);
            }
            p._hrListener = null;
            await connectDevice(device, false);
            console.log(`[PAIR] Reconexão segura concluída para ${p.name}`);
        } catch (cleanupErr) {
            console.warn(`[PAIR] Erro na limpeza/reconexão: ${cleanupErr.message}`);
        }
        alert(`Pulseira pareada com sucesso para ${p.name}! (${p.deviceName})`);
        renderParticipantList();
        if (currentActiveClassName) renderTiles();
    } catch (e) {
        console.error("Scanner cancelado ou erro:", e);
        alert(`Pulseira não pareada. Erro: ${e.message}`);
    }
}


// ── CONEXÃO DE DISPOSITIVO ─────────────────────────────────────────────────────
async function connectDevice(device, isReconnect = false) {
    let p = participants.find(x => x.device?.id === device.id || x.deviceId === device.id);
    if (!p) {
        console.warn(`[CONNECT] Nenhum participante encontrado para o device ID: ${device.id}`);
        return;
    }
    try {
        console.log(`[CONNECT] Tentando conectar ao GATT de ${p.name}...`);
        const server = await device.gatt.connect();
        console.log(`[CONNECT] GATT conectado para ${p.name}`);

        device.addEventListener('gattserverdisconnected', () => {
            console.log(`[DISCONNECT] GATT desconectado para ${p.name}`);
            p.connected = false;
            p.hr = 0;
            renderTiles();
        });

        const service = await server.getPrimaryService('heart_rate');
        const char = await service.getCharacteristic('heart_rate_measurement');
        
        console.log(`[CONNECT] Iniciando notificações para ${p.name}`);
        await char.startNotifications();

        if (p._hrListener) {
            char.removeEventListener('characteristicvaluechanged', p._hrListener);
            console.log(`[CONNECT] Listener antigo removido para ${p.name}`);
        }

        p._hrListener = (e) => {
            const val = e.target.value;
            const flags = val.getUint8(0);
            let hr;
            if (flags & 0x01) { // Formato de 16 bits
                hr = val.getUint16(1, true);
            } else { // Formato de 8 bits
                hr = val.getUint8(1);
            }
            p.hr = hr;
            p.lastUpdate = Date.now();
            p.connected = true;
            if (!p.lastSampleTime) {
                p.lastSampleTime = Date.now();
            }
            if (currentSessionId && (Date.now() - wodStartTime) <= 180000) {
                saveRestingHRSample(p.id, currentSessionId, hr);
            }
            // A renderização já acontece no loop principal, mas podemos forçar aqui se necessário
            // renderTiles(); 
        };
        char.addEventListener('characteristicvaluechanged', p._hrListener);
        p.connected = true;
        p.lastUpdate = Date.now();
        p.lastSampleTime = p.lastSampleTime || Date.now();
        console.log(`[CONNECT] Sucesso! ${p.name} está conectado e recebendo dados.`);
        renderTiles();
    } catch (e) {
        console.error(`[CONNECT] Falha ao conectar com ${p.name}:`, e);
        p.connected = false;
        renderTiles();
    }
}

// ── LOOP DE RECONEXÃO AUTOMÁTICA ───────────────────────────────────────────────
function startReconnectLoop() {
    if (reconnectInterval) clearInterval(reconnectInterval);
    console.log('[RECONNECT] Iniciando loop de reconexão a cada 5 segundos.');
    reconnectInterval = setInterval(async () => {
        for (const id of activeParticipants) {
            const p = participants.find(p => p.id === id);
            if (!p || !p.device || p.connected) continue;
            
            console.log(`[RECONNECT] Tentando reconectar ${p.name}...`);
            try {
                if (p.device.gatt?.connected) {
                    p.connected = true;
                    console.log(`[RECONNECT] ${p.name} já estava conectado, atualizando status.`);
                    continue;
                }
                await connectDevice(p.device, true); // Reutiliza a função de conexão
            } catch (err) {
                console.error(`[RECONNECT] Falha no loop para ${p.name}:`, err);
                p.connected = false;
                renderTiles();
            }
        }
    }, 5000);
}

function stopReconnectLoop() {
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
        console.log('[RECONNECT] Loop de reconexão parado.');
    }
}

// ── RECONEXÃO MANUAL DE TODOS OS DISPOSITIVOS ──────────────────────────────────
async function reconnectAllSavedDevices() {
    console.log("Reconexão manual de todos os dispositivos solicitada...");
    let connectedCount = 0;
    let failedCount = 0;
    
    // Usamos um Set para evitar pedir o mesmo dispositivo várias vezes se houver duplicatas
    const devicesToReconnect = new Set();
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (p && p.deviceId && !p.connected) {
            devicesToReconnect.add(p.deviceId);
        }
    });

    if (devicesToReconnect.size === 0) {
        alert("Todos os alunos ativos já parecem estar conectados.");
        return;
    }

    try {
        // Pede ao usuário para selecionar um dispositivo da lista de todos os que precisam de reconexão
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['heart_rate'] }],
            optionalServices: ['heart_rate']
        });

        const participantToConnect = participants.find(p => p.deviceId === device.id);

        if (participantToConnect) {
            console.log(`Dispositivo selecionado corresponde a ${participantToConnect.name}. Conectando...`);
            participantToConnect.device = device;
            await connectDevice(device, true);
            connectedCount++;
            alert(`Reconectado com sucesso: ${participantToConnect.name}`);
        } else {
            failedCount++;
            alert(`O dispositivo selecionado não corresponde a nenhum aluno que precisa de reconexão.`);
        }

    } catch (e) {
        console.error(`Falha no processo de reconexão manual:`, e);
        alert(`Processo de reconexão cancelado ou falhou. Erro: ${e.message}`);
    }
    
    console.log(`Reconexão manual concluída! Conectados: ${connectedCount}, Falhas: ${failedCount}`);
    if (connectedCount > 0) {
        document.getElementById('authorizeReconnectBtn')?.classList.add('hidden');
    }
}

// ── VISIBILIDADE DO BOTÃO DE RECONEXÃO ─────────────────────────────────────────
function updateReconnectButtonVisibility() {
    const btn = document.getElementById('reconnectDevicesBtn');
    if (btn) {
        btn.classList.toggle('hidden', !currentActiveClassName);
    }
}
