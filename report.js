// report.js - Controla a página de relatórios (coordena os outros arquivos)

const db = new Dexie('V6WodPulseDB');
db.version(1).stores({
    sessions: '++id, className, dateStart, dateEnd',
    participants: '++id, name, gender',
    hr_samples: '++id, participantId, sessionId, timestamp, hr'
});

let hrChart = null;

// Importa funções dos novos arquivos (no HTML já importa report-data.js e report-ui.js antes)
async function populateAlunoFilter() {
    await window.populateAlunoFilter(); // do report-data.js
}

async function loadReport() {
    const filterDate = document.getElementById('filter-date').value;
    const filterType = document.getElementById('filter-type').value;
    const filterAluno = document.getElementById('filter-aluno').value;

    const filters = {};
    if (filterDate) filters.date = filterDate;
    if (filterType !== 'todas') filters.type = filterType;
    if (filterAluno) filters.participantId = filterAluno;

    const sessions = await getSessions(filters); // do report-data.js

    renderSessionsTable(sessions); // do report-ui.js

    // Rankings
    const rankings = await getGlobalRankings(); // do report-data.js
    renderTop5Table('geral-pontos-table', rankings.pontos, true); // do report-ui.js
    renderTop5Table('geral-calorias-table', rankings.calorias, false, 'kcal');
    renderTop5Table('geral-vo2-table', rankings.vo2Time, false, '', true);

    // ... adicione os outros rankings (homens/mulheres) da mesma forma se quiser
}

async function showHRGraph(sessionId) {
    await window.showHRGraph(sessionId); // do report-ui.js
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

async function exportIndividualReport(sessionId, alunoName) {
    await window.exportIndividualReport(sessionId, alunoName); // do report-ui.js
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