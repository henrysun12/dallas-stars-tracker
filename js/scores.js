import { getCurrentTeam } from './teams.js';
import { getScoreboard } from './espn-api.js';
import { showLoading, showError } from './utils.js';

let pollInterval = null;
let currentDate = todayStr();

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function shiftDate(yyyymmdd, days) {
  const y = +yyyymmdd.slice(0, 4);
  const m = +yyyymmdd.slice(4, 6) - 1;
  const d = +yyyymmdd.slice(6, 8);
  const dt = new Date(y, m, d + days);
  return dt.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatDisplayDate(yyyymmdd) {
  const y = +yyyymmdd.slice(0, 4);
  const m = +yyyymmdd.slice(4, 6) - 1;
  const d = +yyyymmdd.slice(6, 8);
  return new Date(y, m, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

export function cleanupScores() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

export async function renderScores(container) {
  showLoading(container);
  await loadAndRender(container);
}

async function loadAndRender(container) {
  const team = getCurrentTeam();

  // Build date nav + placeholder
  container.innerHTML = `
    <section class="page-section">
      <h1>${team.league} Scores</h1>
      <div class="scores-date-nav">
        <button id="scores-prev" aria-label="Previous day">&larr;</button>
        <span class="scores-date" id="scores-date">${formatDisplayDate(currentDate)}</span>
        <button id="scores-today">Today</button>
        <button id="scores-next" aria-label="Next day">&rarr;</button>
      </div>
      <div id="scores-body">
        <div class="skeleton-grid">
          <div class="skeleton-card"><div class="skeleton-line wide"></div><div class="skeleton-line"></div></div>
          <div class="skeleton-card"><div class="skeleton-line wide"></div><div class="skeleton-line"></div></div>
        </div>
      </div>
    </section>
  `;

  // Wire up date nav
  container.querySelector('#scores-prev').addEventListener('click', () => {
    currentDate = shiftDate(currentDate, -1);
    refreshScores(container);
  });
  container.querySelector('#scores-next').addEventListener('click', () => {
    currentDate = shiftDate(currentDate, 1);
    refreshScores(container);
  });
  container.querySelector('#scores-today').addEventListener('click', () => {
    currentDate = todayStr();
    refreshScores(container);
  });

  await fetchAndRenderGames(container);
}

async function refreshScores(container) {
  cleanupScores();
  const dateEl = container.querySelector('#scores-date');
  if (dateEl) dateEl.textContent = formatDisplayDate(currentDate);
  const body = container.querySelector('#scores-body');
  if (body) {
    body.innerHTML = `
      <div class="skeleton-grid">
        <div class="skeleton-card"><div class="skeleton-line wide"></div><div class="skeleton-line"></div></div>
      </div>`;
  }
  await fetchAndRenderGames(container);
}

async function fetchAndRenderGames(container) {
  const team = getCurrentTeam();
  const body = container.querySelector('#scores-body');
  if (!body) return;

  try {
    const data = await getScoreboard(team, currentDate);
    const events = data?.events || [];

    // Also try NHL-native API for Stars
    let nhlNativeGames = null;
    if (team.useNativeAPI) {
      try {
        const resp = await fetch('/api/v1/score/now');
        if (resp.ok) nhlNativeGames = await resp.json();
      } catch (_) { /* fall back to ESPN */ }
    }

    renderGameCards(body, events, team, nhlNativeGames);
    setupAutoRefresh(container, events);
  } catch (err) {
    body.innerHTML = `<div class="error-card"><p>Unable to load scores. ${err.message}</p>
      <button onclick="location.reload()">Try Again</button></div>`;
  }
}

function setupAutoRefresh(container, events) {
  cleanupScores();
  const hasLive = events.some(ev => {
    const state = ev?.competitions?.[0]?.status?.type?.state;
    return state === 'in';
  });
  if (hasLive) {
    pollInterval = setInterval(() => fetchAndRenderGames(container), 30000);
  }
}

function renderGameCards(body, events, team, nhlNativeGames) {
  if (!events.length) {
    body.innerHTML = `<div class="empty-state"><p>No ${team.league} games scheduled for this date.</p></div>`;
    return;
  }

  // Categorize games
  const live = [];
  const upcoming = [];
  const completed = [];

  for (const ev of events) {
    const state = ev?.competitions?.[0]?.status?.type?.state || 'pre';
    if (state === 'in') live.push(ev);
    else if (state === 'pre') upcoming.push(ev);
    else completed.push(ev);
  }

  let html = '';

  if (live.length) {
    html += `<h2 class="scores-section-title">Live</h2>`;
    html += `<div class="scores-grid">${live.map(ev => gameCard(ev, team, 'in')).join('')}</div>`;
  }

  if (upcoming.length) {
    html += `<h2 class="scores-section-title">Upcoming</h2>`;
    html += `<div class="scores-grid">${upcoming.map(ev => gameCard(ev, team, 'pre')).join('')}</div>`;
  }

  if (completed.length) {
    html += `<h2 class="scores-section-title">Final</h2>`;
    html += `<div class="scores-grid">${completed.map(ev => gameCard(ev, team, 'post')).join('')}</div>`;
  }

  body.innerHTML = html;
}

function gameCard(event, team, state) {
  const comp = event.competitions?.[0];
  if (!comp) return '';

  const competitors = comp.competitors || [];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[0];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[1];
  if (!away || !home) return '';

  const status = comp.status?.type?.detail || '';
  const isLive = state === 'in';
  const isPost = state === 'post';
  const isPre = state === 'pre';

  // Check if our Dallas team is involved (match by ID or abbreviation)
  const teamId = String(team.espnTeamId);
  const abbr = team.abbrev;
  const isHighlight = String(away.team?.id) === teamId || String(home.team?.id) === teamId ||
    away.team?.abbreviation === abbr || home.team?.abbreviation === abbr;

  // Determine winner for completed games
  let awayWinner = false;
  let homeWinner = false;
  if (isPost) {
    const awayScore = parseInt(away.score || '0', 10);
    const homeScore = parseInt(home.score || '0', 10);
    awayWinner = awayScore > homeScore;
    homeWinner = homeScore > awayScore;
  }

  // Build link
  let href = '#';
  if (isLive) {
    href = `#live/${event.id}`;
  } else if (isPost) {
    href = `#game/${event.id}`;
  } else {
    href = `#matchup/${event.id}`;
  }
  const linkAttr = `href="${href}"`;

  // Odds for upcoming games
  let oddsHtml = '';
  if (isPre && comp.odds?.length) {
    const odds = comp.odds[0];
    const details = odds.details || '';
    const overUnder = odds.overUnder;
    const awayML = odds.awayTeamOdds?.moneyLine;
    const homeML = odds.homeTeamOdds?.moneyLine;
    const fmtML = v => v > 0 ? `+${v}` : String(v);
    const parts = [];
    if (details) parts.push(details);
    if (overUnder) parts.push(`O/U: ${overUnder}`);
    const mlParts = [];
    if (awayML != null) mlParts.push(`${away.team?.abbreviation || ''} ${fmtML(awayML)}`);
    if (homeML != null) mlParts.push(`${home.team?.abbreviation || ''} ${fmtML(homeML)}`);
    oddsHtml = `<div class="score-card-odds">
      ${parts.length ? `<div>${parts.join(' &middot; ')}</div>` : ''}
      ${mlParts.length ? `<div style="margin-top:2px">${mlParts.join(' &middot; ')}</div>` : ''}
    </div>`;
  }

  // Broadcast info
  let broadcastHtml = '';
  if (isPre || isLive) {
    const broadcasts = comp.broadcasts || comp.geoBroadcasts || [];
    const names = [];
    for (const b of broadcasts) {
      if (b.names?.length) names.push(...b.names);
      else if (b.media?.shortName) names.push(b.media.shortName);
    }
    if (names.length) {
      broadcastHtml = `<span class="score-broadcast">${names.slice(0, 3).join(', ')}</span>`;
    }
  }

  // Live badge
  const liveBadge = isLive ? `<span class="score-live-badge"><span class="live-dot"></span>LIVE</span>` : '';

  const cardClasses = ['score-card'];
  if (isHighlight) cardClasses.push('highlight');
  if (isLive) cardClasses.push('live');

  return `
    <a ${linkAttr} class="${cardClasses.join(' ')}" style="text-decoration:none;color:inherit;">
      <div class="score-card-teams">
        <div class="score-team-row">
          <img src="${teamLogo(away.team)}" alt="" loading="lazy">
          <span class="score-team-name${awayWinner ? ' winner' : ''}">${away.team?.abbreviation || '???'}</span>
          ${!isPre ? `<span class="score-team-score${awayWinner ? ' winner' : ''}">${away.score || '0'}</span>` : ''}
        </div>
        <div class="score-team-row">
          <img src="${teamLogo(home.team)}" alt="" loading="lazy">
          <span class="score-team-name${homeWinner ? ' winner' : ''}">${home.team?.abbreviation || '???'}</span>
          ${!isPre ? `<span class="score-team-score${homeWinner ? ' winner' : ''}">${home.score || '0'}</span>` : ''}
        </div>
      </div>
      <div class="score-card-status">
        <span>${liveBadge}${status}</span>
        ${broadcastHtml}
      </div>
      ${oddsHtml}
    </a>
  `;
}

function teamLogo(team) {
  return team?.logo || `https://a.espncdn.com/i/teamlogos/leagues/500/${team?.id || 'default'}.png`;
}
