// report-ui.js - Renderização de tabelas, gráficos e HTML do relatório

// Função auxiliar: formata minutos em mm:ss
function formatMinutes(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 1. Renderiza tabela Top 5 (pontos, calorias ou VO2)
function renderTop5Table(tableId, data, isPoints = false) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';

    data.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}º</td>
            <td>${item.name}</td>
            <td>${isPoints ? item.value : Math.round(item.value)} ${isPoints ? 'pts' : 'kcal'}</td>
        `;
        tbody.appendChild(row);
    });
}

// 2. Renderiza tabela de aulas encontradas
function renderSessionsTable(sessions) {
    const container = document.getElementById('today-list');
    container.innerHTML = '';

    if (sessions.length === 0) {
        container.innerHTML = '<p style="color:#aaa;">Nenhuma aula encontrada com os filtros aplicados.</p>';
        return;
    }

    sessions.forEach(sess => {
        const div = document.createElement('div');
        div.className = 'aula-item';
        div.innerHTML = `
            <h4>${sess.className} - ${new Date(sess.dateStart).toLocaleString('pt-BR')}</h4>
            <p>Duração: ${sess.durationMinutes || '?'} min</p>
            <p>Alunos registrados: ${sess.participantsData?.length || 0}</p>
            <button class="graph-btn" onclick="showHRGraph(${sess.id})">Ver Gráfico HR</button>
            <button onclick="deleteSession(${sess.id})" style="margin-left:10px; background:#d32f2f;">Excluir</button>
        `;
        container.appendChild(div);
    });
}

// 3. Renderiza relatório individual de uma aula (para email ou tela)
async function renderIndividualReportHTML(sessionId, participantId = null) {
    const summary = await getParticipantSummary(sessionId, participantId);
    if (!summary) return '<p>Relatório não encontrado.</p>';

    const history = await getParticipantHistory(participantId, 5);
    const lastSession = history[1] || {}; // penúltima aula (índice 0 é a atual)

    let comparisonText = '';
    if (lastSession.vo2Time && summary.vo2_time_seconds > lastSession.vo2Time) {
        comparisonText = `Você ficou <strong>mais tempo em VO2</strong> que na sua última aula (${formatMinutes(summary.vo2_time_seconds)} vs ${formatMinutes(lastSession.vo2Time)})! Parabéns pelo esforço!`;
    } else if (lastSession.vo2Time) {
        comparisonText = `Tempo em VO2: ${formatMinutes(summary.vo2_time_seconds)} (anterior: ${formatMinutes(lastSession.vo2Time)}). Continue assim!`;
    }

    return `
        <h2>Relatório do treino - ${summary.name}</h2>
        <p><strong>Aula:</strong> ${summary.className} - ${new Date(summary.dateStart).toLocaleString('pt-BR')}</p>
        <p><strong>Duração:</strong> ${summary.durationMinutes || '?'} minutos</p>
        <hr>
        <h3>Seus números:</h3>
        <ul>
            <li>Pontos BPM (TRIMP): ${summary.queima_points || 0}</li>
            <li>Calorias gastas: ${summary.calories_total || 0} kcal</li>
            <li>Tempo em VO2: ${formatMinutes(summary.vo2_time_seconds || 0)}</li>
            <li>FC Média: ${summary.avg_hr || '--'} bpm</li>
            <li>FC Máxima: ${summary.max_hr_reached || '--'} bpm</li>
            <li>EPOC estimado: ${summary.epoc_estimated || 0} kcal pós-treino</li>
            <li>Zonas:
                <ul>
                    <li>Gray: ${Math.round(summary.min_gray || 0)} min</li>
                    <li>Green: ${Math.round(summary.min_green || 0)} min</li>
                    <li>Blue: ${Math.round(summary.min_blue || 0)} min</li>
                    <li>Yellow: ${Math.round(summary.min_yellow || 0)} min</li>
                    <li>Orange: ${Math.round(summary.min_orange || 0)} min</li>
                    <li>Red: ${Math.round(summary.min_red || 0)} min</li>
                </ul>
            </li>
        </ul>
        <p style="font-weight:bold; color:#4CAF50;">${comparisonText}</p>
        <hr>
        <p>Continue treinando com consistência! Seu esforço está valendo a pena.</p>
    `;
}

// 4. Atualiza o loadReport() para usar as novas funções
async function loadReport() {
    const filterDate = document.getElementById('filter-date').value;
    const filterType = document.getElementById('filter-type').value;
    const filterAluno = document.getElementById('filter-aluno').value;

    const filters = {};
    if (filterDate) filters.date = filterDate;
    if (filterType !== 'todas') filters.type = filterType;
    if (filterAluno) filters.participantId = filterAluno;

    const sessions = await getSessions(filters);

    renderSessionsTable(sessions);

    // Rankings
    const rankings = await getGlobalRankings();
    renderTop5Table('geral-pontos-table', rankings.pontos, true);
    renderTop5Table('geral-calorias-table', rankings.calorias);
    renderTop5Table('geral-vo2-table', rankings.vo2Time);
}

// Atualiza populateAlunoFilter (já existe, mas deixo compatível)
async function populateAlunoFilter() {
    const alunos = await db.participants.toArray();
    const select = document.getElementById('filter-aluno');
    select.innerHTML = '<option value="">Todos / Selecione</option>';
    alunos.sort((a,b) => a.name.localeCompare(b.name)).forEach(aluno => {
        const opt = document.createElement('option');
        opt.value = aluno.id;
        opt.textContent = aluno.name;
        select.appendChild(opt);
    });
}

// Exporta funções para report.js
window.populateAlunoFilter = populateAlunoFilter;
window.loadReport = loadReport;
window.renderIndividualReportHTML = renderIndividualReportHTML;