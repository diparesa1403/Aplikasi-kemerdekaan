// ============================================
//   SportHub - Lomba Kemerdekaan
//   Vanilla JS - LocalStorage SPA
// ============================================

// ---- STATE ----
let state = {
  sport: 'Futsal',
  teams: [],
  rounds: [],       // Array of rounds, each round = array of matches
  activeMatchId: null,
  period: 1,
};

// ---- PERSISTENCE ----
function saveState() {
  localStorage.setItem('sporthub_state', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('sporthub_state');
  if (saved) {
    try {
      state = JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved state');
    }
  }
}

// ---- HELPERS ----
function uid() {
  return Math.random().toString(36).substr(2, 9);
}

function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function getRoundLabel(roundIndex, totalRounds) {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return '🏆 FINAL';
  if (fromEnd === 1) return 'SEMIFINAL';
  if (fromEnd === 2) return 'PEREMPAT FINAL';
  return `BABAK ${roundIndex + 1}`;
}

// ---- TAB NAVIGATION ----
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.tab-content');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ---- SPORT SELECTOR ----
function initSportSelector() {
  document.querySelectorAll('.sport-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sport-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.sport = btn.dataset.sport;
      saveState();
    });
  });

  // Sync initial state
  document.querySelectorAll('.sport-btn').forEach(btn => {
    if (btn.dataset.sport === state.sport) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

// ---- TEAM MANAGEMENT ----
function renderTeams() {
  const list = document.getElementById('team-list');
  const badge = document.getElementById('team-count-badge');
  badge.textContent = `${state.teams.length} Tim`;

  if (state.teams.length === 0) {
    list.innerHTML = '<li class="empty-state">Belum ada tim. Tambahkan tim di atas!</li>';
    return;
  }

  list.innerHTML = '';
  state.teams.forEach((team, i) => {
    const li = document.createElement('li');
    li.className = 'team-item';
    li.innerHTML = `
      <div class="team-item-name">
        <span class="team-num">${i + 1}</span>
        <span>${escHtml(team.name)}</span>
      </div>
      <button class="btn-remove" data-id="${team.id}" title="Hapus">✕</button>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => removeTeam(btn.dataset.id));
  });
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function addTeam() {
  const input = document.getElementById('team-name-input');
  const name = input.value.trim();
  if (!name) { showToast('⚠️ Masukkan nama tim dulu!'); return; }
  if (state.teams.find(t => t.name.toLowerCase() === name.toLowerCase())) {
    showToast('⚠️ Nama tim sudah ada!'); return;
  }
  if (state.teams.length >= 16) { showToast('⚠️ Maksimal 16 tim!'); return; }

  state.teams.push({ id: uid(), name });
  input.value = '';
  input.focus();
  saveState();
  renderTeams();
  showToast(`✅ ${name} ditambahkan!`);
}

function removeTeam(id) {
  state.teams = state.teams.filter(t => t.id !== id);
  saveState();
  renderTeams();
  showToast('🗑️ Tim dihapus');
}

// ---- BRACKET GENERATION ----
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function generateBracket() {
  if (state.teams.length < 2) {
    showToast('⚠️ Minimal 2 tim untuk generate bagan!');
    return;
  }

  const shuffled = shuffle(state.teams);
  const size = nextPowerOf2(shuffled.length);
  const byes = size - shuffled.length;

  // Pad with BYE
  const padded = [...shuffled];
  for (let i = 0; i < byes; i++) padded.push({ id: 'bye_' + i, name: 'BYE' });

  // Round 1 matches
  const r1Matches = [];
  for (let i = 0; i < padded.length; i += 2) {
    const teamA = padded[i];
    const teamB = padded[i + 1];
    const isBye = teamA.name === 'BYE' || teamB.name === 'BYE';
    const match = {
      id: uid(),
      teamA: teamA,
      teamB: teamB,
      scoreA: 0,
      scoreB: 0,
      winner: isBye ? (teamA.name === 'BYE' ? teamB : teamA) : null,
      done: isBye,
    };
    r1Matches.push(match);
  }

  state.rounds = [r1Matches];

  // Subsequent rounds (placeholder)
  let prevRound = r1Matches;
  while (prevRound.length > 1) {
    const nextRound = [];
    for (let i = 0; i < prevRound.length; i += 2) {
      const matchA = prevRound[i];
      const matchB = prevRound[i + 1];
      const match = {
        id: uid(),
        teamA: matchA.winner || null,
        teamB: matchB.winner || null,
        scoreA: 0,
        scoreB: 0,
        winner: null,
        done: false,
        srcA: matchA.id,
        srcB: matchB.id,
      };
      // Auto-advance if both sources have winners already (BYE chains)
      if (match.teamA && match.teamB) {
        const bothBye = match.teamA.name === 'BYE' && match.teamB.name === 'BYE';
        if (bothBye) { match.winner = null; }
      }
      nextRound.push(match);
    }
    state.rounds.push(nextRound);
    prevRound = nextRound;
  }

  saveState();
  renderBracket();
  renderScoreList();
  showToast('🎯 Bagan berhasil dibuat!');

  // Switch to bracket tab
  document.querySelector('[data-tab="bracket"]').click();
}

// ---- RENDER BRACKET ----
function renderBracket() {
  const container = document.getElementById('bracket-container');
  const sportBadge = document.getElementById('sport-badge');
  sportBadge.textContent = state.sport === 'Futsal' ? '⚽ Futsal' : '🏀 Basket';

  if (!state.rounds || state.rounds.length === 0) {
    container.innerHTML = '<div class="empty-state">Belum ada bagan. Generate dari tab Tim!</div>';
    return;
  }

  // Check champion
  const finalMatch = state.rounds[state.rounds.length - 1][0];

  let html = '<div class="bracket-wrapper">';

  state.rounds.forEach((round, rIdx) => {
    const label = getRoundLabel(rIdx, state.rounds.length);
    html += `<div class="bracket-round">`;
    html += `<div class="round-label">${label}</div>`;
    round.forEach(match => {
      const isWinnerA = match.done && match.winner && match.winner.id === match.teamA?.id;
      const isWinnerB = match.done && match.winner && match.winner.id === match.teamB?.id;
      const teamAClass = match.teamA?.name === 'BYE' ? 'bye' : (isWinnerA ? 'winner' : (isWinnerB ? 'loser' : ''));
      const teamBClass = match.teamB?.name === 'BYE' ? 'bye' : (isWinnerB ? 'winner' : (isWinnerA ? 'loser' : ''));

      const nameA = match.teamA ? (match.teamA.name === 'BYE' ? '<span class="bye-tag">— BYE —</span>' : escHtml(match.teamA.name)) : '<span class="bye-tag">TBD</span>';
      const nameB = match.teamB ? (match.teamB.name === 'BYE' ? '<span class="bye-tag">— BYE —</span>' : escHtml(match.teamB.name)) : '<span class="bye-tag">TBD</span>';

      const scoreA = match.done ? `<span class="score-tag">${match.scoreA}</span>` : '';
      const scoreB = match.done ? `<span class="score-tag">${match.scoreB}</span>` : '';

      html += `
        <div class="bracket-match ${match.done ? 'done' : ''}">
          <div class="bracket-match-team ${teamAClass}">${nameA}${scoreA}</div>
          <div class="bracket-match-team ${teamBClass}">${nameB}${scoreB}</div>
        </div>`;
    });
    html += '</div>';
  });

  html += '</div>';

  // Champion
  if (finalMatch && finalMatch.winner) {
    html += `
      <div class="champion-card" style="margin-top:20px;">
        <span class="crown">👑</span>
        <h3>JUARA ${state.sport.toUpperCase()}</h3>
        <div class="champion-name">${escHtml(finalMatch.winner.name)}</div>
      </div>`;
  }

  container.innerHTML = html;
}

// ---- RENDER SCORE LIST ----
function renderScoreList() {
  const container = document.getElementById('score-match-list');

  if (!state.rounds || state.rounds.length === 0) {
    container.innerHTML = '<div class="empty-state">Belum ada pertandingan. Generate bagan dulu!</div>';
    return;
  }

  let html = '';
  state.rounds.forEach((round, rIdx) => {
    const label = getRoundLabel(rIdx, state.rounds.length);
    round.forEach(match => {
      // Skip BYE-only matches
      if (match.teamA?.name === 'BYE' || match.teamB?.name === 'BYE') return;
      // Skip if one team is TBD
      if (!match.teamA || !match.teamB) return;

      const statusText = match.done
        ? `✅ Selesai — Pemenang: ${escHtml(match.winner?.name || '?')}`
        : '⏳ Belum dimulai — Klik untuk input skor';

      html += `
        <div class="score-match-card ${match.done ? 'done' : ''}" data-match-id="${match.id}" data-round="${rIdx}">
          <div class="score-match-round">${label}</div>
          <div class="score-match-teams">
            <div class="score-match-team-name">${escHtml(match.teamA.name)}</div>
            <div class="score-match-result">
              <span class="score-val">${match.scoreA}</span>
              <span class="score-dash">:</span>
              <span class="score-val">${match.scoreB}</span>
            </div>
            <div class="score-match-team-name">${escHtml(match.teamB.name)}</div>
          </div>
          <div class="score-match-status ${match.done ? 'selesai' : ''}">${statusText}</div>
        </div>`;
    });
  });

  if (!html) {
    container.innerHTML = '<div class="empty-state">Semua pertandingan sedang menunggu tim dari babak sebelumnya.</div>';
    return;
  }

  container.innerHTML = html;

  container.querySelectorAll('.score-match-card').forEach(card => {
    card.addEventListener('click', () => openScoreModal(card.dataset.matchId, parseInt(card.dataset.round)));
  });
}

// ---- SCORE MODAL ----
let activeRoundIdx = null;

function findMatch(matchId) {
  for (let r = 0; r < state.rounds.length; r++) {
    const m = state.rounds[r].find(m => m.id === matchId);
    if (m) return { match: m, roundIdx: r };
  }
  return null;
}

function openScoreModal(matchId, roundIdx) {
  const found = findMatch(matchId);
  if (!found) return;
  const { match } = found;

  state.activeMatchId = matchId;
  activeRoundIdx = found.roundIdx;
  state.period = state.period || 1;

  document.getElementById('modal-sport-label').textContent =
    state.sport === 'Futsal' ? '⚽ Futsal' : '🏀 Basket';
  document.getElementById('modal-match-title').textContent =
    `${match.teamA.name}  vs  ${match.teamB.name}`;
  document.getElementById('modal-team-a').textContent = match.teamA.name;
  document.getElementById('modal-team-b').textContent = match.teamB.name;
  document.getElementById('score-a').textContent = match.scoreA;
  document.getElementById('score-b').textContent = match.scoreB;
  document.getElementById('period-display').textContent = state.period;

  document.getElementById('score-modal').classList.add('open');
}

function closeScoreModal() {
  document.getElementById('score-modal').classList.remove('open');
  state.activeMatchId = null;
}

function getActiveMatch() {
  if (!state.activeMatchId) return null;
  const found = findMatch(state.activeMatchId);
  return found ? found.match : null;
}

function updateScoreDisplay() {
  const match = getActiveMatch();
  if (!match) return;
  document.getElementById('score-a').textContent = match.scoreA;
  document.getElementById('score-b').textContent = match.scoreB;
}

function initScoreModal() {
  // Score buttons
  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const match = getActiveMatch();
      if (!match) return;
      const team = btn.dataset.team;
      const isInc = btn.classList.contains('inc');

      if (team === 'a') {
        match.scoreA = Math.max(0, match.scoreA + (isInc ? 1 : -1));
      } else {
        match.scoreB = Math.max(0, match.scoreB + (isInc ? 1 : -1));
      }
      saveState();
      updateScoreDisplay();
      renderScoreList();
    });
  });

  // Period
  document.getElementById('btn-period-inc').addEventListener('click', () => {
    state.period = Math.min(4, (state.period || 1) + 1);
    document.getElementById('period-display').textContent = state.period;
    saveState();
  });
  document.getElementById('btn-period-dec').addEventListener('click', () => {
    state.period = Math.max(1, (state.period || 1) - 1);
    document.getElementById('period-display').textContent = state.period;
    saveState();
  });

  // Set Winner
  document.getElementById('btn-set-winner').addEventListener('click', () => {
    const match = getActiveMatch();
    if (!match) return;

    if (match.scoreA === match.scoreB) {
      showToast('⚠️ Skor sama! Tentukan pemenang dulu.');
      return;
    }

    match.winner = match.scoreA > match.scoreB ? match.teamA : match.teamB;
    match.done = true;

    // Advance winner to next round
    advanceWinner(match);

    saveState();
    closeScoreModal();
    renderBracket();
    renderScoreList();
    showToast(`🏆 ${match.winner.name} menang!`);
  });

  // Reset Score
  document.getElementById('btn-reset-score').addEventListener('click', () => {
    const match = getActiveMatch();
    if (!match) return;
    match.scoreA = 0;
    match.scoreB = 0;
    match.done = false;
    match.winner = null;
    saveState();
    updateScoreDisplay();
    renderScoreList();
    showToast('🔄 Skor direset');
  });

  // Close
  document.getElementById('btn-close-modal').addEventListener('click', closeScoreModal);
  document.getElementById('score-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('score-modal')) closeScoreModal();
  });
}

function advanceWinner(doneMatch) {
  // Find which round this match belongs to
  let roundIdx = -1;
  let matchIdx = -1;
  for (let r = 0; r < state.rounds.length; r++) {
    const idx = state.rounds[r].findIndex(m => m.id === doneMatch.id);
    if (idx !== -1) { roundIdx = r; matchIdx = idx; break; }
  }

  if (roundIdx === -1 || roundIdx + 1 >= state.rounds.length) return;

  const nextRound = state.rounds[roundIdx + 1];
  const nextMatchIdx = Math.floor(matchIdx / 2);
  const nextMatch = nextRound[nextMatchIdx];

  if (!nextMatch) return;

  if (matchIdx % 2 === 0) {
    nextMatch.teamA = doneMatch.winner;
  } else {
    nextMatch.teamB = doneMatch.winner;
  }

  // If both teams now present, check if there's a BYE auto-advance
  if (nextMatch.teamA && nextMatch.teamB) {
    if (nextMatch.teamA.name === 'BYE') {
      nextMatch.winner = nextMatch.teamB;
      nextMatch.done = true;
      advanceWinner(nextMatch);
    } else if (nextMatch.teamB.name === 'BYE') {
      nextMatch.winner = nextMatch.teamA;
      nextMatch.done = true;
      advanceWinner(nextMatch);
    }
  }
}

// ---- RESET ----
function resetAll() {
  if (!confirm('Reset semua data? Ini akan menghapus tim dan bagan yang ada.')) return;
  state = { sport: 'Futsal', teams: [], rounds: [], activeMatchId: null, period: 1 };
  saveState();
  renderTeams();
  renderBracket();
  renderScoreList();
  document.querySelectorAll('.sport-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sport === 'Futsal');
  });
  showToast('🗑️ Semua data direset');
}

// ---- INIT ----
function init() {
  loadState();
  initTabs();
  initSportSelector();
  initScoreModal();

  // Input handlers
  document.getElementById('btn-add-team').addEventListener('click', addTeam);
  document.getElementById('team-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTeam();
  });
  document.getElementById('btn-generate').addEventListener('click', generateBracket);
  document.getElementById('btn-reset').addEventListener('click', resetAll);

  // Initial render
  renderTeams();
  renderBracket();
  renderScoreList();
}

document.addEventListener('DOMContentLoaded', init);
