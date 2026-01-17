// db.js - Dexie setup + migração localStorage + sessions + hr_samples

const db = new Dexie('V6WodPulseDB');

db.version(1).stores({
    participants: '++id, name, &nameLower',     // cadastro de alunos
    sessions: '++id, className, dateStart, dateEnd',  // aulas finalizadas
    hr_samples: '++id, participantId, sessionId, timestamp, hr'  // amostras HR
});

// Normaliza nome para busca case-insensitive
function normalizeName(name) {
    return name.trim().toLowerCase();
}

// Migração única do localStorage antigo (executa só na primeira vez)
async function migrateFromLocalStorage() {
    if (localStorage.getItem('v6ParticipantsMigrated')) return;

    const saved = localStorage.getItem('v6Participants');
    if (!saved) return;

    try {
        const oldParticipants = JSON.parse(saved);
        for (const old of oldParticipants) {
            const existing = await db.participants.where('nameLower').equals(normalizeName(old.name)).first();
            if (!existing) {
                await db.participants.add({
                    name: old.name,
                    age: old.age || 220 - old.maxHR,
                    weight: old.weight,
                    heightCm: old.heightCm || null,
                    gender: old.gender || null,
                    restingHR: old.restingHR || null,
                    useTanaka: old.useTanaka || false,
                    historicalMaxHR: old.historicalMaxHR || 0,
                    maxHR: old.maxHR,
                    deviceId: old.device?.id || null,
                    deviceName: old.deviceName || "",
                    createdAt: new Date().toISOString()
                });
            }
        }
        localStorage.setItem('v6ParticipantsMigrated', 'true');
        console.log('Migração de participants concluída para Dexie.');
    } catch (err) {
        console.error('Erro na migração:', err);
    }
}

// Carrega todos os participants do Dexie + recalcula maxHR se inválido
async function loadParticipantsFromDB() {
    await migrateFromLocalStorage();
    const all = await db.participants.toArray();
    return all.map(p => {
        let maxHR = p.maxHR;
        if (!maxHR || maxHR <= 0 || isNaN(maxHR)) {
            const age = p.age || 30; // fallback se idade não existir
            maxHR = p.useTanaka ? Math.round(208 - 0.7 * age) : (220 - age);
            console.log(`maxHR recalculado para ${p.name}: ${maxHR} (era inválido)`);
        }

        return {
            ...p,
            maxHR, // força o valor corrigido
            hr: 0,
            maxHRReached: 0,
            todayMaxHR: 0,
            device: null,
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
            redStartTime: null
        };
    });
}

// Salva ou atualiza um participant
async function saveParticipant(participant) {
    const dataToSave = {
        name: participant.name,
        nameLower: normalizeName(participant.name),
        age: participant.age,
        weight: participant.weight,
        heightCm: participant.heightCm || null,
        gender: participant.gender || null,
        restingHR: participant.restingHR || null,
        useTanaka: participant.useTanaka || false,
        historicalMaxHR: participant.historicalMaxHR || 0,
        deviceId: participant.device?.id || participant.deviceId || null,
        deviceName: participant.deviceName || "",
        createdAt: participant.createdAt || new Date().toISOString()
        // trimpPoints NÃO salvo aqui permanentemente (só durante a aula)
    };

    if (participant.id) {
        await db.participants.update(participant.id, dataToSave);
    } else {
        const id = await db.participants.add(dataToSave);
        participant.id = id;
    }
}

// Salva uma sessão completa (aula finalizada) - AGORA SALVA TRIMP e VO2
async function saveSession(className, startTime, endTime, participantsData) {
    const sessionData = {
        className,
        dateStart: startTime.toISOString(),
        dateEnd: endTime.toISOString(),
        participantsData: participantsData.map(p => ({
            participantId: p.id,
            name: p.name,
            gender: p.gender,
            queimaPoints: Math.round(p.queimaPoints || 0),      // TRIMP escalado
            trimpPoints: Math.round((p.trimpPoints || 0) * 1000), // valor real escalado
            calories: Math.round(p.calories || 0),
            maxHRReached: p.maxHRReached || 0,
            minOrange: p.minOrange || 0,
            minRed: p.minRed || 0,
            epocEstimated: p.epocEstimated || 0,
            vo2TimeSeconds: Math.round(p.vo2TimeSeconds || 0)    // ← adicionado
        }))
    };
    const id = await db.sessions.add(sessionData);
    console.log(`Sessão salva com sucesso: ${className} (${startTime.toLocaleTimeString()}) - ID: ${id}`);
    return id;
}

// Salva amostra de HR (a cada ~2 minutos)
async function saveHRSample(participant, sessionId) {
    if (!participant.id || !sessionId) {
        console.warn("Não foi possível salvar sample: participant.id ou sessionId ausente");
        return;
    }
    console.log(`Salvando HR sample: aluno ${participant.name} (${participant.id}), session ${sessionId}, HR ${participant.hr}`);
    await db.hr_samples.add({
        participantId: participant.id,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        hr: participant.hr
    });
}

// Função auxiliar para limitar aulas manuais (usada no autoEndClass)
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

window.db = db;
window.loadParticipantsFromDB = loadParticipantsFromDB;
window.saveParticipant = saveParticipant;
window.saveSession = saveSession;
window.saveHRSample = saveHRSample;
window.limitManualSessionsToday = limitManualSessionsToday;