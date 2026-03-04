import { getCurrentTeam } from './teams.js';
import { getTeamSchedule, findOurTeam, findOppTeam, getCompScore, getEventState, getEventStatus, didWeWin, formatEspnDate, formatEspnTime } from './espn-api.js';
import { showLoading, showError } from './utils.js';

export async function renderEspnSchedule(container) {
  const team = getCurrentTeam();
  showLoading(container);
  try {
    const schedData = await getTeamSchedule(team);
    const events = schedData.events || [];
    const season = schedData.season?.displayName || '';

    // Group by month
    const months = new Map();
    events.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(e);
    });

    // Find current month
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthKeys = [...months.keys()].sort();
    let activeMonth = monthKeys.includes(thisMonth) ? thisMonth : monthKeys[monthKeys.length - 1] || thisMonth;

    buildPage(container, months, monthKeys, activeMonth, team, season);
  } catch (e) {
    console.error('ESPN Schedule error:', e);
    showError(container);
  }
}

function buildPage(container, months, monthKeys, activeMonth, team, season) {
  const tabs = monthKeys.map(m => {
    const [y, mo] = m.split('-');
    const label = new Date(y, mo - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
    return `<button class="month-tab ${m === activeMonth ? 'active' : ''}" data-month="${m}">${label}</button>`;
  }).join('');

  const events = months.get(activeMonth) || [];
  const rows = events.map(e => buildRow(e, team)).join('');

  container.innerHTML = `
    <h2>Schedule &amp; Scores ${season ? `(${season})` : ''}</h2>
    <div class="month-tabs">${tabs}</div>
    <div class="card" style="padding:0">
      ${rows || '<p style="padding:var(--space-lg);color:var(--text-secondary)">No games this month</p>'}
    </div>
  `;

  container.querySelectorAll('.month-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      buildPage(container, months, monthKeys, btn.dataset.month, team, season);
    });
  });
}

function buildRow(event, team) {
  const comp = event.competitions?.[0];
  if (!comp) return '';
  const us = findOurTeam(comp.competitors, team.espnTeamId);
  const opp = findOppTeam(comp.competitors, team.espnTeamId);
  const oppLogo = opp?.team?.logos?.[0]?.href || '';
  const oppName = opp?.team?.abbreviation || opp?.team?.shortDisplayName || '';
  const homeAway = us?.homeAway === 'home' ? 'vs' : '@';
  const state = getEventState(event);

  // Live game
  if (state === 'in') {
    return `
      <a href="#live/${event.id}" class="game-row game-row-link">
        <div class="date-col">${formatEspnDate(event.date)}</div>
        <span class="badge badge-live result-badge">LIVE</span>
        <div class="team-col">
          <img src="${oppLogo}" alt="${oppName}" loading="lazy">
          <span>${homeAway} ${oppName}</span>
        </div>
        <div class="score-col"><span class="live-dot"></span>${getCompScore(us)} - ${getCompScore(opp)}</div>
        <div class="status-col">${getEventStatus(event)}</div>
      </a>`;
  }

  // Completed game
  if (state === 'post') {
    const won = us?.winner === true;
    return `
      <a href="#game/${event.id}" class="game-row game-row-link">
        <div class="date-col">${formatEspnDate(event.date)}</div>
        <span class="badge ${won ? 'badge-win' : 'badge-loss'} result-badge">${won ? 'W' : 'L'}</span>
        <div class="team-col">
          <img src="${oppLogo}" alt="${oppName}" loading="lazy">
          <span>${homeAway} ${oppName}</span>
        </div>
        <div class="score-col">${getCompScore(us)} - ${getCompScore(opp)}</div>
        <div class="status-col">${getEventStatus(event)} &rsaquo;</div>
      </a>`;
  }

  // Future game
  const broadcasts = comp.broadcasts?.map(b => b.names?.join(', ')).join(', ') || '';
  return `
    <a href="#matchup/${event.id}" class="game-row game-row-link">
      <div class="date-col">${formatEspnDate(event.date)}</div>
      <span class="badge result-badge" style="visibility:hidden">--</span>
      <div class="team-col">
        <img src="${oppLogo}" alt="${oppName}" loading="lazy">
        <span>${homeAway} ${oppName}</span>
      </div>
      <div class="score-col">${formatEspnTime(event.date)}</div>
      <div class="status-col">Preview &rsaquo;</div>
    </a>`;
}
