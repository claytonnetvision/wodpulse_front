// bluetooth-manager.js - Gerenciamento de dispositivos Bluetooth (pareamento, conexão e reconexão)

let reconnectInterval = null;

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
        console.log("Scanner cancelado ou erro:", e);
        alert("Pulseira não pareada.");
    }
}

// ── CONEXÃO DE DISPOSITIVO ─────────────────────────────────────────────────────
async function connectDevice(device, isReconnect = false) {
    let p = participants.find(x => x.device?.id === device.id || x.deviceId === device.id);
    if (!p) {
        return;
    }
    try {
        const server = await device.gatt.connect();
        device.addEventListener('gattserverdisconnected', () => {
            p.connected = false;
            p.hr = 0;
            renderTiles();
        });
        const service = await server.getPrimaryService('heart_rate');
        const char = await service.getCharacteristic('heart_rate_measurement');
        await char.startNotifications();
        if (p._hrListener) {
            char.removeEventListener('characteristicvaluechanged', p._hrListener);
        }
        p._hrListener = (e) => {
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
            if (currentSessionId && (Date.now() - wodStartTime) <= 180000) {
                saveRestingHRSample(p.id, currentSessionId, hr);
            }
            renderTiles();
        };
        char.addEventListener('characteristicvaluechanged', p._hrListener);
        p.connected = true;
        p.lastUpdate = Date.now();
        p.lastSampleTime = p.lastSampleTime || Date.now();
        renderTiles();
    } catch (e) {
        p.connected = false;
        renderTiles();
    }
}

// ── LOOP DE RECONEXÃO AUTOMÁTICA ───────────────────────────────────────────────
function startReconnectLoop() {
    if (reconnectInterval) clearInterval(reconnectInterval);
    reconnectInterval = setInterval(async () => {
        for (const id of activeParticipants) {
            const p = participants.find(p => p.id === id);
            if (!p || !p.device || p.connected) continue;
            try {
                if (p.device.gatt?.connected) {
                    p.connected = true;
                    continue;
                }
                await p.device.gatt.connect();
                const server = p.device.gatt;
                const service = await server.getPrimaryService('heart_rate');
                const char = await service.getCharacteristic('heart_rate_measurement');
                if (p._hrListener) {
                    char.removeEventListener('characteristicvaluechanged', p._hrListener);
                }
                p._hrListener = (e) => {
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
                    if (currentSessionId && (Date.now() - wodStartTime) <= 180000) {
                        saveRestingHRSample(p.id, currentSessionId, hr);
                    }
                    renderTiles();
                };
                char.addEventListener('characteristicvaluechanged', p._hrListener);
                await char.startNotifications();
                p.connected = true;
            } catch (err) {
                p.connected = false;
                renderTiles();
            }
        }
    }, 5000);
}

function stopReconnectLoop() {
    if (reconnectInterval) clearInterval(reconnectInterval);
    reconnectInterval = null;
}

// ── RECONEXÃO MANUAL DE TODOS OS DISPOSITIVOS ──────────────────────────────────
async function reconnectAllSavedDevices() {
    console.log("Reconexão manual solicitada...");
    let connectedCount = 0;
    let failedCount = 0;
    for (const id of activeParticipants) {
        const p = participants.find(p => p.id === id);
        if (!p || !p.deviceId || !p.connected) continue;
        console.log(`Tentando reconectar ${p.name} (ID salvo: ${p.deviceId})`);
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
                console.log(`Device errado selecionado para ${p.name}`);
                failedCount++;
                alert(`Selecione a pulseira correta para ${p.name} (${p.deviceName || p.deviceId})`);
            }
        } catch (e) {
            console.error(`Falha ao reconectar ${p.name}:`, e);
            failedCount++;
        }
    }
    alert(`Reconexão manual concluída!\nConectados: ${connectedCount}\nFalhas: ${failedCount}`);
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