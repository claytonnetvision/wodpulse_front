/**
 * tileRenderer.js - Layout Performance Pro (exato do modelo que você mandou)
 */

function renderTiles() {
    const container = document.getElementById('participants');
    if (!container) return;

    const activeOnScreen = participants.filter(p => 
        activeParticipants.includes(p.id) && (p.connected || (p.hr > 0))
    );

    const sorted = activeOnScreen.sort((a, b) => (b.queimaPoints || 0) - (a.queimaPoints || 0));
   
    container.innerHTML = '';
    const now = Date.now();

    sorted.forEach((p, index) => {
        const percent = p.maxHR ? Math.min(Math.max(Math.round((p.hr / p.maxHR) * 100), 0), 100) : 0;
        const zoneText = getZone(percent).toUpperCase();
        const isInactive = p.connected && p.lastUpdate && (now - p.lastUpdate > 15000);
        const isRedAlert = p.redStartTime && (now - p.redStartTime > 30000);

        const tile = document.createElement('div');
        tile.className = `tile ${isInactive ? 'inactive-alert' : ''} ${isRedAlert ? 'red-alert-blink' : ''} ${index === 0 ? 'leader' : ''}`;

        tile.innerHTML = `
            <style>
                :root {
                    --bg-dark: #0a0a0a;
                    --tile-bg: #1a1a1a;
                    --orange: #FF5722;
                    --green: #4CAF50;
                    --blue: #00BCD4;
                    --red: #FF1744;
                    --text-main: #ffffff;
                    --text-dim: #aaaaaa;
                }

                .tile { 
                    background: var(--tile-bg); 
                    border-radius: 32px; 
                    padding: 25px; 
                    width: 380px; 
                    box-shadow: 0 25px 50px rgba(0,0,0,0.9);
                    border: 3px solid var(--orange);
                    position: relative;
                    color: var(--text-main);
                    font-family: 'Segoe UI', Roboto, sans-serif;
                    margin: 15px;
                    display: inline-block;
                    vertical-align: top;
                }

                .profile-header {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .avatar-container {
                    position: relative;
                    width: 80px;
                    height: 80px;
                }
                .avatar {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 3px solid var(--orange);
                    background: #333;
                }
                .rank-badge {
                    position: absolute;
                    bottom: -5px;
                    right: -5px;
                    background: var(--orange);
                    color: white;
                    font-size: 0.8rem;
                    font-weight: bold;
                    padding: 4px 8px;
                    border-radius: 10px;
                    border: 2px solid var(--tile-bg);
                }
                .user-info { flex: 1; }
                .name { font-size: 2rem; font-weight: 800; text-transform: uppercase; line-height: 1; }
                .device { font-size: 0.9rem; color: var(--text-dim); margin-top: 5px; }

                .main-stats { 
                    background: rgba(255,255,255,0.03);
                    border-radius: 24px;
                    padding: 15px;
                    text-align: center;
                    margin-bottom: 20px;
                }
                .bpm { font-size: 7rem; font-weight: 900; line-height: 1; letter-spacing: -3px; }
                .bpm span { font-size: 1.5rem; color: var(--text-dim); margin-left: 5px; letter-spacing: 0; }
                .zone-label { font-size: 1.2rem; color: var(--orange); font-weight: bold; margin-top: 5px; }

                .progress-bar { height: 14px; background: #333; border-radius: 7px; overflow: hidden; margin: 15px 0; }
                .progress-fill { 
                    height: 100%; 
                    background: linear-gradient(90deg, var(--green), #FF9800, var(--red)); 
                    width: ${percent}%; 
                    transition: width 0.5s ease;
                }

                .grid-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
                .stat-box { background: rgba(255,255,255,0.05); padding: 10px; border-radius: 16px; text-align: center; }
                .stat-label { font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; margin-bottom: 3px; }
                .stat-value { font-size: 1.4rem; font-weight: bold; }

                .vo2-badge { 
                    background: rgba(255, 23, 68, 0.15); 
                    color: var(--red); 
                    padding: 12px; 
                    border-radius: 16px; 
                    text-align: center; 
                    font-weight: 800;
                    font-size: 1.3rem;
                    margin-bottom: 10px;
                }
                .epoc { text-align: center; color: #FF9800; font-size: 1rem; }
            </style>

            <div class="tile">
                <div class="profile-header">
                    <div class="avatar-container">
                        <img src="${p.photo_base64 ? 'data:image/jpeg;base64,' + p.photo_base64 : 'https://via.placeholder.com/150/333333/FFFFFF/?text=SEM+FOTO'}" alt="Foto do aluno" class="avatar">
                        <div class="rank-badge">#${index + 1}</div>
                    </div>
                    <div class="user-info">
                        <div class="name">${p.name}</div>
                        <div class="device">📱 ${p.deviceName || 'Conectado'}</div>
                    </div>
                </div>

                <div class="main-stats">
                    <div class="bpm">${p.hr || '--'}<span>BPM</span></div>
                    <div class="zone-label">ZONA ${zoneText} (${percent}%)</div>
                </div>

                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>

                <div class="grid-stats">
                    <div class="stat-box">
                        <div class="stat-label">Pontos</div>
                        <div class="stat-value" style="color: var(--orange);">${(p.queimaPoints || 0).toFixed(2)}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Calorias</div>
                        <div class="stat-value" style="color: var(--blue);">${Math.round(p.calories || 0)}</div>
                    </div>
                </div>

                ${p.vo2TimeSeconds > 0 ? `
                    <div class="vo2-badge">VO2 TIME: ${formatTime(Math.round(p.vo2TimeSeconds))}</div>
                ` : ''}

                <div class="epoc">EPOC: +<strong>${Math.round(p.epocEstimated || 0)}</strong> kcal</div>
            </div>
        `;
        
        container.appendChild(tile);
    });
}

function getZone(percent) {
    if (percent >= 90) return 'red';
    if (percent >= 80) return 'orange';
    if (percent >= 70) return 'yellow';
    if (percent >= 60) return 'blue';
    if (percent >= 50) return 'green';
    return 'gray';
}

function formatTime(s) {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}