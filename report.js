// report.js - Controla a página de relatórios (agora consumindo backend)

let hrChart = null;

const API_BASE_URL = 'https://wodpulse-back.onrender.com';  // mesmo do report-data.js

// Função auxiliar para carregar lista de alunos no filtro
async function populateAlunoFilter() {
    const select = document.getElementById('filter-aluno');
    select.innerHTML = '<option value="">Todos / Selecione</option>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/participants`);
        if (!response.ok) {
            throw new Error(`Erro ao carregar alunos: ${response.status}`);
        }
        const data = await response.json();
        
        // Supondo que o endpoint retorne { participants: [...] }
        const alunos = data.participants || data || [];
        alunos.sort((a, b) => a.name.localeCompare(b.name)).forEach(aluno => {
            const opt = document.createElement('option');
            opt.value = aluno.id;
            opt.textContent = aluno.name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Erro ao popular filtro de alunos:', err);
        select.innerHTML += '<option value="">Erro ao carregar alunos</option>';
    }
}

// Função principal de carregamento do relatório
async function loadReport() {
    const filterDate = document.getElementById('filter-date').value;
    const filterType = document.getElementById('filter-type').value;
    const filterAluno = document.getElementById('filter-aluno').value;

    const filters = {};
    if (filterDate) filters.date = filterDate;
    if (filterType !== 'todas') filters.type = filterType;
    if (filterAluno) filters.participantId = filterAluno;

    try {
        const sessions = await getSessions(filters);
        renderSessionsList(sessions);

        // Rankings globais (por enquanto usa o weekly como base)
        const rankings = await getGlobalRankings();
        renderTop5Table('geral-pontos-table', rankings.pontos, true);
        renderTop5Table('geral-calorias-table', rankings.calorias, false, 'kcal');
        renderTop5Table('geral-vo2-table', rankings.vo2Time, false, '', true);

        // TODO: implementar rankings por gênero (homens/mulheres) chamando o endpoint com ?gender=M ou F
        // Exemplo futuro: getGlobalRankings('hoje', 'M') etc.

    } catch (err) {
        console.error('Erro ao carregar relatório:', err);
        document.getElementById('today-list').innerHTML = 
            `<p style="color:red;">Erro ao carregar dados: ${err.message}</p>`;
    }
}

// Inicialização da página
window.addEventListener('load', async () => {
    await populateAlunoFilter();
    await loadReport();
});

// Expõe a função para o botão "Filtrar"
window.loadReport = loadReport;

// Funções de renderização (já importadas de report-ui.js)
// window.renderTop5Table, window.renderSessionsList, window.showHRGraph