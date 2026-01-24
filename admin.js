const API_BASE_URL = 'https://wodpulse-back.onrender.com'; // ajuste se necessário

async function loadAlunos() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/participants`);
    if (!res.ok) throw new Error('Falha ao carregar alunos');
    const data = await res.json();
    const tbody = document.querySelector('#alunosTable tbody');
    tbody.innerHTML = '';
    data.participants.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.age || '-'}</td>
        <td>${p.weight || '-'}</td>
        <td>${p.height_cm || '-'}</td>
        <td>${p.gender || '-'}</td>
        <td>${p.email || '-'}</td>
        <td>${p.device_name ? p.device_name : (p.device_id ? 'ID salvo' : 'Sem pulseira')}</td>
        <td>
          <button class="btn-admin btn-edit" onclick="editAluno(${p.id})">Editar</button>
          <button class="btn-admin btn-delete" onclick="deleteAluno(${p.id})">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    alert('Erro ao carregar alunos: ' + err.message);
  }
}

async function loadAulas() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/admin-list`);
    if (!res.ok) throw new Error('Falha ao carregar aulas');
    const { sessions } = await res.json();
    const tbody = document.querySelector('#aulasTable tbody');
    tbody.innerHTML = '';
    sessions.forEach(s => {
      const date = new Date(s.date_start).toLocaleString('pt-BR');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.id}</td>
        <td>${s.class_name}</td>
        <td>${date}</td>
        <td>${s.duration_minutes || '?'}</td>
        <td>${s.participant_count}</td>
        <td>
          <button class="btn-admin btn-details" onclick="verDetalhesAula(${s.id})">Detalhes</button>
          <button class="btn-admin btn-delete" onclick="deleteAula(${s.id})">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    alert('Erro ao carregar aulas: ' + err.message);
  }
}

async function deleteAluno(id) {
  if (!confirm('Excluir aluno permanentemente?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/participants/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha na exclusão');
    alert('Aluno excluído');
    loadAlunos();
  } catch (err) {
    alert('Erro ao excluir aluno: ' + err.message);
  }
}

async function deleteAula(id) {
  if (!confirm('Excluir aula e todos os dados associados?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha na exclusão');
    alert('Aula excluída');
    loadAulas();
  } catch (err) {
    alert('Erro ao excluir aula: ' + err.message);
  }
}

async function verDetalhesAula(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/admin/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar detalhes');
    const { session, participants } = await res.json();

    const dateStart = new Date(session.date_start).toLocaleString('pt-BR');
    const dateEnd = new Date(session.date_end).toLocaleString('pt-BR');

    let html = `
      <p><strong>Aula:</strong> ${session.class_name}</p>
      <p><strong>Início:</strong> ${dateStart}</p>
      <p><strong>Fim:</strong> ${dateEnd}</p>
      <p><strong>Duração:</strong> ${session.duration_minutes} min</p>
      <h3>Participantes (${participants.length})</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <tr style="background:#222;">
          <th style="padding:8px;">Nome</th>
          <th style="padding:8px;">Calorias</th>
          <th style="padding:8px;">Queima PTS</th>
          <th style="padding:8px;">VO2 seg</th>
          <th style="padding:8px;">TRIMP</th>
          <th style="padding:8px;">EPOC</th>
          <th style="padding:8px;">Min Red</th>
        </tr>
    `;

    participants.forEach(p => {
      html += `
        <tr>
          <td style="padding:8px; border-top:1px solid #333;">${p.name}</td>
          <td style="padding:8px; border-top:1px solid #333;">${p.calories_total || 0}</td>
          <td style="padding:8px; border-top:1px solid #333;">${p.queima_points || 0}</td>
          <td style="padding:8px; border-top:1px solid #333;">${p.vo2_time_seconds || 0}</td>
          <td style="padding:8px; border-top:1px solid #333;">${p.trimp_total || 0}</td>
          <td style="padding:8px; border-top:1px solid #333;">${p.epoc_estimated || 0}</td>
          <td style="padding:8px; border-top:1px solid #333;">${p.min_red || 0}</td>
        </tr>
      `;
    });

    html += '</table>';

    document.getElementById('modalTitle').textContent = `Detalhes da Aula #${id}`;
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('detailsModal').style.display = 'flex';
  } catch (err) {
    alert('Erro ao carregar detalhes: ' + err.message);
  }
}

// Editar aluno (simples por enquanto - pode expandir depois)
function editAluno(id) {
  alert(`Editar aluno ID ${id} - funcionalidade em desenvolvimento. Use o cadastro principal por enquanto.`);
  // Futuro: abrir modal com form + PUT
}

// Inicializa
document.addEventListener('DOMContentLoaded', () => {
  loadAlunos();
  loadAulas();
});