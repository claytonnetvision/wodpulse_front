// tileRenderer.js - Layout do tile (fácil de editar - Modelo 1: Compacto Moderno)
function renderTiles() {
    const container = document.getElementById('participants');
    if (!container) return;
    const activeOnScreen = participants.filter(p => activeParticipants.includes(p.id) && (p.connected || (p.hr > 0)));
    const sorted = activeOnScreen.sort((a, b) => (b.queimaPoints || 0) - (a.queimaPoints || 0));
   
    container.innerHTML = '';
    const now = Date.now();
    sorted.forEach((p, index) => {
        let percent = 0;
        if (p.maxHR && p.hr > 0) {
            percent = Math.min(Math.max(Math.round((p.hr / p.maxHR) * 100), 0), 100);
        }
        const zoneClass = getZone(percent);
        const isInactive = p.connected && p.lastUpdate && (now - p.lastUpdate > 15000);
        const isRedAlert = p.redStartTime && (now - p.redStartTime > 30000);
        const vo2ActiveAndCounting = p.vo2ZoneActive && p.vo2TimeSeconds > 0;
        const tile = document.createElement('div');
        tile.className = `tile ${zoneClass ? 'zone-' + zoneClass : 'zone-gray'} ${!p.connected ? 'disconnected' : ''} ${index === 0 ? 'leader' : ''} ${isInactive ? 'inactive-alert' : ''} ${isRedAlert ? 'red-alert-blink' : ''}`;
        tile.innerHTML = `
            <div class="name-and-device" style="text-align: center; margin-bottom: 10px;">
                <div class="name" style="font-size: 2rem; font-weight: bold;">${p.name}</div>
                ${p.deviceName ? `<div class="device-name" style="font-size: 1rem; color: #aaa;">📱 ${p.deviceName}</div>` : ''}
            </div>
            <div class="bpm-container" style="position: relative; display: flex; align-items: center; justify-content: center; min-height: 180px;">
                <div class="bpm" style="font-size: 6rem; font-weight: 900;">${p.connected && p.hr > 0 ? p.hr : '--'}<span style="font-size: 0.4em;">BPM</span></div>
                ${vo2ActiveAndCounting ? `
                    <div class="vo2-indicator" style="position: absolute; right: -20px; top: 50%; transform: translateY(-50%); font-size: 5.8rem; font-weight: 900; color: #FF1744;">
                        VO2↑
                    </div>
                ` : ''}
            </div>
            <!-- FC Máxima e FC Média na mesma linha (compacto e bonito) -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 1.4rem; margin: 10px 0; color: #2196F3;">
                <div>
                    Máx hoje: <strong>${p.todayMaxHR || '--'}</strong> | Hist: <strong>${p.historicalMaxHR || '--'}</strong>
                </div>
                <div style="color: #4CAF50;">
                    Média: <strong>${p.avg_hr ? Math.round(p.avg_hr) + ' bpm' : '--'}</strong>
                </div>
            </div>
            <div style="text-align: center; font-size: 1.2rem; color: #aaa;">${percent}%</div>
            <div class="progress-bar" style="height: 12px; background: #333; border-radius: 6px; overflow: hidden; margin: 15px 0;">
                <div class="progress-fill" style="height: 100%; background: linear-gradient(90deg, #4CAF50, #FF9800, #F44336); width: ${percent}%;"></div>
            </div>
            <div style="text-align: center; font-size: 1.8rem; margin: 10px 0;">
                <span style="color: #FF9800; font-weight: bold;">${p.queimaPoints.toFixed(2)} PTS</span> | 
                <span style="color: #00BCD4;">${Math.round(p.calories || 0)} kcal</span>
            </div>
            ${p.vo2TimeSeconds > 0 ? `
                <div style="text-align: center; color: #FF1744; font-size: 1.5rem; margin: 10px 0;">
                    VO2 Time: <strong>${formatTime(Math.round(p.vo2TimeSeconds))}</strong>
                </div>
            ` : ''}
            <div style="text-align: center; color: #FF9800; font-size: 1.3rem; margin-top: 10px;">
                EPOC estimado: +<strong>${Math.round(p.epocEstimated || 0)}</strong> kcal pós-treino
            </div>
            ${isInactive ? '<div style="color:#ffeb3b; font-size:0.9rem; margin-top:5px; text-align:center;">⚠️ SEM SINAL</div>' : ''}
        `;
        container.appendChild(tile);
    });
}