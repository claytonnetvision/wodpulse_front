const API_BASE_URL = 'https://wodpulse-back.onrender.com';
const token = localStorage.getItem('wodpulse_social_token');
const studentId = localStorage.getItem('studentId');

if (!token) {
    window.location.href = 'login.html';
}

let userData = null;
let currentSection = 'feed';
let allFriends = [];
let candidates = [];
let currentCandidateIndex = 0;
let selectedPhotoData = null;

async function loadProfileData() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        userData = await res.json();
        
        document.getElementById('userName').textContent = userData.name;
        document.getElementById('userPhotoLarge').src = formatPhoto(userData.photo);
        document.getElementById('userBio').textContent = userData.bio || 'Atleta WODPulse';
        
        document.getElementById('stat-challenges').textContent = userData.stats.challenges || 0;
        document.getElementById('stat-likes').textContent = userData.stats.likes || 0;
        document.getElementById('stat-matches').textContent = userData.stats.matches || 0;

        const progressLink = document.getElementById('progressLink');
        if (progressLink) progressLink.href = `meu-progresso.html?id=${studentId}`;

        loadTrainingStats();
        showSection('feed');
        loadFriends();
        loadPendingRequests();
        loadMatchCandidates();
    } catch (err) {
        console.error('Erro ao carregar perfil:', err);
    }
}

async function loadTrainingStats() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/sessions/historico?alunoId=${studentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const treinos = await res.json();
        
        if (treinos.length > 0) {
            const totalCal = treinos.reduce((s, h) => s + (parseFloat(h.calories_total) || 0), 0);
            const maxHr = Math.max(...treinos.map(h => parseFloat(h.max_hr_reached) || 0), 0);
            const totalVo2 = treinos.reduce((s, h) => s + (parseFloat(h.vo2_time_minutes) || 0), 0);

            const statAulas = document.getElementById('stat-aulas');
            const statCalorias = document.getElementById('stat-calorias');
            const statMedia = document.getElementById('stat-media');
            const statFcMax = document.getElementById('stat-fc-max');
            const statVo2 = document.getElementById('stat-vo2');

            if (statAulas) statAulas.textContent = treinos.length;
            if (statCalorias) statCalorias.textContent = Math.round(totalCal) + ' kcal';
            if (statMedia) statMedia.textContent = Math.round(totalCal / treinos.length) + ' kcal';
            if (statFcMax) statFcMax.textContent = Math.round(maxHr) + ' bpm';
            if (statVo2) statVo2.textContent = Math.round(totalVo2) + ' min';

            const frases = [
                "Você está voando! Mantenha a constância.",
                "O treino de hoje é o resultado de amanhã.",
                "Sua média de calorias está excelente!",
                "Que tal desafiar um amigo hoje?",
                "A disciplina é a ponte entre metas e realizações."
            ];
            const motivationalMsg = document.getElementById('motivational-msg');
            if (motivationalMsg) motivationalMsg.textContent = frases[Math.floor(Math.random() * frases.length)];
        }
    } catch (err) {}
}

function formatPhoto(photo) {
    if (!photo) return 'https://www.infrapower.com.br/logo-v6.png';
    if (photo.startsWith('data:image') || photo.startsWith('http')) return photo;
    return `data:image/jpeg;base64,${photo}`;
}

function showSection(section) {
    currentSection = section;
    const list = document.getElementById('dynamic-list');
    const title = document.getElementById('content-title');
    const postArea = document.getElementById('post-area');
    
    if (list) list.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando...</p>';
    if (postArea) postArea.style.display = (section === 'feed' || section === 'scraps') ? 'block' : 'none';

    if (section === 'feed') {
        if (title) title.textContent = 'Feed de Notícias';
        loadFeed();
    } else if (section === 'scraps') {
        if (title) title.textContent = 'Mural de Recados (Scraps)';
        loadScraps();
    } else if (section === 'photos') {
        if (title) title.textContent = 'Minhas Fotos';
        openPhotosModal();
    }
}

