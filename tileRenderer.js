// tileRenderer.js - Layout novo (baseado no seu HTML desejado)
function renderTiles() {
    const container = document.getElementById('participants');
    if (!container) return;

    const activeOnScreen = participants.filter(p => 
        activeParticipants.includes(p.id) && (p.connected || (p.hr > 0))
    );
    
    const sorted = activeOnScreen.sort((a, b) => 
        (b.queimaPoints || 0) - (a.queimaPoints || 0)
    );

    container.innerHTML = '';
    const now = Date.now();

    sorted.forEach((p, index) => {
        let percent = 0;
        if (p.maxHR && p.hr > 0) {
            percent = Math.min(Math.max(Math.round((p.hr / p.maxHR) * 100), 0), 100);
        }

        // Definição das zonas (padrão comum de FC)
        let zoneName = 'CINZA';
        let zoneColor = '#aaaaaa';
        if (percent >= 90) {
            zoneName = 'VERMELHA';
            zoneColor = '#FF1744';
        } else if (percent >= 80) {
            zoneName = 'LARANJA';
            zoneColor = '#FF5722';
        } else if (percent >= 70) {
            zoneName = 'AMARELA';
            zoneColor = '#FF9800';
        } else if (percent >= 60) {
            zoneName = 'VERDE';
            zoneColor = '#4CAF50';
        } else if (percent >= 50) {
            zoneName = 'AZUL';
            zoneColor = '#2196F3';
        }

        const isInactive = p.connected && p.lastUpdate && (now - p.lastUpdate > 15000);
        const isRedAlert = p.redStartTime && (now - p.redStartTime > 30000);
        const vo2ActiveAndCounting = p.vo2ZoneActive && p.vo2TimeSeconds > 0;

        const hasSignal = p.connected && p.hr > 0;
        const bpmDisplay = hasSignal ? p.hr : '--';
        const zoneDisplay = hasSignal ? `ZONA ${zoneName} (${percent}%)` : 'SEM SINAL';

        // Foto placeholder (igual ao seu exemplo)
        const nameKey = p.name.toLowerCase().replace(/\s+/g, '');
        const avatarUrl = `https://i.pravatar.cc/300?u=${nameKey}`;

        const tile = document.createElement('div');
        tile.className = `tile 
            ${index === 0 ? 'leader' : ''} 
            ${!p.connected ? 'disconnected' : ''} 
            ${isInactive ? 'inactive-alert' : ''} 
            ${isRedAlert ? 'red-alert-blink' : ''}`;

        tile.innerHTML = `
            <div class="profile-header">
                <div class="avatar-container">
                    <img src="${avatarUrl}" alt="${p.name}" class="avatar">
                    <div class="rank-badge">#${index + 1}</div>
                </div>
                <div class="user-info">
                    <div class="name">${p.name.toUpperCase()}</div>
                    ${p.deviceName ? `<div class="device">📱 ${p.deviceName}</div>` : ''}
                </div>
            </div>

            <div class="main-stats">
                <div class="bpm" style="color: ${hasSignal ? zoneColor : '#aaaaaa'};">
                    ${bpmDisplay}<span>BPM</span>
                </div>
                <div class="zone-label" style="color: ${zoneColor};">${zoneDisplay}</div>
            </div>

            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%;"></div>
            </div>

            <div class="grid-stats">
                <div class="stat-box">
                    <div class="stat-label">Pontos</div>
                    <div class="stat-value" style="color: var(--orange);">
                        ${p.queimaPoints ? p.queimaPoints.toFixed(2) : '0.00'}
                    </div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Calorias</div>
                    <div class="stat-value" style="color: var(--blue);">
                        ${Math.round(p.calories || 0)}
                    </div>
                </div>
            </div>

            ${p.vo2TimeSeconds > 0 ? `
                <div class="vo2-badge">
                    VO2 TIME: ${formatTime(Math.round(p.vo2TimeSeconds))} ${vo2ActiveAndCounting ? '↑' : ''}
                </div>
            ` : ''}

            <div class="epoc">
                EPOC estimado: +<strong>${Math.round(p.epocEstimated || 0)}</strong> kcal pós-treino
            </div>

            ${isInactive ? `
                <div style="text-align:center; color:#ffeb3b; margin-top:10px; font-size:0.9rem;">
                    ⚠️ SEM SINAL
                </div>
            ` : ''}
        `;

        container.appendChild(tile);
    });
}