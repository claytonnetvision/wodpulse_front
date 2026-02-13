// Arquivo: admin.js (VERSÃO FINAL CORRIGIDA E COMPLETA)

const API_BASE_URL = 'https://wodpulse-back.onrender.com';
const token = localStorage.getItem('wodpulse_token' );

// Função principal que roda ao carregar a página
async function initializeAdminPanel() {
    if (!token) {
        alert('Acesso negado. Faça o login como Super Admin.');
        window.location.href = 'dashboard-login.html';
        return;
    }

    // Carrega todos os dados usando as rotas de Super Admin
    await loadBoxes();
    await loadUsers();
    await loadAllAlunos();
    await loadAllAulas();
}

// --- FUNÇÕES DE SUPER ADMIN ---

async function loadBoxes() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/superadmin/all-boxes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 403) throw new Error('Você não tem permissão de Super Admin.');
        if (!res.ok) throw new Error('Falha ao carregar boxes.');
        const boxes = await res.json();
        const tbody = document.querySelector('#boxesTable tbody');
        const select = document.getElementById('userBoxId');
        tbody.innerHTML = '';
        select.innerHTML = '<option value="">Selecione um Box para o novo usuário</option>';
        boxes.forEach(box => {
            tbody.innerHTML += `
                <tr>
                    <td>${box.id}</td>
                    <td>${box.name}</td>
                    <td>${box.slug}</td>
                    <td>${box.active ? 'Sim' : 'Não'}</td>
                    <td><button class="btn-admin btn-delete" onclick="deleteBox(${box.id}, '${box.name}')">Excluir</button></td>
                </tr>`;
            select.innerHTML += `<option value="${box.id}">${box.name} (ID: ${box.id})</option>`;
        });
    } catch (err) {
        handleAuthError(err);
    }
}

async function loadUsers() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/superadmin/all-users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 403) throw new Error('Você não tem permissão de Super Admin.');
        if (!res.ok) throw new Error('Falha ao carregar usuários.');
        const users = await res.json();
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        users.forEach(user => {
            tbody.innerHTML += `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.role}</td>
                    <td>${user.box_id}</td>
                    <td>
                        <button class="btn-admin btn-edit" onclick="changePassword(${user.id}, '${user.username}')">Alterar Senha</button>
                        <button class="btn-admin btn-delete" onclick="deleteUser(${user.id}, '${user.username}')">Excluir</button>
                    </td>
                </tr>`;
        });
    } catch (err) {
        handleAuthError(err);
    }
}

async function createBox() {
    const name = document.getElementById('boxName').value;
    const slug = document.getElementById('boxSlug').value;
    if (!name || !slug) return alert('Preencha o nome e o slug do box.');
    try {
        const res = await fetch(`${API_BASE_URL}/api/superadmin/create-box`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, slug })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar box.');
        alert(data.message);
        document.getElementById('boxName').value = '';
        document.getElementById('boxSlug').value = '';
        loadBoxes();
    } catch (err) {
        handleAuthError(err);
    }
}

async function createUser() {
    const box_id = document.getElementById('userBoxId').value;
    const username = document.getElementById('userName').value;
    const password = document.getElementById('userPassword').value;
    if (!box_id || !username || !password) return alert('Preencha todos os campos para criar o usuário.');
    try {
        const res = await fetch(`${API_BASE_URL}/api/superadmin/create-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ box_id, username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário.');
        alert(data.message);
        document.getElementById('userName').value = '';
        document.getElementById('userPassword').value = '';
        loadUsers();
    } catch (err) {
        handleAuthError(err);
    }
}

async function changePassword(userId, username) {
    const new_password = prompt(`Digite a NOVA senha para o usuário "${username}":`);
    if (!new_password) return alert('Alteração de senha cancelada.');
    try {
        const res = await fetch(`${API_BASE_URL}/api/superadmin/change-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ user_id: userId, new_password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha.');
        alert(data.message);
    } catch (err) {
        handleAuthError(err);
    }
}

async function deleteBox(boxId, boxName) {
    if (!confirm(`ATENÇÃO!\n\nVocê está prestes a excluir o box "${boxName}" (ID: ${boxId}).\n\nISSO APAGARÁ O BOX, TODOS OS SEUS USUÁRIOS ADMIN, TODOS OS ALUNOS E TODAS AS AULAS ASSOCIADAS A ELE.\n\nEsta ação é irreversível. Deseja continuar?`)) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/superadmin/delete-box/${boxId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao excluir box.');
        alert(data.message);
        loadBoxes();
        loadUsers();
        loadAllAlunos();
        loadAllAulas();
    } catch (err) {
        handleAuthError(err);
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`Tem certeza que deseja excluir o usuário admin "${username}" (ID: ${userId})?`)) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/superadmin/delete-user/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao excluir usuário.');
        alert(data.message);
        loadUsers();
    } catch (err) {
        handleAuthError(err);
    }
}