async function loadFeed() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/feed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const posts = await res.json();
        const list = document.getElementById('dynamic-list');
        
        if (!list) return;
        if (posts.length === 0) {
            list.innerHTML = '<p style="text-align: center; padding: 20px;">Nenhuma postagem ainda.</p>';
            return;
        }

        list.innerHTML = posts.map(p => `
            <div class="feed-item">
                <div class="feed-header">
                    <div class="feed-header-left">
                        <img src="${formatPhoto(p.user_photo)}" class="feed-photo-small" onclick="openProfile(${p.user_id})">
                        <div class="feed-info">
                            <span class="feed-author" onclick="openProfile(${p.user_id})">${p.user_name}</span>
                            <div class="feed-time">${new Date(p.created_at).toLocaleString()}</div>
                        </div>
                    </div>
                    ${p.user_id == studentId ? `<button class="delete-btn" onclick="deletePost(${p.id})"><i class="fas fa-trash"></i></button>` : ''}
                </div>
                <div class="feed-content">${p.content}</div>
                ${p.type === 'photo' ? `<img src="${formatPhoto(p.content)}" class="feed-image">` : ''}
                <div class="feed-reactions">
                    <div class="reaction-buttons">
                        <button class="reaction-btn ${p.user_liked ? 'active' : ''}" onclick="toggleLike(${p.id})">
                            <i class="fa${p.user_liked ? 's' : 'r'} fa-heart"></i> ${p.likes_count || 0}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {}
}

async function createPost() {
    const postInput = document.getElementById('postInput');
    const postPrivacy = document.getElementById('postPrivacy');
    if (!postInput) return;

    const content = postInput.value;
    const privacy = postPrivacy ? postPrivacy.value : 'public';
    
    if (!content && !selectedPhotoData) return;

    const body = {
        content: selectedPhotoData || content,
        type: selectedPhotoData ? 'photo' : 'feed',
        privacy: privacy
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/social/posts`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            postInput.value = '';
            removePreview();
            showSection('feed');
        }
    } catch (err) {}
}

async function deletePost(postId) {
    if (!confirm('Excluir postagem?')) return;
    try {
        await fetch(`${API_BASE_URL}/api/social/posts/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadFeed();
    } catch (err) {}
}

async function toggleLike(postId) {
    try {
        await fetch(`${API_BASE_URL}/api/social/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadFeed();
    } catch (err) {}
}

async function loadScraps() {
    const list = document.getElementById('dynamic-list');
    if (list) list.innerHTML = '<p style="text-align: center; padding: 20px;">Mural em desenvolvimento...</p>';
}

async function uploadAlbumPhoto() {
    const fileInput = document.getElementById('albumPhotoInput');
    const photoDescription = document.getElementById('photoDescription');
    if (!fileInput || !fileInput.files[0]) return;

    const description = photoDescription ? photoDescription.value : '';
    const base64 = await fileToBase64(fileInput.files[0]);
    const body = {
        photoData: base64,
        description: description
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/social/photos/upload`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            alert('Foto salva no álbum!');
            if (photoDescription) photoDescription.value = '';
            loadAlbumPhotos();
        }
    } catch (err) { alert('Erro ao salvar foto'); }
}

async function loadAlbumPhotos() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/photos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const photos = await res.json();
        const grid = document.getElementById('albumPhotosGrid');
        
        if (!grid) return;
        if (photos.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; color: #888;">Nenhuma foto ainda.</p>';
            return;
        }

        grid.innerHTML = photos.map(photo => `
            <div style="text-align: center;">
                <img src="${photo.photo_data}" style="width: 100%; height: 150px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px;">
                <p style="font-size: 10px; margin-top: 5px; color: #666;">${photo.description || 'Sem descrição'}</p>
                <button class="btn-icon" onclick="postPhotoToFeed(${photo.id})" style="margin-top: 5px; font-size: 10px;">Postar no Feed</button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Erro ao carregar fotos:', err);
    }
}

async function postPhotoToFeed(photoId) {
    const caption = prompt('Adicione uma legenda (opcional):');
    const privacy = prompt('Privacidade (public/friends/private):', 'public');

    try {
        const res = await fetch(`${API_BASE_URL}/api/social/photos/${photoId}/post-to-feed`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ caption: caption || '', privacy })
        });

        if (res.ok) {
            alert('Foto postada no feed!');
            closePhotosModal();
            showSection('feed');
        }
    } catch (err) {
        alert('Erro ao postar foto');
    }
}

