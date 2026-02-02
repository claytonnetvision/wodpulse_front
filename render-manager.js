// render-manager.js - Gerenciamento de renderização de tiles, rankings e líderes
// Este módulo contém todas as funções responsáveis por atualizar a interface visual:
// - Tiles dos alunos durante a aula
// - Rankings semanais, diários e líderes da aula
// - Resumo da última aula e ranking completo

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
        let avatarUrl = `https://i.pravatar.cc/300?u=${p.name.toLowerCase().replace(/\s+/g, '-')}`;
        if (p.photo) {
            avatarUrl = `data:image;base64,${p.photo}`;
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
    // RESPONSIVIDADE POR QUANTIDADE DE PESSOAS
    const tileCount = sorted.length;
    container.classList.remove(...Array.from(container.classList).filter(c => c.startsWith('count-')));
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

function updateLeaderboard() {
    if (!participants.length) return;
    const active = participants.filter(p => activeParticipants.includes(p.id));
    if (!active.length) return;
    const l = active.reduce((a, b) => (b.queimaPoints || 0) > (a.queimaPoints || 0) ? b : a, {queimaPoints:0});
    const el = document.getElementById('leaderboard-top');
    if (el) el.textContent = `Líder Aula: ${l.name || '--'} (${l.queimaPoints.toFixed(2)} PTS)`;
}

function updateVO2Leaderboard() {
    const active = participants.filter(p => activeParticipants.includes(p.id));
    const topVO2 = active
        .filter(p => p.vo2TimeSeconds >= 60)
        .sort((a, b) => b.vo2TimeSeconds - a.vo2TimeSeconds)
        .slice(0, 5);
    let html = '<div id="vo2-ranking-block" class="ranking-block" style="background:#1e1e1e; border-radius:14px; padding:16px; margin-top:12px; border-left:6px solid #FF1744;">';
    html += '<h3 style="margin:0 0 10px 0; color:#FF1744;">🔥 TOP 5 VO2 TIME (Aula)</h3>';
    if (topVO2.length === 0) {
        html += '<div style="color:#aaa; font-size:1.3rem;">Nenhum aluno com tempo VO2 ainda</div>';
    } else {
        topVO2.forEach((p, i) => {
            html += `<div class="position-${i+1}" style="font-size:1.45rem; margin:6px 0;">
                ${i+1}º ${p.name}: <strong>${formatTime(Math.round(p.vo2TimeSeconds))}</strong>
            </div>`;
        });
    }
    html += '</div>';
    const existing = document.getElementById('vo2-ranking-block');
    if (existing) {
        existing.outerHTML = html;
    } else {
        document.getElementById('weekly-rankings')?.insertAdjacentHTML('beforeend', html);
    }
}

function renderWeeklyRankings() {
    const queimaEl = document.getElementById('queima-ranking-top5');
    const caloriasEl = document.getElementById('calorias-ranking-top5');
    const vo2El = document.getElementById('vo2-ranking-top5');
    if (!queimaEl || !caloriasEl) return;
    const queima = Object.entries(weeklyHistory.participants)
        .map(([n, d]) => ({n, p: d.totalQueimaPontos || 0}))
        .sort((a,b)=>b.p-a.p)
        .slice(0,5);
    queimaEl.innerHTML = queima.length ? queima.map((x,i)=>`<div class="position-${i+1}">${i+1}º ${x.n}: <strong>${x.p.toFixed(2)}</strong></div>`).join('') : 'Nenhum dado ainda';
    const calorias = Object.entries(weeklyHistory.participants)
        .map(([n, d]) => ({n, c: d.totalCalorias || 0}))
        .sort((a,b)=>b.c-a.c)
        .slice(0,5);
    caloriasEl.innerHTML = calorias.length ? calorias.map((x,i)=>`<div class="position-${i+1}">${i+1}º ${x.n}: <strong>${Math.round(x.c)} kcal</strong></div>`).join('') : 'Nenhum dado ainda';
    const active = participants.filter(p => activeParticipants.includes(p.id));
    const topVO2 = active
        .filter(p => p.vo2TimeSeconds >= 60)
        .sort((a, b) => b.vo2TimeSeconds - a.vo2TimeSeconds)
        .slice(0,5);
    let vo2Html = '';
    if (topVO2.length > 0) {
        vo2Html = topVO2.map((p, i) => `<div class="position-${i+1}">${i+1}º ${p.name}: <strong>${formatTime(Math.round(p.vo2TimeSeconds))}</strong></div>`).join('');
    } else {
        vo2Html = 'Nenhum dado ainda';
    }
    if (vo2El) {
        vo2El.innerHTML = vo2Html;
    }
}

function updateDailyLeader() {
    const active = participants.filter(p => activeParticipants.includes(p.id));
    const best = active.reduce((a, b) => (b.queimaPoints || 0) > (a.queimaPoints || 0) ? b : a, {queimaPoints:0});
    if (best.queimaPoints > dailyLeader.queimaPoints) {
        dailyLeader.name = best.name;
        dailyLeader.queimaPoints = best.queimaPoints;
        saveDailyLeader();
    }
    renderDailyLeader();
}

function renderDailyLeader() {
    const el = document.getElementById('daily-leader');
    if (el) el.textContent = dailyLeader.name ? `Campeão do Dia: ${dailyLeader.name} - ${dailyLeader.queimaPoints.toFixed(2)} PTS` : "Campeão do Dia: --";
}

function updateDailyCaloriesLeader() {
    const active = participants.filter(p => activeParticipants.includes(p.id));
    const best = active.reduce((a, b) => (b.calories || 0) > (a.calories || 0) ? b : a, {calories:0});
    if (best.calories > (dailyCaloriesLeader.calories || 0)) {
        dailyCaloriesLeader.name = best.name;
        dailyCaloriesLeader.calories = Math.round(best.calories);
        saveDailyCaloriesLeader();
    }
    renderDailyCaloriesLeader();
}

function renderDailyCaloriesLeader() {
    const el = document.getElementById('daily-calories-leader');
    if (el) el.textContent = dailyCaloriesLeader.name ? `Mais calorias hoje: ${dailyCaloriesLeader.name} (${dailyCaloriesLeader.calories} kcal)` : "Mais calorias hoje: --";
}

function renderLastSessionSummary() {
    const container = document.getElementById('last-class-summary');
    if (!container) return;
    if (!lastSessionSummary) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    let html = `
        <p><strong>${lastSessionSummary.className}</strong> – ${lastSessionSummary.dateTime}</p>
        <p><strong>Campeão em Pontos:</strong> ${lastSessionSummary.leaderPoints.name} (${lastSessionSummary.leaderPoints.points} pts)</p>
        <p><strong>Mais Calorias:</strong> ${lastSessionSummary.leaderCalories.name} (${lastSessionSummary.leaderCalories.calories} kcal)</p>
        <h3>Top 3 Pontos:</h3>
        <ul style="margin:5px 0 15px 20px; color:#ccc;">
    `;
    lastSessionSummary.topPoints.forEach((p, i) => {
        html += `<li>${i+1}º ${p.name} - ${p.queimaPoints} pts</li>`;
    });
    html += `</ul>
        <h3 style="margin-top:30px;">Top 3 Calorias:</h3>
        <ul style="margin:5px 0 15px 20px; color:#ccc;">
    `;
    lastSessionSummary.topCalories.forEach((p, i) => {
        html += `<li>${i+1}º ${p.name} - ${p.calories} kcal</li>`;
    });
    html += `</ul>
        <button onclick="window.open('relatorios-avancado.html', '_blank')" style="padding:10px 20px; background:#2196F3; color:white; border:none; border-radius:8px; cursor:pointer; font-size:1.1rem;">Ver Relatório Avançado</button>
    `;
    document.getElementById('summary-content').innerHTML = html;
}

function showFullRanking() {
    const modal = document.getElementById('full-ranking-modal');
    const content = document.getElementById('full-ranking-content');
    let html = '<h3>Ranking Semanal Completo - Pontos TRIMP</h3>';
    html += '<table><tr><th>Posição</th><th>Aluno</th><th>Pontos</th></tr>';
    const queimaFull = Object.entries(weeklyHistory.participants)
        .map(([n, d]) => ({n, p: d.totalQueimaPontos || 0}))
        .sort((a,b)=>b.p-a.p);
    queimaFull.forEach((item, i) => {
        html += `<tr><td>${i+1}º</td><td>${item.n}</td><td>${item.p.toFixed(2)}</td></tr>`;
    });
    html += '</table>';
    html += '<h3 style="margin-top:30px;">Ranking Semanal Completo - Calorias</h3>';
    html += '<table><tr><th>Posição</th><th>Aluno</th><th>Calorias</th></tr>';
    const caloriasFull = Object.entries(weeklyHistory.participants)
        .map(([n, d]) => ({n, c: d.totalCalorias || 0}))
        .sort((a,b)=>b.c-a.c);
    caloriasFull.forEach((item, i) => {
        html += `<tr><td>${i+1}º</td><td>${item.n}</td><td>${Math.round(item.c)} kcal</td></tr>`;
    });
    html += '</table>';
    content.innerHTML = html;
    modal.style.display = 'flex';
}