// --- FUNÇÕES DE VISUALIZAÇÃO GERAL (ADAPTADAS) ---

async function loadAllAlunos() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/superadmin/all-participants`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Falha ao carregar alunos');
    const data = await res.json();
    const tbody = document.querySelector('#alunosTable tbody');
    tbody.innerHTML = '';
    data.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.box_id}</td>
        <td>${p.name}</td>
        <td>${p.email || '-'}</td>
        <td>${p.device_name ? p.device_name : (p.device_id ? 'ID salvo' : 'Sem pulseira')}</td>
        <td>
          <button class="btn-admin btn-edit" onclick="alert('Edição de aluno em desenvolvimento.')">Editar</button>
          <button class="btn-admin btn-delete" onclick="deleteAluno(${p.id})">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    handleAuthError(err);
  }
}

async function loadAllAulas() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/superadmin/all-sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Falha ao carregar aulas - status: ' + res.status);
    const sessions = await res.json();
    const tbody = document.querySelector('#aulasTable tbody');
    tbody.innerHTML = '';
    sessions.forEach(s => {
      const date = new Date(s.date_start).toLocaleString('pt-BR');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="select-aula" data-id="${s.id}"></td>
        <td>${s.id}</td>
        <td>${s.box_id}</td>
        <td>${s.class_name}</td>
        <td>${date}</td>
        <td>${s.participant_count || 0}</td>
        <td>
          <button class="btn-admin btn-details" onclick="verDetalhesAula(${s.id})">Detalhes</button>
          <button class="btn-admin btn-delete" onclick="deleteAula(${s.id})">Excluir</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    handleAuthError(err);
  }
}

async function deleteSelectedAulas() {
  const checkboxes = document.querySelectorAll('.select-aula:checked');
  if (checkboxes.length === 0) return alert('Nenhuma aula selecionada.');
  if (!confirm(`Tem certeza que deseja excluir ${checkboxes.length} aula(s)?`)) return;

  for (const cb of checkboxes) {
    await deleteAula(cb.dataset.id, true);
  }
  alert('Exclusão em massa concluída!');
  loadAllAulas();
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll').checked;
  document.querySelectorAll('.select-aula').forEach(cb => cb.checked = selectAll);
}

async function deleteAluno(id) {
  if (!confirm('Excluir aluno permanentemente? Isso remove também histórico associado.')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/superadmin/delete-participant/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Falha na exclusão');
    alert('Aluno excluído com sucesso');
    loadAllAlunos();
  } catch (err) {
    handleAuthError(err);
  }
}

async function deleteAula(id, massDelete = false) {
  if (!massDelete && !confirm('Excluir aula e todos os dados de participantes nela?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/superadmin/delete-session/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Falha na exclusão');
    if (!massDelete) {
        alert('Aula excluída com sucesso');
        loadAllAulas();
    }
  } catch (err) {
    handleAuthError(err);
  }
}

async function verDetalhesAula(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/superadmin/session-details/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Falha ao carregar detalhes - status: ' + res.status);
    const { session, participants } = await res.json();
    const dateStart = new Date(session.date_start).toLocaleString('pt-BR');
    
    let html = `
      <p><strong>Aula:</strong> ${session.class_name} (Box ID: ${session.box_id})</p>
      <p><strong>Início:</strong> ${dateStart}</p>
      <h3>Participantes (${participants.length})</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.95rem;">
        <tr style="background:#222;">
          <th style="padding:8px;">Nome</th>
          <th style="padding:8px;">Calorias</th>
          <th style="padding:8px;">Queima PTS</th>
          <th style="padding:8px;">TRIMP</th>
        </tr>
    `;

    participants.forEach(p => {
      html += `
        <tr>
          <td style="padding:8px; border-top:1px solid #333;">${p.name}</td>
          <td style="padding:8px; border-top:1px solid #333;">${p.calories_total || 0}</td>
          <td style="padding:8px; border-top:1px solid #333;">${p.queima_points || 0}</td>
          <td style="padding:8px; border-top:1px solid #333;">${p.trimp_total || 0}</td>
        </tr>
      `;
    });

    html += '</table>';

    document.getElementById('modalTitle').textContent = `Detalhes da Aula #${id}`;
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('detailsModal').style.display = 'flex';
  } catch (err) {
    handleAuthError(err);
  }
}

// FUNÇÃO AUXILIAR PARA TRATAR ERROS DE AUTENTICAÇÃO
function handleAuthError(err) {
    alert('Erro: ' + err.message);
    if (err.message.includes('permissão') || err.message.includes('403')) {
        localStorage.removeItem('wodpulse_token');
        localStorage.removeItem('wodpulse_box');
        window.location.href = 'dashboard-login.html';
    }
}

// Inicializa o painel
document.addEventListener('DOMContentLoaded', initializeAdminPanel);
