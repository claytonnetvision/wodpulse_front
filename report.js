const db = new Dexie('V6WodPulseDB');
db.version(1).stores({
    sessions: '++id, className, dateStart, dateEnd',
    participants: '++id, name, gender',
    hr_samples: '++id, participantId, sessionId, timestamp, hr'
});

let hrChart = null;

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

async function loadReport() {
    const filterDate = document.getElementById('filter-date').value;
    const filterType = document.getElementById('filter-type').value;
    const filterAluno = document.getElementById('filter-aluno').value;

    let sessions = await db.sessions.toArray();

    if (filterDate) {
        const start = filterDate + 'T00:00:00.000Z';
        const end = filterDate + 'T23:59:59.999Z';
        sessions = sessions.filter(s => s.dateStart >= start && s.dateStart <= end);
    }

    if (filterType !== 'todas') {
        sessions = sessions.filter(s => {
            const isManual = s.className === 'Aula Manual';
            return filterType === 'manuais' ? isManual : !isManual;
        });
    }

    if (filterAluno) {
        sessions = sessions.filter(s => s.participantsData.some(p => p.participantId == filterAluno));
    }

    document.querySelectorAll('#rankings-section table tbody').forEach(tbody => {
        tbody.innerHTML = '';
    });

    const totals = {
        geral: { pontos: {}, calorias: {}, vo2Time: {} },
        homens: { pontos: {}, calorias: {}, vo2Time: {} },
        mulheres: { pontos: {}, calorias: {}, vo2Time: {} }
    };

    sessions.forEach(sess => {
        sess.participantsData.forEach(p => {
            totals.geral.pontos[p.name] = (totals.geral.pontos[p.name] || 0) + p.queimaPoints;
            totals.geral.calorias[p.name] = (totals.geral.calorias[p.name] || 0) + p.calories;
            totals.geral.vo2Time[p.name] = (totals.geral.vo2Time[p.name] || 0) + (p.vo2TimeSeconds || 0);

            if (p.gender === 'M') {
                totals.homens.pontos[p.name] = (totals.homens.pontos[p.name] || 0) + p.queimaPoints;
                totals.homens.calorias[p.name] = (totals.homens.calorias[p.name] || 0) + p.calories;
                totals.homens.vo2Time[p.name] = (totals.homens.vo2Time[p.name] || 0) + (p.vo2TimeSeconds || 0);
            } else if (p.gender === 'F') {
                totals.mulheres.pontos[p.name] = (totals.mulheres.pontos[p.name] || 0) + p.queimaPoints;
                totals.mulheres.calorias[p.name] = (totals.mulheres.calorias[p.name] || 0) + p.calories;
                totals.mulheres.vo2Time[p.name] = (totals.mulheres.vo2Time[p.name] || 0) + (p.vo2TimeSeconds || 0);
            }
        });
    });

    renderTop5Table('geral-pontos-table', totals.geral.pontos, true);
    renderTop5Table('geral-calorias-table', totals.geral.calorias, false, 'kcal');
    renderTop5Table('geral-vo2-table', totals.geral.vo2Time, false, '', true);

    renderTop5Table('homens-pontos-table', totals.homens.pontos, true);
    renderTop5Table('homens-calorias-table', totals.homens.calorias, false, 'kcal');
    renderTop5Table('homens-vo2-table', totals.homens.vo2Time, false, '', true);

    renderTop5Table('mulheres-pontos-table', totals.mulheres.pontos, true);
    renderTop5Table('mulheres-calorias-table', totals.mulheres.calorias, false, 'kcal');
    renderTop5Table('mulheres-vo2-table', totals.mulheres.vo2Time, false, '', true);

    const list = document.getElementById('today-list');
    list.innerHTML = sessions.length ? '' : '<p>Nenhuma aula encontrada.</p>';

    sessions.forEach(sess => {
        const start = new Date(sess.dateStart).toLocaleString('pt-BR');
        const end = new Date(sess.dateEnd).toLocaleString('pt-BR');
        const duration = Math.round((new Date(sess.dateEnd) - new Date(sess.dateStart)) / 60000);
        const totalPoints = sess.participantsData.reduce((sum, p) => sum + p.queimaPoints, 0);
        const totalCalories = sess.participantsData.reduce((sum, p) => sum + p.calories, 0);

        const sortedByPoints = [...sess.participantsData].sort((a,b) => b.queimaPoints - a.queimaPoints);

        const div = document.createElement('div');
        div.className = 'aula-item';
        div.innerHTML = `
            <p><strong>${sess.className}</strong> – ${start} até ${end} (${duration} min)</p>
            <p>Total alunos: ${sess.participantsData.length} | Pontos aula: ${totalPoints} | Calorias aula: ${totalCalories} kcal</p>
            <button class="delete-btn" onclick="deleteSession(${sess.id})">Excluir Aula</button>
            <h4>Top 5 Pontos BPM</h4>
            <ul>
        `;
        sortedByPoints.slice(0,5).forEach(p => {
            div.innerHTML += `<li>${p.name} - ${p.queimaPoints} pts <button class="graph-btn" onclick="showHRGraph('${p.name}', ${sess.id})">Ver Gráfico HR</button></li>`;
        });
        div.innerHTML += `</ul><hr>`;
        list.appendChild(div);
    });
}

