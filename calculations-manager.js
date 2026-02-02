// calculations-manager.js - Gerenciamento de cálculos de pontos, calorias, TRIMP, VO2, zonas e EPOC
// Este módulo contém todas as funções responsáveis pelos cálculos em tempo real durante a aula

function getZone(p) {
    if (p < 50) return 'gray';
    if (p < 60) return 'green';
    if (p < 70) return 'blue';
    if (p < 80) return 'yellow';
    if (p < 90) return 'orange';
    return 'red';
}

function formatTime(s) {
    return Math.floor(s/60).toString().padStart(2,'0') + ":" + (s%60).toString().padStart(2,'0');
}

function updateQueimaCaloriesAndTimer() {
    const elapsedSeconds = Math.floor((Date.now() - wodStartTime) / 1000);
    document.getElementById('timer').textContent = formatTime(Math.max(0, elapsedSeconds));
    if (currentActiveClassName) {
        localStorage.setItem(`v6Session_${currentActiveClassName}_${getTodayDate()}`, JSON.stringify(participants));
    }
    const now = Date.now();
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (p && p.connected && p.hr > 0) {
            if (p.hr > (p.maxHRReached || 0)) p.maxHRReached = p.hr;
            if (p.hr > (p.todayMaxHR || 0)) p.todayMaxHR = p.hr;
            if (p.todayMaxHR > (p.historicalMaxHR || 0)) {
                p.historicalMaxHR = p.todayMaxHR;
            }
            const percent = Math.round((p.hr / p.maxHR) * 100);
            const zone = getZone(percent);
            if (!p.zoneSeconds) p.zoneSeconds = { gray: 0, green: 0, blue: 0, yellow: 0, orange: 0, red: 0 };
            p.zoneSeconds[zone] += 1;
            if (p.zoneSeconds[zone] >= 60) {
                let pontosThisMinute = pontosPorMinuto[zone] || 0;
                if (zone === 'red' && (p.minRed || 0) > 3) {
                    pontosThisMinute *= 0.5;
                }
                const trimpBonus = p.trimpPoints > 0 ? p.trimpPoints * 10 : 0;
                p.queimaPoints += pontosThisMinute + trimpBonus;
                p.zoneSeconds[zone] = 0;
            }
            if (zone === 'gray') p.minGray = (p.minGray || 0) + 1/60;
            if (zone === 'green') p.minGreen = (p.minGreen || 0) + 1/60;
            if (zone === 'blue') p.minBlue = (p.minBlue || 0) + 1/60;
            if (zone === 'yellow') p.minYellow = (p.minYellow || 0) + 1/60;
            if (zone === 'orange') p.minOrange = (p.minOrange || 0) + 1/60;
            if (zone === 'red') p.minRed = (p.minRed || 0) + 1/60;
            const age = p.age || 30;
            let calMin = (-55.0969 + (0.6309 * p.hr) + (0.1988 * p.weight) + (0.2017 * age)) / 4.184;
            p.calories = (p.calories || 0) + (Math.max(0, calMin) / 60);
            if (zone === 'red') {
                if (!p.redStartTime) p.redStartTime = now;
            } else {
                p.redStartTime = null;
            }
            if (p.lastHR && p.lastZone === 'red' && zone !== 'red' && (p.lastHR - p.hr > 25)) {
                p.queimaPoints += 5;
            }
            p.lastHR = p.hr;
            p.lastZone = zone;
            p.lastUpdate = now;
        }
    });
    updateVO2Time();
    renderTiles();
    updateLeaderboard();
    updateVO2Leaderboard();
    updateDailyLeader();
    updateDailyCaloriesLeader();
    renderWeeklyRankings();
}

function calculateTRIMPIncrement() {
    const now = Date.now();
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (!p || !p.connected || p.hr <= 40 || !p.maxHR || !p.lastSampleTime) return;
        const deltaMs = now - p.lastSampleTime;
        if (deltaMs < 5000) return;
        const deltaMin = deltaMs / 60000;
        const resting = Number(p.realRestingHR || p.restingHR) || 60;
        const hrr = p.maxHR - resting;
        if (hrr <= 0) return;
        let ratio = (p.hr - resting) / hrr;
        ratio = Math.max(0, Math.min(1, ratio));
        const y = p.gender === 'F' ? 1.67 : 1.92;
        const factor = 0.64 * Math.exp(y * ratio);
        const weight = Number(p.weight) || 70;
        const increment = deltaMin * ratio * factor * weight * 0.00008;
        p.trimpPoints += increment;
        p.trimpPoints = Number(p.trimpPoints.toFixed(2));
        p.lastSampleTime = now;
    });
    renderTiles();
    updateLeaderboard();
    updateVO2Leaderboard();
}

function updateVO2Time() {
    const now = Date.now();
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (!p || !p.connected || p.hr <= 40 || !p.maxHR) return;
        const percentMax = (p.hr / p.maxHR) * 100;
        const isInVO2Zone = percentMax >= 92;
        if (isInVO2Zone) {
            if (!p.vo2ZoneActive) {
                p.vo2ZoneActive = true;
                p.vo2GraceStart = now;
                p.vo2StartTime = null;
            }
            if (p.vo2GraceStart && (now - p.vo2GraceStart >= 60000)) {
                if (!p.vo2StartTime) p.vo2StartTime = now;
                const deltaSec = (now - (p.vo2LastUpdate || p.vo2StartTime)) / 1000;
                p.vo2TimeSeconds += deltaSec;
            }
        } else {
            p.vo2ZoneActive = false;
            p.vo2GraceStart = null;
            p.vo2StartTime = null;
        }
        p.vo2LastUpdate = now;
    });
}

function countZones() {
    const now = Date.now();
    activeParticipants.forEach(id => {
        const p = participants.find(p => p.id === id);
        if (!p || !p.connected || p.hr <= 40 || !p.maxHR) return;
        const percent = (p.hr / p.maxHR) * 100;
        if (percent >= 60 && percent < 70) {
            p.min_zone2 = (p.min_zone2 || 0) + 1;
        } else if (percent >= 70 && percent < 80) {
            p.min_zone3 = (p.min_zone3 || 0) + 1;
        } else if (percent >= 80 && percent < 90) {
            p.min_zone4 = (p.min_zone4 || 0) + 1;
        } else if (percent >= 90) {
            p.min_zone5 = (p.min_zone5 || 0) + 1;
        }
        if (p.hr > 40) {
            p.sumHR += p.hr;
            p.countHRMinutes += 1;
        }
    });
    renderTiles(); // atualiza a interface
}