let searchTimeout;
const searchUsersInput = document.getElementById('searchUsersInput');
if (searchUsersInput) {
    searchUsersInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) {
            const searchResults = document.getElementById('searchResults');
            if (searchResults) searchResults.innerHTML = '';
            return;
        }
        searchTimeout = setTimeout(() => searchUsers(query), 500);
    });
}

async function searchUsers(query) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/search-users?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const container = document.getElementById('searchResults');
        if (!container) return;
        if (data.users.length === 0) {
            container.innerHTML = '<p style="color:#888;">Nenhum atleta encontrado.</p>';
            return;
        }
        container.innerHTML = data.users.map(user => `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 5px; border-bottom: 1px solid #eee;">
                <img src="${formatPhoto(user.photo)}" style="width: 30px; height: 30px; object-fit: cover;">
                <div style="flex: 1;">
                    <strong class="blue" style="cursor:pointer" onclick="openProfile(${user.id})">${user.name}</strong>
                    <div style="font-size: 10px; color: #999;">Box: ${user.box_id || '--'}</div>
                </div>
                <button onclick="requestFriendship(${user.id})" style="font-size: 10px;">Add</button>
            </div>
        `).join('');
    } catch (err) {}
}

async function requestFriendship(targetId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/friend/request`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetId })
        });
        const data = await res.json();
        alert(data.message || 'Pedido enviado!');
    } catch (err) { alert('Erro ao enviar pedido'); }
}

async function loadFriends() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/friends`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        allFriends = data.confirmedFriends || [];
        
        const friendsCount = document.getElementById('friendsCount');
        if (friendsCount) friendsCount.textContent = `(${allFriends.length})`;
        
        const grid = document.getElementById('friendsGrid');
        if (!grid) return;
        grid.innerHTML = allFriends.slice(0, 9).map(f => `
            <div class="friend-item" onclick="openProfile(${f.id})" style="cursor:pointer; text-align:center;">
                <img src="${formatPhoto(f.photo)}" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px;">
                <span style="font-size:10px; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.name.split(' ')[0]}</span>
            </div>
        `).join('');
    } catch (err) { console.error('Erro ao carregar amigos:', err); }
}

