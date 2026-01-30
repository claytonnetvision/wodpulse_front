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
    const res = await fetch(`${API_BASE_URL}/api/sessions`);
    if (!res.ok) throw new Error('Falha ao carregar aulas - status: ' + res.status);
    const { sessions } = await res.json();
    const tbody = document.querySelector('#aulasTable tbody');
    tbody.innerHTML = '';
    sessions.forEach(s => {
      const date = new Date(s.date_start).toLocaleString('pt-BR');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="select-aula" data-id="${s.id}"></td>
        <td>${s.id}</td>
        <td>${s.class_name}</td>
        <td>${date}</td>
        <td>${s.duration_minutes || '?'}</td>
        <td>${s.participant_count || 0}</td>
        <td>
          <button class="btn-admin btn-details" onclick="verDetalhesAula(${s.id})">Detalhes</button>
          <button class="btn-admin btn-delete" onclick="deleteAula(${s.id})">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert('Erro ao carregar aulas: ' + err.message + '\nVerifique se o backend está rodando e a rota /api/sessions responde.');
  }
}

// NOVA FUNÇÃO: Excluir aulas selecionadas em massa
async function deleteSelectedAulas() {
  const checkboxes = document.querySelectorAll('.select-aula:checked');
  if (checkboxes.length === 0) {
    alert('Nenhuma aula selecionada para excluir.');
    return;
  }

  if (!confirm(`Tem certeza que deseja excluir ${checkboxes.length} aula(s) selecionada(s)? Essa ação é irreversível!`)) {
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const cb of checkboxes) {
    const id = cb.dataset.id;
    try {
      const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha na exclusão');
      successCount++;
    } catch (err) {
      console.error(`Erro ao excluir aula ${id}:`, err);
      errorCount++;
    }
  }

  alert(`Exclusão concluída!\nSucesso: ${successCount}\nErros: ${errorCount}`);
  loadAulas(); // recarrega a lista
}

// NOVA FUNÇÃO: Select All checkbox
function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll').checked;
  document.querySelectorAll('.select-aula').forEach(cb => {
    cb.checked = selectAll;
  });
}

async function deleteAluno(id) {
  if (!confirm('Excluir aluno permanentemente? Isso remove também histórico associado.')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/participants/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha na exclusão');
    alert('Aluno excluído com sucesso');
    loadAlunos();
  } catch (err) {
    alert('Erro ao excluir aluno: ' + err.message);
  }
}

async function deleteAula(id) {
  if (!confirm('Excluir aula e todos os dados de participantes nela?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha na exclusão');
    alert('Aula excluída com sucesso');
    loadAulas();
  } catch (err) {
    alert('Erro ao excluir aula: ' + err.message);
  }
}

async function verDetalhesAula(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar detalhes - status: ' + res.status);
    const { session, participants } = await res.json();

    const dateStart = new Date(session.date_start).toLocaleString('pt-BR');
    const dateEnd = new Date(session.date_end).toLocaleString('pt-BR');

    let html = `
      <p><strong>Aula:</strong> ${session.class_name}</p>
      <p><strong>Início:</strong> ${dateStart}</p>
      <p><strong>Fim:</strong> ${dateEnd}</p>
      <p><strong>Duração:</strong> ${session.duration_minutes || '?'} min</p>
      <h3>Participantes (${participants.length})</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.95rem;">
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
    alert('Erro ao carregar detalhes da aula: ' + err.message);
  }
}

// ── EDIÇÃO REAL DE ALUNO ────────────────────────────────────────────────────────
async function editAluno(id) {
  try {
    // Busca dados atuais do aluno
    const res = await fetch(`${API_BASE_URL}/api/participants/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar dados do aluno');
    const { participant } = await res.json();

    // Cria form simples no modal
    let html = `
      <h3>Editar Aluno #${id}</h3>
      <form id="editForm" style="display:flex; flex-direction:column; gap:12px;">
        <label>Nome: <input type="text" id="editName" value="${participant.name || ''}"></label>
        <label>Idade: <input type="number" id="editAge" value="${participant.age || ''}"></label>
        <label>Peso (kg): <input type="number" step="0.1" id="editWeight" value="${participant.weight || ''}"></label>
        <label>Altura (cm): <input type="number" id="editHeight" value="${participant.height_cm || ''}"></label>
        <label>Gênero: 
          <select id="editGender">
            <option value="M" ${participant.gender === 'M' ? 'selected' : ''}>Masculino</option>
            <option value="F" ${participant.gender === 'F' ? 'selected' : ''}>Feminino</option>
            <option value="O" ${participant.gender === 'O' ? 'selected' : ''}>Outro</option>
          </select>
        </label>
        <label>Email: <input type="email" id="editEmail" value="${participant.email || ''}"></label>
        <label>
          <input type="checkbox" id="editUseTanaka" ${participant.use_tanaka ? 'checked' : ''}>
          Usar fórmula Tanaka
        </label>
        <button type="button" onclick="salvarEdicao(${id})" style="padding:12px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer;">Salvar Alterações</button>
      </form>
    `;

    document.getElementById('modalTitle').textContent = `Editar Aluno #${id}`;
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('detailsModal').style.display = 'flex';
  } catch (err) {
    alert('Erro ao carregar dados para edição: ' + err.message);
  }
}

async function salvarEdicao(id) {
  const data = {
    name: document.getElementById('editName').value.trim(),
    age: parseInt(document.getElementById('editAge').value) || null,
    weight: parseFloat(document.getElementById('editWeight').value) || null,
    height_cm: parseInt(document.getElementById('editHeight').value) || null,
    gender: document.getElementById('editGender').value || null,
    email: document.getElementById('editEmail').value.trim() || null,
    use_tanaka: document.getElementById('editUseTanaka').checked
  };

  if (!data.name) {
    alert('O nome é obrigatório!');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/participants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao salvar');
    }

    alert('Aluno atualizado com sucesso!');
    document.getElementById('detailsModal').style.display = 'none';
    loadAlunos(); // recarrega lista
  } catch (err) {
    alert('Erro ao salvar alterações: ' + err.message);
  }
}

// Inicializa
document.addEventListener('DOMContentLoaded', () => {
  loadAlunos();
  loadAulas();
});