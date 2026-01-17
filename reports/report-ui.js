// report-ui.js - Renderização de tabelas, gráficos e relatório individual

// Função auxiliar: formata segundos em mm:ss
function formatTime(seconds) {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 1. Renderiza tabela Top 5 (pontos, calorias ou VO2)
function renderTop5Table(tableId, data, isPoints = false, unit = '', isTime = false) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">Nenhum dado ainda</td></tr>';
        return;
    }

    data.forEach((item, index) => {
        let value = item.value;
        if (isTime) value = formatTime(value);
        else value = Math.round(value) + (unit ? ' ' + unit : '');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}º</td>
            <td>${item.name}</td>
            <td>${value}</td>
            <td></td> <!-- espaço para botão gráfico se quiser -->
        `;
        tbody.appendChild(tr);
    });
}

// 2. Renderiza lista de aulas encontradas
function renderSessionsList(sessions) {
    const container = document.getElementById('today-list');
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

// 3. Mostra gráfico e relatório individual de uma aula
async function showHRGraph(sessionId) {
    const session = await db.sessions.get(sessionId);
    if (!session) return alert("Aula não encontrada");

    document.getElementById('grafico-nome').textContent = `${session.className} - ${new Date(session.dateStart).toLocaleString('pt-BR')}`;
    document.getElementById('grafico-section').classList.remove('hidden');

    // Renderiza relatório individual (exemplo com 1 aluno - expanda para todos)
    const html = await window.renderIndividualReportHTML(sessionId);
    document.getElementById('grafico-metricas').innerHTML = html;

    // Gráfico de HR (exemplo com dados mock - substitua por hr_samples reais)
    const ctx = document.getElementById('hrChart').getContext('2d');
    if (hrChart) hrChart.destroy();

    hrChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['0min', '5min', '10min', '15min', '20min'], // substitua por timestamps reais
            datasets: [{
                label: 'Frequência Cardíaca (bpm)',
                data: [80, 120, 150, 140, 110], // substitua por dados reais de hr_samples
                borderColor: '#FF5722',
                backgroundColor: 'rgba(255,87,34,0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: false, suggestedMin: 40, suggestedMax: 220 }
            }
        }
    });
}

// Exporta funções para report.js
window.renderTop5Table = renderTop5Table;
window.renderSessionsList = renderSessionsList;
window.showHRGraph = showHRGraph;