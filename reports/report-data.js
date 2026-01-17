// report-data.js - Lógica de consulta via API backend (sem Dexie por enquanto)

const API_BASE_URL = 'https://wodpulse-back.onrender.com';  // ajuste para localhost:3001 em dev se preferir

async function apiGet(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Sem detalhes');
        throw new Error(`Erro ao buscar ${endpoint}: ${response.status} - ${errorText}`);
    }
    return response.json();
}

// 1. Busca sessões com filtros
async function getSessions(filters = {}) {
    let url = '/api/sessions?';
    if (filters.date) {
        url += `start_date=${filters.date}&end_date=${filters.date}`;
    }
    if (filters.participantId) {
        url += `&participant_id=${filters.participantId}`;
    }

    const data = await apiGet(url);
    return (data.sessions || []).map(s => ({
        id: s.id,
        className: s.class_name,
        dateStart: s.date_start,
        dateEnd: s.date_end,
        durationMinutes: s.duration_minutes,
        participant_count: s.participant_count || 0
    }));
}

// 2. Resumo de um aluno em uma sessão específica
async function getParticipantSummary(sessionId, participantId) {
    const data = await apiGet(`/api/sessions/${sessionId}`);
    const sp = data.participants?.find(p => p.participant_id === Number(participantId));
    if (!sp) return null;

    const session = data.session;

    return {
        ...sp,
        name: sp.name || 'Aluno removido',
        gender: sp.gender,
        className: session.class_name,
        dateStart: session.date_start,
        dateEnd: session.date_end,
        durationMinutes: session.duration_minutes
    };
}

// 3. Resumo da última aula (para dashboard ou email)
async function getLastSessionSummary() {
    const sessions = await getSessions({ limit: 1 });
    if (!sessions.length) return null;

    const last = sessions[0];
    const details = await apiGet(`/api/sessions/${last.id}`);

    return {
        session: details.session,
        participants: details.participants || []
    };
}

// 4. Rankings globais – agora com o path correto /api/sessions/rankings/weekly
async function getGlobalRankings(period = 'hoje') {
    try {
        let url = '/api/sessions/rankings/weekly?metric=queima_points&limit=5';
        
        // Temporário: use uma semana com dados reais (ajuste a data conforme suas sessões salvas)
        // Exemplo: semana de 13/01/2026 (mude para a data das suas aulas)
        url += '&week_start=2026-01-13';  // <-- ajuste aqui se quiser ver dados reais

        const data = await apiGet(url);
        const rankings = data.rankings || [];

        return {
            pontos: rankings.map(r => ({ name: r.name || 'Desconhecido', value: r.total_queima_points || 0 })),
            calorias: rankings.map(r => ({ name: r.name || 'Desconhecido', value: r.total_calories || 0 })),
            vo2Time: rankings.map(r => ({ name: r.name || 'Desconhecido', value: r.total_vo2_seconds || 0 }))
        };
    } catch (err) {
        console.warn('Ranking semanal falhou (pode ser semana vazia):', err.message);
        // Retorna vazio para não quebrar o relatório
        return {
            pontos: [],
            calorias: [],
            vo2Time: []
        };
    }
}

// 5. Histórico de um aluno (para comparação e relatório individual)
async function getParticipantHistory(participantId, limit = 5) {
    const data = await apiGet(`/api/sessions/participants/${participantId}/history?limit=${limit}`);
    return (data.history || []).map(h => ({
        sessionId: h.session_id,
        date: new Date(h.date_start).toLocaleDateString('pt-BR'),
        pontos: h.queima_points || 0,
        calorias: h.calories || 0,
        vo2Time: h.vo2_time_seconds || 0,
        avgHR: h.avg_hr || 0,
        maxHR: h.max_hr_reached || 0,
        minRed: h.min_red || 0
    }));
}

// Exporta para report.js
window.getSessions = getSessions;
window.getParticipantSummary = getParticipantSummary;
window.getLastSessionSummary = getLastSessionSummary;
window.getGlobalRankings = getGlobalRankings;
window.getParticipantHistory = getParticipantHistory;