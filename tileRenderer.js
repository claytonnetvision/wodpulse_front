// tileRenderer.js - Layout final (100% igual à imagem + responsivo por quantidade de pessoas)
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

        // Zonas e cores
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

        const hasSignal = p.connected && p.hr > 0;
        const bpmDisplay = hasSignal ? p.hr : '--';
        const zoneDisplay = hasSignal ? `ZONA ${zoneName} (${percent}%)` : 'SEM SINAL';
        const zoneLabelColor = hasSignal ? zoneColor : '#ffeb3b';

        // Foto do aluno
        // Primeiro tenta foto real salva no banco (base64 string em p.photo)
        // Se não tiver, usa Pravatar como placeholder
        let avatarUrl = `https://i.pravatar.cc/300?u=${p.name.toLowerCase().replace(/\s+/g, '-')}`;
        if (p.photo) {
            avatarUrl = `data:image;base64,${p.photo}`; // genérico – suporta png e jpeg sem quebrar
        }

        const tile = document.createElement('div');
        tile.className = `tile ${index === 0 ? 'leader' : ''} ${!p.connected ? 'disconnected' : ''} ${isInactive ? 'inactive-alert' : ''} ${isRedAlert ? 'red-alert-blink' : ''}`;

        tile.innerHTML = `
            <div class="profile-header">
                <div class="avatar-container">
                    <img src="${avatarUrl}" alt="${p.name}" class="avatar">
                    <div class="rank-badge">#${index + 1}</div>
                </div>
                <div class="user-info">
                    <div class="name">${p.name.toUpperCase()}</div>
                    ${p.deviceName ? `<div class="device"><span style="color:#00BCD4; margin-right:8px;">📊</span>${p.deviceName}</div>` : ''}
                </div>
            </div>

            <div class="main-stats">
                <div class="bpm" style="color: ${hasSignal ? '#ffffff' : '#aaaaaa'};">
                    ${bpmDisplay}<span>BPM</span>
                </div>
                <div class="zone-label" style="color: ${zoneLabelColor};">${zoneDisplay}</div>
            </div>

            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%;"></div>
            </div>

            <div class="grid-stats">
                <div class="stat-box">
                    <div class="stat-label">PONTOS</div>
                    <div class="stat-value" style="color: var(--orange);">
                        ${p.queimaPoints ? p.queimaPoints.toFixed(2) : '0.00'}
                    </div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">CALORIAS</div>
                    <div class="stat-value" style="color: var(--blue);">
                        ${Math.round(p.calories || 0)}
                    </div>
                </div>
            </div>

            ${p.vo2TimeSeconds > 0 ? `
                <div class="vo2-badge">
                    VO2 TIME: ${formatTime(Math.round(p.vo2TimeSeconds))}
                </div>
            ` : ''}

            <div class="epoc">
                EPOC: +<strong>${Math.round(p.epocEstimated || 0)}</strong> kcal
            </div>

            ${isInactive ? `
                <div style="text-align:center; color:#ffeb3b; margin-top:10px; font-size:0.9rem; font-weight:bold;">
                    ⚠️ SEM SINAL
                </div>
            ` : ''}
        `;

        container.appendChild(tile);
    });

    // ===== RESPONSIVIDADE POR QUANTIDADE DE PESSOAS =====
    const tileCount = sorted.length;

    // Remove classes antigas de contagem
    container.classList.remove(...Array.from(container.classList).filter(c => c.startsWith('count-')));

    // Adiciona a classe correta
    if (tileCount === 1) {
        container.classList.add('count-1');
    } else if (tileCount === 2) {
        container.classList.add('count-2');
    } else if (tileCount <= 4) {
        container.classList.add('count-3-4');
    } else {
        container.classList.add('count-5plus');
    }
}