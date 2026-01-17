// report-ui.js - Renderização de tabelas, gráficos e relatório individual

// Função auxiliar: formata segundos em mm:ss
function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 1. Renderiza tabela Top 5 (pontos, calorias ou VO2)
function renderTop5Table(tableId, data, isPoints = false, unit = '', isTime = false) {
    const table = document.querySelector(`#${tableId}`);
    if (!table) {
        console.warn(`Tabela ${tableId} não encontrada`);
        return;
    }

    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">Nenhum dado ainda</td></tr>';
        return;
    }

    data.forEach((item, index) => {
        let value = item.value;
        if (isTime) value = formatTime(value);
        else value = Math.round(value) + (unit ? ' ' + unit : '');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}º</td>
            <td>${item.name || 'Desconhecido'}</td>
            <td>${value}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 2. Renderiza lista de aulas encontradas (se você ainda usar)
function renderSessionsList(sessions) {
    const container = document.getElementById('today-list');
    if (!container) return;

    container.innerHTML = '';

    if (sessions.length === 0) {
        container.innerHTML = '<p style="color:#aaa;">Nenhuma aula encontrada com os filtros.</p>';
        return;
    }

    sessions.forEach(sess => {
        const start = new Date(sess.dateStart).toLocaleString('pt-BR');
        const end = new Date(sess.dateEnd).toLocaleString('pt-BR');
        const duration = sess.durationMinutes || Math.round((new Date(sess.dateEnd) - new Date(sess.dateStart)) / 60000);

        const div = document.createElement('div');
        div.className = 'aula-item';
        div.innerHTML = `
            <h4>${sess.className} - ${start} até ${end} (${duration} min)</h4>
            <p>Alunos: ${sess.participantsData?.length || 0}</p>
            <button class="graph-btn" onclick="showHRGraph(${sess.id})">Ver detalhes / Gráfico</button>
        `;
        container.appendChild(div);
    });
}

// 3. Mostra gráfico e relatório individual de uma aula (placeholder - pode expandir depois)
async function showHRGraph(sessionId) {
    alert(`Gráfico de HR da sessão ${sessionId} (em desenvolvimento)`);
    // Se quiser implementar depois, use Chart.js aqui
}

// Exporta para uso em module (import)
export { renderTop5Table, formatTime, renderSessionsList, showHRGraph };

// Expõe no window para uso direto no HTML (botão Filtrar e onclick)
window.renderTop5Table = renderTop5Table;
window.formatTime = formatTime;
window.renderSessionsList = renderSessionsList;
window.showHRGraph = showHRGraph;