function renderTop5Table(tableId, data, showGraphButton = false, unit = '', isTime = false) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';

    const sorted = Object.entries(data)
        .map(([name, value]) => ({name, value}))
        .sort((a,b) => b.value - a.value)
        .slice(0,5);

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">Nenhum dado</td></tr>';
        return;
    }

    sorted.forEach((item, i) => {
        const tr = document.createElement('tr');
        let graphCell = showGraphButton ? `<td><button class="graph-btn" onclick="showHRGraph('${item.name}', ${tableId.split('-')[0]})">Ver Gráfico</button></td>` : '<td></td>';

        let displayValue = Math.round(item.value);
        if (isTime) {
            displayValue = `${Math.floor(displayValue / 60)}:${(displayValue % 60).toString().padStart(2, '0')}`;
        } else if (unit) {
            displayValue += unit;
        }

        tr.innerHTML = `
            <td>${i+1}º</td>
            <td>${item.name}</td>
            <td>${displayValue}</td>
            ${graphCell}
        `;
        tbody.appendChild(tr);
    });
}

async function showHRGraph(alunoName, sessionId) {
    const participant = await db.participants.where('name').equalsIgnoreCase(alunoName).first();
    if (!participant) return alert(`Aluno "${alunoName}" não encontrado.`);

    const participantId = participant.id;

    const session = await db.sessions.get(sessionId);
    if (!session) return alert("Sessão não encontrada.");

    const sessParticipant = session.participantsData.find(p => p.participantId === participantId);
    if (!sessParticipant) return alert(`Aluno não participou desta sessão.`);

    const samples = await db.hr_samples
        .where('sessionId').equals(sessionId)
        .and(s => s.participantId === participantId)
        .sortBy('timestamp');

    if (samples.length === 0) {
        return alert(`Nenhum dado de FC coletado para ${alunoName}.\n(Valores coletados a cada 2 min)`);
    }

    const labels = samples.map(s => new Date(s.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    const data = samples.map(s => s.hr);

    const maxHR = Math.max(...data);
    const minHR = Math.min(...data);
    const avgHR = (data.reduce((a,b) => a + b, 0) / data.length).toFixed(0);

    const durationMs = new Date(session.dateEnd) - new Date(session.dateStart);
    const durationMin = Math.round(durationMs / 60000);

    // Tempo por zona
    const zoneTimes = { gray:0, green:0, blue:0, yellow:0, orange:0, red:0 };
    samples.forEach(s => {
        const percent = (s.hr / participant.maxHR) * 100;
        const zone = getZone(percent);
        zoneTimes[zone] += 2; // aprox 2 min por amostra
    });

    const vo2Time = sessParticipant.vo2TimeSeconds || 0;
    const vo2Formatted = vo2Time > 0 ? `${Math.floor(vo2Time / 60)}:${(vo2Time % 60).toString().padStart(2, '0')}` : '--';

    // Ranking na aula
    const sortedByPoints = [...session.participantsData].sort((a,b) => b.queimaPoints - a.queimaPoints);
    const rankPoints = sortedByPoints.findIndex(p => p.participantId === participantId) + 1;
    const total = session.participantsData.length;

    document.getElementById('grafico-nome').textContent = alunoName;
    document.getElementById('grafico-section').classList.remove('hidden');

    document.getElementById('grafico-metricas').innerHTML = `
        <p><strong>Duração da aula:</strong> ${durationMin} minutos</p>
        <p><strong>FC Máxima:</strong> ${maxHR} bpm</p>
        <p><strong>FC Mínima:</strong> ${minHR} bpm</p>
        <p><strong>FC Média:</strong> ${avgHR} bpm</p>
        <p><strong>FC Repouso:</strong> ${participant.restingHR || 'Não cadastrado'} bpm</p>
        <p><strong>Calorias:</strong> ${Math.round(sessParticipant.calories || 0)} kcal</p>
        <p><strong>EPOC estimado:</strong> ${Math.round(sessParticipant.epocEstimated || 0)} kcal</p>
        <p><strong>Tempo VO2max (≥92%):</strong> ${vo2Formatted}</p>
        <p><strong>Ranking na aula:</strong> ${rankPoints}º de ${total} (pontos)</p>
        <h4>Tempo por zona:</h4>
        <ul style="margin-left:20px; font-size:0.95rem;">
            <li>Gray: ${zoneTimes.gray} min</li>
            <li>Green: ${zoneTimes.green} min</li>
            <li>Blue: ${zoneTimes.blue} min</li>
            <li>Yellow: ${zoneTimes.yellow} min</li>
            <li>Orange: ${zoneTimes.orange} min</li>
            <li>Red: ${zoneTimes.red} min</li>
        </ul>
        <button onclick="exportIndividualReport(${sessionId}, '${alunoName.replace(/'/g, "\\'")}')" style="margin-top:15px; padding:10px 20px; background:#FF5722; color:white; border:none; border-radius:8px; cursor:pointer;">Exportar PDF deste treino</button>
    `;

    if (hrChart) hrChart.destroy();

    const ctx = document.getElementById('hrChart').getContext('2d');
    hrChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Frequência Cardíaca (bpm)',
                data,
                borderColor: '#FF5722',
                backgroundColor: 'rgba(255,87,34,0.2)',
                tension: 0.1,
                fill: true,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#FF5722',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: false, suggestedMin: 40, suggestedMax: 220, title: { display: true, text: 'BPM' } },
                x: { title: { display: true, text: 'Tempo' } }
            }
        }
    });
}

function getZone(p) {
    if (p < 50) return 'gray';
    if (p < 60) return 'green';
    if (p < 70) return 'blue';
    if (p < 80) return 'yellow';
    if (p < 90) return 'orange';
    return 'red';
}

async function exportIndividualReport(sessionId, alunoName) {
    const element = document.getElementById('grafico-section');
    if (!element) return alert("Gráfico não encontrado.");

    const opt = {
        margin: 1,
        filename: `Treino_${alunoName}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}

async function deleteSession(sessionId) {
    if (!confirm("Excluir permanentemente?")) return;
    await db.sessions.delete(sessionId);
    await db.hr_samples.where('sessionId').equals(sessionId).delete();
    alert("Aula excluída.");
    loadReport();
}

async function exportReportToPDF() {
    const element = document.querySelector('.container');
    const opt = {
        margin: 1,
        filename: `Relatorio_V6_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

window.addEventListener('load', async () => {
    await populateAlunoFilter();
    await loadReport();
});

window.loadReport = loadReport;
window.showHRGraph = showHRGraph;
window.deleteSession = deleteSession;
window.exportReportToPDF = exportReportToPDF;
window.exportIndividualReport = exportIndividualReport;