async function loadPendingRequests() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/friends`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const container = document.getElementById('pendingRequests');
        
        if (!container) return;
        if (data.pendingRequests.length === 0) {
            container.innerHTML = '<p style="font-size: 11px; color: #888;">Nenhum pedido.</p>';
            return;
        }

        container.innerHTML = data.pendingRequests.map(req => `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 11px;">
                <img src="${formatPhoto(req.photo)}" style="width: 25px; height: 25px; border-radius: 50%;">
                <span style="flex: 1;">${req.name}</span>
                <button onclick="respondFriend(${req.id}, 'accept')" style="background: var(--secondary); color: white; border: none; padding: 2px 5px; cursor: pointer; border-radius:4px;">Aceitar</button>
            </div>
        `).join('');
    } catch (err) {}
}

async function respondFriend(requesterId, action) {
    try {
        await fetch(`${API_BASE_URL}/api/social/friend/respond`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requesterId, action })
        });
        loadFriends();
        loadPendingRequests();
        loadNotifications();
    } catch (err) {}
}

async function loadMatchCandidates() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/candidates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        candidates = await res.json();
        displayCandidate();
    } catch (err) {}
}

function displayCandidate() {
    const container = document.getElementById('matchCandidate');
    if (!container) return;
    if (candidates.length === 0 || currentCandidateIndex >= candidates.length) {
        container.innerHTML = '<p style="color: #888; padding: 20px;">Buscando atletas...</p>';
        return;
    }

    const c = candidates[currentCandidateIndex];
    container.innerHTML = `
        <img src="${formatPhoto(c.photo)}" class="match-photo-small" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
        <div style="font-weight: bold; margin-top:10px;">${c.name}</div>
        <div style="font-size: 10px; color: #666; margin-bottom: 10px;">Box: ${c.box_id || '--'}</div>
        <div class="match-actions-mini" style="display:flex; justify-content:center; gap:10px;">
            <button class="btn-icon" onclick="nextCandidate()" style="background:#f5f5f5; color:#999; border-radius:50%; width:40px; height:40px;"><i class="fas fa-times"></i></button>
            <button class="btn-icon" onclick="likeCandidate(${c.id})" style="background:#ffebee; color:#ff4081; border-radius:50%; width:40px; height:40px;"><i class="fas fa-heart"></i></button>
        </div>
    `;
}

async function likeCandidate(targetId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/match/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetId })
        });
        const data = await res.json();
        if (data.match) alert('MATCH! Vocês agora podem conversar!');
        nextCandidate();
    } catch (err) {}
}

function nextCandidate() {
    currentCandidateIndex++;
    displayCandidate();
}

function openProfile(id) {
    window.location.href = `perfil-participante.html?id=${id}`;
}

function openEditModal() {
    const bioInput = document.getElementById('bioInput');
    const editModal = document.getElementById('editModal');
    if (bioInput) bioInput.value = userData.bio || '';
    if (editModal) editModal.style.display = 'flex';
}

function closeEditModal() {
    const editModal = document.getElementById('editModal');
    if (editModal) editModal.style.display = 'none';
}

async function saveProfile() {
    const bioInput = document.getElementById('bioInput');
    if (!bioInput) return;
    const bio = bioInput.value;
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/profile`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ bio })
        });
        if (res.ok) {
            closeEditModal();
            loadProfileData();
        }
    } catch (err) {}
}

function openPhotosModal() {
    const photosModal = document.getElementById('photosModal');
    if (photosModal) {
        photosModal.style.display = 'flex';
        loadAlbumPhotos();
    }
}

function closePhotosModal() {
    const photosModal = document.getElementById('photosModal');
    if (photosModal) photosModal.style.display = 'none';
}

function toggleNotifications() {
    const modal = document.getElementById('notificationsModal');
    if (!modal) return;
    if (modal.style.display === 'flex') {
        closeNotificationsModal();
    } else {
        modal.style.display = 'flex';
        loadNotifications();
    }
}

function closeNotificationsModal() {
    const notificationsModal = document.getElementById('notificationsModal');
    if (notificationsModal) notificationsModal.style.display = 'none';
}

