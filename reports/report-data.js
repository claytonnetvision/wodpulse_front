// report-data.js - Lógica de consulta e agregação de dados para relatórios

const db = new Dexie('V6WodPulseDB');
db.version(1).stores({
    sessions: '++id, className, dateStart, dateEnd',
    participants: '++id, name, gender',
    hr_samples: '++id, participantId, sessionId, timestamp, hr'
});

// Função auxiliar: converte data ISO para objeto Date local
function parseDateLocal(isoString) {
    return new Date(isoString);
}

// 1. Busca sessões com filtros
async function getSessions(filters = {}) {
    let sessions = await db.sessions.toArray();

    if (filters.date) {
        const start = parseDateLocal(filters.date + 'T00:00:00.000Z');
        const end = parseDateLocal(filters.date + 'T23:59:59.999Z');
        sessions = sessions.filter(s => {
            const d = parseDateLocal(s.dateStart);
            return d >= start && d <= end;
        });
    }

    if (filters.type && filters.type !== 'todas') {
        const isManual = filters.type === 'manuais';
        sessions = sessions.filter(s => {
            const manual = s.className === 'Aula Manual';
            return isManual ? manual : !manual;
        });
    }

    if (filters.participantId) {
        const pid = Number(filters.participantId);
        const filtered = [];
        for (const s of sessions) {
            const participants = await db.session_participants.where('session_id').equals(s.id).toArray();
            if (participants.some(p => p.participantId === pid)) {
                filtered.push(s);
            }
        }
        sessions = filtered;
    }

    return sessions.sort((a,b) => new Date(b.dateStart) - new Date(a.dateStart));
}

// 2. Resumo de um aluno em uma sessão específica
async function getParticipantSummary(sessionId, participantId) {
    const sp = await db.session_participants
        .where('[session_id+participant_id]')
        .equals([sessionId, Number(participantId)])
        .first();

    if (!sp) return null;

    const p = await db.participants.get(Number(participantId));
    const s = await db.sessions.get(sessionId);

    return {
        ...sp,
        name: p?.name || 'Aluno removido',
        gender: p?.gender,
        className: s?.className,
        dateStart: s?.dateStart,
        dateEnd: s?.dateEnd,
        durationMinutes: s?.duration_minutes
    };
}

// 3. Resumo da última aula (para email ou dashboard)
async function getLastSessionSummary() {
    const lastSession = await db.sessions.orderBy('dateStart').reverse().first();
    if (!lastSession) return null;

    const participantsData = await db.session_participants
        .where('session_id')
        .equals(lastSession.id)
        .toArray();

    return {
        session: lastSession,
        participants: participantsData
    };
}

// 4. Rankings globais (top 5 pontos/calorias/VO2)
async function getGlobalRankings(period = 'hoje') {
    let sessions = await db.sessions.toArray();

    if (period === 'hoje') {
        const todayStart = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
        sessions = sessions.filter(s => s.dateStart >= todayStart);
    }

    const totals = {
        pontos: {},
        calorias: {},
        vo2Time: {}
    };

    for (const sess of sessions) {
        const participants = await db.session_participants
            .where('session_id')
            .equals(sess.id)
            .toArray();

        for (const p of participants) {
            const name = (await db.participants.get(p.participantId))?.name || `Aluno ${p.participantId}`;
            totals.pontos[name] = (totals.pontos[name] || 0) + (p.queima_points || 0);
            totals.calorias[name] = (totals.calorias[name] || 0) + (p.calories_total || 0);
            totals.vo2Time[name] = (totals.vo2Time[name] || 0) + (p.vo2_time_seconds || 0);
        }
    }

    // Ordena e retorna top 5
    function getTop5(obj) {
        return Object.entries(obj)
            .sort((a,b) => b[1] - a[1])
            .slice(0,5)
            .map(([name, value]) => ({ name, value }));
    }

    return {
        pontos: getTop5(totals.pontos),
        calorias: getTop5(totals.calorias),
        vo2Time: getTop5(totals.vo2Time)
    };
}

// 5. Histórico de um aluno (para comparação e email)
async function getParticipantHistory(participantId, limit = 5) {
    const summaries = await db.session_participants
        .where('participant_id')
        .equals(Number(participantId))
        .sortBy('created_at');

    const history = [];
    for (const sp of summaries.reverse().slice(0, limit)) {
        const s = await db.sessions.get(sp.session_id);
        history.push({
            sessionId: sp.session_id,
            date: parseDateLocal(s?.dateStart || sp.created_at).toLocaleDateString('pt-BR'),
            pontos: sp.queima_points || 0,
            calorias: sp.calories_total || 0,
            vo2Time: sp.vo2_time_seconds || 0,
            avgHR: sp.avg_hr || 0,
            maxHR: sp.max_hr_reached || 0,
            minRed: sp.min_red || 0
        });
    }

    return history;
}

// Exporta as funções para usar em report.js
window.getSessions = getSessions;
window.getParticipantSummary = getParticipantSummary;
window.getLastSessionSummary = getLastSessionSummary;
window.getGlobalRankings = getGlobalRankings;
window.getParticipantHistory = getParticipantHistory;