import { getSeasonSchedule, getTodayScores, getName } from './api.js';
import { formatDate, formatTime, getOpponent, getDallasTeam, getGameResult, isGameComplete, isGameFuture, statLabel, showLoading, showError } from './utils.js';

let pollInterval = null;
let currentMonth = null;

export function cleanupSchedule() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export async function renderSchedule(container) {
  showLoading(container);
  try {
    const [schedule, scores] = await Promise.all([
      getSeasonSchedule(),
      getTodayScores().catch(() => null),
    ]);

    const games = (schedule.games || []).filter(g => g.gameType === 2);
    if (!currentMonth) {
      currentMonth = getCurrentMonth(games);
    }

    buildPage(container, games, scores);
    startPolling(container, games);
  } catch (e) {
    showError(container);
  }
}

function getCurrentMonth(games) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const months = getMonths(games);
  return months.includes(thisMonth) ? thisMonth : months[months.length - 1] || thisMonth;
}

function getMonths(games) {
  const set = new Set();
  games.forEach(g => {
    const d = new Date(g.startTimeUTC);
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  });
  return [...set].sort();
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function buildPage(container, games, scores) {
  const months = getMonths(games);

  const monthTabs = months.map(m =>
    `<button class="month-tab ${m === currentMonth ? 'active' : ''}" data-month="${m}">${monthLabel(m)}</button>`
  ).join('');

  const filtered = games.filter(g => {
    const d = new Date(g.startTimeUTC);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentMonth;
  });

  // Merge live scores
  const liveMap = new Map();
  if (scores?.games) {
    scores.games.forEach(g => {
      if (g.homeTeam?.abbrev === 'DAL' || g.awayTeam?.abbrev === 'DAL') {
        liveMap.set(g.id, g);
      }
    });
  }

  const rows = filtered.map(g => buildGameRow(g, liveMap.get(g.id))).join('');

  container.innerHTML = `
    <h2>Schedule &amp; Scores</h2>
    <div class="month-tabs">${monthTabs}</div>
    <div class="card" style="padding:0" id="schedule-list">
      ${rows || '<p style="padding:var(--space-lg);color:var(--text-secondary)">No games this month</p>'}
    </div>
  `;

  container.querySelectorAll('.month-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMonth = btn.dataset.month;
      buildPage(container, games, scores);
    });
  });
}

function buildGameRow(game, liveData) {
  const opp = getOpponent(game);
  const homeAway = opp.isHome ? 'vs' : '@';
  const state = liveData?.gameState || game.gameState;

  // Live game
  if (state === 'LIVE' || state === 'CRIT') {
    const dal = getDallasTeam(liveData || game);
    const oppTeam = (liveData || game).homeTeam?.abbrev === 'DAL' ? (liveData || game).awayTeam : (liveData || game).homeTeam;
    const period = liveData?.periodDescriptor?.number || '';
    const clock = liveData?.clock?.timeRemaining || '';
    return `
      <a href="#live/${game.id}" class="game-row game-row-link">
        <div class="date-col">${formatDate(game.startTimeUTC)}</div>
        <span class="badge badge-live result-badge">LIVE</span>
        <div class="team-col">
          <img src="${opp.logo}" alt="${opp.abbrev}" loading="lazy">
          <span>${homeAway} ${opp.abbrev}</span>
        </div>
        <div class="score-col"><span class="live-dot"></span>${dal?.score ?? 0} - ${oppTeam?.score ?? 0}</div>
        <div class="status-col">Gamecast &rsaquo;</div>
      </a>`;
  }

  // Completed game (has gameOutcome)
  if (isGameComplete(game)) {
    const result = getGameResult(game);
    const dal = getDallasTeam(game);
    const oppTeam = game.homeTeam?.abbrev === 'DAL' ? game.awayTeam : game.homeTeam;
    const lastPeriod = game.gameOutcome?.lastPeriodType;
    let status = 'Final';
    if (lastPeriod === 'OT') status = 'Final (OT)';
    else if (lastPeriod === 'SO') status = 'Final (SO)';

    const badgeClass = result === 'W' ? 'badge-win' : result === 'OTL' ? 'badge-otl' : 'badge-loss';

    return `
      <a href="#game/${game.id}" class="game-row game-row-link">
        <div class="date-col">${formatDate(game.startTimeUTC)}</div>
        <span class="badge ${badgeClass} result-badge">${result}</span>
        <div class="team-col">
          <img src="${opp.logo}" alt="${opp.abbrev}" loading="lazy">
          <span>${homeAway} ${opp.abbrev}</span>
        </div>
        <div class="score-col">${dal?.score ?? 0} - ${oppTeam?.score ?? 0}</div>
        <div class="status-col">${status} &rsaquo;</div>
      </a>`;
  }

  // Future / scheduled
  const broadcasts = game.tvBroadcasts?.map(b => b.network).join(', ') || '';
  return `
    <a href="#matchup/${game.id}" class="game-row game-row-link">
      <div class="date-col">${formatDate(game.startTimeUTC)}</div>
      <span class="badge result-badge" style="visibility:hidden">--</span>
      <div class="team-col">
        <img src="${opp.logo}" alt="${opp.abbrev}" loading="lazy">
        <span>${homeAway} ${opp.abbrev}</span>
      </div>
      <div class="score-col">${formatTime(game.startTimeUTC)}</div>
      <div class="status-col">Preview &rsaquo;</div>
    </a>`;
}

function startPolling(container, games) {
  cleanupSchedule();
  // Only poll if there might be a live game today
  const hasLive = games.some(g => g.gameState === 'LIVE' || g.gameState === 'CRIT');
  const hasTodayGame = games.some(g => {
    if (isGameComplete(g)) return false;
    const d = new Date(g.startTimeUTC);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  if (hasLive || hasTodayGame) {
    pollInterval = setInterval(async () => {
      try {
        const scores = await getTodayScores();
        // Re-render schedule list only
        const list = document.getElementById('schedule-list');
        if (!list) { cleanupSchedule(); return; }

        const filtered = games.filter(g => {
          const d = new Date(g.startTimeUTC);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentMonth;
        });
        const liveMap = new Map();
        if (scores?.games) {
          scores.games.forEach(g => {
            if (g.homeTeam?.abbrev === 'DAL' || g.awayTeam?.abbrev === 'DAL') {
              liveMap.set(g.id, g);
            }
          });
        }
        list.innerHTML = filtered.map(g => buildGameRow(g, liveMap.get(g.id))).join('') || '<p style="padding:var(--space-lg);color:var(--text-secondary)">No games this month</p>';
      } catch (_) {}
    }, 30000);
  }
}