async function loadNotifications() {
    const list = document.getElementById('notificationsList');
    if (!list) return;
    list.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando...</p>';

    try {
        const resFriends = await fetch(`${API_BASE_URL}/api/social/friends`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataFriends = await resFriends.json();

        let challengeNotifications = [];
        try {
            const resChallenges = await fetch(`${API_BASE_URL}/api/challenges/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resChallenges.ok) {
                challengeNotifications = await resChallenges.json();
            }
        } catch (e) { console.log('Rota de desafios ainda não ativa'); }

        let html = '';
        const totalNotifications = dataFriends.pendingRequests.length + challengeNotifications.length;

        if (totalNotifications === 0) {
            html = '<p style="text-align: center; color: #888; padding: 20px;">Nenhuma notificação nova.</p>';
        } else {
            html += dataFriends.pendingRequests.map(req => `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #eee;">
                    <img src="${formatPhoto(req.photo)}" style="width: 35px; height: 35px; border-radius: 50%;">
                    <div style="flex: 1;">
                        <strong>${req.name}</strong> quer ser seu amigo!
                    </div>
                    <button onclick="respondFriend(${req.id}, 'accept')" class="btn-post" style="font-size: 10px;">Aceitar</button>
                </div>
            `).join('');

            html += challengeNotifications.map(notif => `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #eee; background: #fff9c4;">
                    <div style="font-size: 20px;">🏆</div>
                    <div style="flex: 1;">
                        <strong>${notif.creator_name}</strong> te desafiou: <em>"${notif.title}"</em>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="respondChallenge(${notif.challenge_id}, 'accepted')" class="btn-post" style="font-size: 10px;">Aceitar</button>
                        <button onclick="respondChallenge(${notif.challenge_id}, 'declined')" style="font-size: 10px; background: #ccc; border: none; padding: 5px;">Recusar</button>
                    </div>
                </div>
            `).join('');
        }

        list.innerHTML = html;
        updateNotificationBadge(totalNotifications);
    } catch (err) {
        list.innerHTML = '<p style="text-align: center; color: red;">Erro ao carregar.</p>';
    }
}

async function respondChallenge(challengeId, action) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/challenges/${challengeId}/respond`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        if (res.ok) {
            alert(action === 'accepted' ? 'Desafio aceito! Prepare-se!' : 'Desafio recusado.');
            loadNotifications();
        }
    } catch (err) { alert('Erro ao responder desafio'); }
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

function triggerPhotoUpload() {
    const photoInput = document.getElementById('photoInput');
    if (photoInput) photoInput.click();
}

async function previewPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    selectedPhotoData = await fileToBase64(file);
    const photoPreview = document.getElementById('photoPreview');
    if (photoPreview) {
        photoPreview.innerHTML = `
            <div style="position: relative; display: inline-block;">
                <img src="${selectedPhotoData}" style="max-width: 100px; border: 1px solid #ccc;">
                <button onclick="removePreview()" style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer;">×</button>
            </div>
        `;
    }
}

function removePreview() {
    selectedPhotoData = null;
    const photoPreview = document.getElementById('photoPreview');
    const photoInput = document.getElementById('photoInput');
    if (photoPreview) photoPreview.innerHTML = '';
    if (photoInput) photoInput.value = '';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function handleMentionInput(event) {
    const textarea = event.target;
    const text = textarea.value;
    const cursorPosition = textarea.selectionStart;
    const lastAtPos = text.lastIndexOf('@', cursorPosition - 1);

    if (lastAtPos !== -1 && (lastAtPos === 0 || text[lastAtPos - 1] === ' ' || text[lastAtPos - 1] === '\n')) {
        const query = text.substring(lastAtPos + 1, cursorPosition);
        if (query.length >= 1) {
            showMentionSuggestions(query, lastAtPos);
        } else {
            hideMentionSuggestions();
        }
    } else {
        hideMentionSuggestions();
    }
}

async function showMentionSuggestions(query, atPos) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/social/search-users?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const suggestions = document.getElementById('mentionSuggestions');
        
        if (!suggestions) return;
        if (data.users.length === 0) {
            hideMentionSuggestions();
            return;
        }

        suggestions.innerHTML = data.users.map(user => `
            <div class="mention-item" onclick="insertMention('${user.name}', ${atPos})">
                <img src="${formatPhoto(user.photo)}" style="width: 20px; height: 20px; border-radius: 50%; vertical-align: middle; margin-right: 5px;">
                <strong>${user.name}</strong>
            </div>
        `).join('');
        suggestions.style.display = 'block';
    } catch (err) {}
}

function hideMentionSuggestions() {
    const mentionSuggestions = document.getElementById('mentionSuggestions');
    if (mentionSuggestions) mentionSuggestions.style.display = 'none';
}

function insertMention(name, atPos) {
    const textarea = document.getElementById('postInput');
    if (!textarea) return;
    const text = textarea.value;
    const cursorPosition = textarea.selectionStart;
    const beforeAt = text.substring(0, atPos);
    const afterCursor = text.substring(cursorPosition);
    
    textarea.value = beforeAt + '@' + name + ' ' + afterCursor;
    hideMentionSuggestions();
    textarea.focus();
}

function logout() {
    localStorage.removeItem('wodpulse_social_token');
    window.location.href = 'login.html';
}

async function init() {
    await loadProfileData();
    setInterval(loadNotifications, 60000);
    loadNotifications();
}

document.addEventListener('DOMContentLoaded', init);
