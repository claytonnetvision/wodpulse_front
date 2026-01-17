// report-data.js - Lógica de consulta via API backend

const API_BASE_URL = 'https://wodpulse-back.onrender.com';  // ou localhost:3001 em dev

async function apiGet(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Sem detalhes');
        throw new Error(`Erro ao buscar ${endpoint}: ${response.status} - ${errorText}`);
    }
    return response.json();
}

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

// Ranking com suporte a métrica e gênero (sem week_start fixo)
async function getGlobalRankings(period = 'hoje', metric = 'queima_points', gender = null) {
    try {
        let url = '/api/sessions/rankings/weekly?metric=' + metric + '&limit=5';
        if (gender) url += '&gender=' + gender;
        // Usa semana atual automaticamente (backend calcula)
        // Se quiser forçar uma semana com dados para teste: url += '&week_start=2026-01-12';

        const data = await apiGet(url);
        const rankings = data.rankings || [];

        if (metric === 'calories') {
            return { calorias: rankings.map(r => ({ name: r.name || 'Desconhecido', value: r.total_calories || 0 })) };
        } else if (metric === 'vo2') {
            return { vo2Time: rankings.map(r => ({ name: r.name || 'Desconhecido', value: r.total_vo2_seconds || 0 })) };
        } else if (metric === 'maxhr') {
            // Novo: ranking por FC máxima
            return { maxHR: rankings.map(r => ({ name: r.name || 'Desconhecido', value: r.max_hr_reached || 0 })) };
        }
        return { pontos: rankings.map(r => ({ name: r.name || 'Desconhecido', value: r.total_queima_points || 0 })) };
    } catch (err) {
        console.warn('Ranking semanal falhou:', err.message);
        return { calorias: [], vo2Time: [], pontos: [], maxHR: [] };
    }
}

async function getParticipantHistory(participantId, limit = 5) {
    const data = await apiGet(`/api/sessions/participants/${participantId}/history?limit=${limit}`);
    return (data.history || []).map(h => ({
        sessionId: h.session_id,
        date: new Date(h.date_start).toLocaleDateString('pt-BR'),
        className: h.class_name || 'Aula',
        calorias: h.calories_total || 0,
        vo2Time: h.vo2_time_seconds || 0,
        avgHR: h.avg_hr || 0,
        maxHR: h.max_hr_reached || 0,
        minRed: h.min_red || 0,
        queimaPoints: h.queima_points || 0,
        trimpTotal: h.trimp_total || 0,
        epocEstimated: h.epoc_estimated || 0,
        realRestingHR: h.real_resting_hr || '--'
    }));
}

// Exporta funções para uso em module
export { getSessions, getParticipantSummary, getLastSessionSummary, getGlobalRankings, getParticipantHistory };