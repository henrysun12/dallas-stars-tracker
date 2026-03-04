import { getCurrentTeam } from './teams.js';
import { getTeamSchedule, getStandings, getInjuries, getTeamInjuries, findOurTeam, findOppTeam, getCompScore, getEventState, getEventStatus, didWeWin, formatEspnDate, formatEspnTime, getStatValue } from './espn-api.js';
import { showLoading, showError, formatCountdown } from './utils.js';

let countdownInterval = null;

export function cleanupEspnDashboard() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

export async function renderEspnDashboard(container) {
  const team = getCurrentTeam();
  showLoading(container);
  try {
    const [schedData, standData, injData] = await Promise.all([
      getTeamSchedule(team),
      getStandings(team).catch(() => null),
      getInjuries(team).catch(() => null),
    ]);

    const events = schedData.events || [];
    const record = schedData.team?.recordSummary || '--';
    const standingSummary = schedData.team?.standingSummary || '';

    const past = events.filter(e => getEventState(e) === 'post');
    const live = events.filter(e => getEventState(e) === 'in');
    const future = events.filter(e => getEventState(e) === 'pre');

    const lastGame = past[past.length - 1];
    const nextGame = live[0] || future[0];
    const isLive = live.length > 0;
    const injuries = injData ? getTeamInjuries(injData, team.abbrev) : [];

    container.innerHTML = `
      <h2>Dashboard</h2>
      <div class="dashboard-grid">
        ${buildNextCard(nextGame, isLive, team)}
        ${buildLastCard(lastGame, team)}
        ${buildRecordCard(record, standingSummary, team)}
        ${buildInjuryCard(injuries, team)}
      </div>
      ${buildStandingsSection(standData, team)}
    `;

    if (nextGame && !isLive) {
      const target = new Date(nextGame.date).getTime();
      const el = document.getElementById('countdown');
      if (el) {
        const update = () => {
          const cdEl = document.getElementById('countdown');
          if (!cdEl) { cleanupEspnDashboard(); return; }
          cdEl.textContent = formatCountdown(target);
        };
        update();
        countdownInterval = setInterval(update, 1000);
      }
    }
  } catch (e) {
    console.error('ESPN Dashboard error:', e);
    showError(container);
  }
}

function buildNextCard(event, isLive, team) {
  const star = `<svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>`;
  if (!event) return `<div class="card"><div class="card-header">${star}NEXT GAME</div><p style="color:var(--text-secondary)">No upcoming games</p></div>`;

  const comp = event.competitions?.[0];
  const us = findOurTeam(comp?.competitors, team.espnTeamId);
  const opp = findOppTeam(comp?.competitors, team.espnTeamId);
  const oppLogo = opp?.team?.logos?.[0]?.href || '';
  const oppName = opp?.team?.abbreviation || opp?.team?.shortDisplayName || '';
  const homeAway = us?.homeAway === 'home' ? 'vs' : '@';

  if (isLive) {
    return `
      <div class="card">
        <div class="card-header">${star}LIVE NOW <span class="badge badge-live" style="margin-left:8px">LIVE</span></div>
        <div class="game-matchup">
          <img src="${oppLogo}" alt="${oppName}" loading="lazy">
          <div class="game-score">
            <span class="dal-score">${getCompScore(us)}</span> - ${getCompScore(opp)}
          </div>
        </div>
        <div class="game-meta">${homeAway} ${oppName} &middot; ${getEventStatus(event)}</div>
        <a href="#live/${event.id}" style="display:inline-block;margin-top:var(--space-sm);color:var(--victory-green-light);font-weight:600">Watch Gamecast &rsaquo;</a>
      </div>`;
  }

  return `
    <div class="card">
      <div class="card-header">${star}NEXT GAME</div>
      <div class="game-matchup">
        <img src="${oppLogo}" alt="${oppName}" loading="lazy">
        <span class="vs">${homeAway} ${oppName}</span>
      </div>
      <div class="countdown-value" id="countdown">--</div>
      <div class="game-meta">${formatEspnDate(event.date)} &middot; ${formatEspnTime(event.date)}</div>
      <a href="#matchup/${event.id}" style="display:inline-block;margin-top:var(--space-sm);color:var(--victory-green-light);font-weight:600">Preview &rsaquo;</a>
    </div>`;
}

function buildLastCard(event, team) {
  const star = `<svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>`;
  if (!event) return `<div class="card"><div class="card-header">${star}LAST RESULT</div><p style="color:var(--text-secondary)">No recent games</p></div>`;

  const comp = event.competitions?.[0];
  const us = findOurTeam(comp?.competitors, team.espnTeamId);
  const opp = findOppTeam(comp?.competitors, team.espnTeamId);
  const won = us?.winner === true;
  const oppName = opp?.team?.abbreviation || '';
  const oppLogo = opp?.team?.logos?.[0]?.href || '';
  const homeAway = us?.homeAway === 'home' ? 'vs' : '@';

  return `
    <div class="card">
      <div class="card-header">${star}LAST RESULT</div>
      <span class="badge ${won ? 'badge-win' : 'badge-loss'}">${won ? 'W' : 'L'}</span>
      <div class="game-matchup">
        <img src="${oppLogo}" alt="${oppName}" loading="lazy">
        <div class="game-score">
          <span class="dal-score">${getCompScore(us)}</span> - ${getCompScore(opp)}
        </div>
      </div>
      <div class="game-meta">${getEventStatus(event)} &middot; ${homeAway} ${oppName}</div>
    </div>`;
}

function buildRecordCard(record, standingSummary, team) {
  const star = `<svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>`;
  return `
    <div class="card">
      <div class="card-header">${star}SEASON RECORD</div>
      <div class="record-big">${record}</div>
      ${standingSummary ? `<div class="record-pts">${standingSummary}</div>` : ''}
    </div>`;
}

function buildInjuryCard(injuries, team) {
  const star = `<svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>`;
  if (!injuries.length) {
    return `<div class="card"><div class="card-header">${star}INJURIES</div><p style="color:var(--text-secondary)">No injuries reported</p></div>`;
  }
  const rows = injuries.slice(0, 5).map(inj => {
    const statusClass = inj.statusType === 'INJURY_STATUS_OUT' ? 'injury-out' : inj.statusType === 'INJURY_STATUS_IR' ? 'injury-ir' : 'injury-dtd';
    return `<div style="display:flex;justify-content:space-between;padding:var(--space-xs) 0;font-size:0.85rem">
      <span>${inj.name} <span style="color:var(--text-muted)">${inj.position}</span></span>
      <span class="injury-status-badge ${statusClass}">${inj.status}</span>
    </div>`;
  }).join('');
  return `<div class="card"><div class="card-header">${star}INJURIES (${injuries.length})</div>${rows}${injuries.length > 5 ? `<div style="color:var(--text-muted);font-size:0.8rem;margin-top:var(--space-xs)">+${injuries.length - 5} more</div>` : ''}</div>`;
}

function buildStandingsSection(standData, team) {
  if (!standData?.children) return '';
  let html = '<h3 style="margin-top:var(--space-xl);margin-bottom:var(--space-md)">' + team.league + ' Standings</h3>';

  for (const conf of standData.children) {
    html += `<h4 style="color:var(--text-muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin:var(--space-lg) 0 var(--space-sm)">${conf.name || conf.abbreviation}</h4>`;

    const entries = conf.standings?.entries || [];
    if (entries.length) {
      html += buildStandingsTable(entries, team);
    }
    // Check for division children
    if (conf.children) {
      for (const div of conf.children) {
        const divEntries = div.standings?.entries || [];
        if (divEntries.length) {
          html += `<div style="margin-bottom:var(--space-md)">${buildStandingsTable(divEntries, team, div.name)}</div>`;
        }
      }
    }
  }
  return `<div class="full-standings-section">${html}</div>`;
}

function buildStandingsTable(entries, team, caption) {
  const rows = entries.map((e, i) => {
    const abbr = e.team?.abbreviation || '';
    const logo = e.team?.logos?.[0]?.href || '';
    const isUs = abbr === team.abbrev;
    const wins = getStatValue(e.stats, 'wins') ?? '--';
    const losses = getStatValue(e.stats, 'losses') ?? '--';
    const pct = getStatValue(e.stats, 'winPercent') ?? '--';
    const streak = getStatValue(e.stats, 'streak') ?? '--';
    const seed = getStatValue(e.stats, 'playoffSeed');
    return `<tr class="${isUs ? 'dal-row' : ''}">
      <td>${seed || (i + 1)}</td>
      <td><div class="team-cell"><img src="${logo}" alt="${abbr}" loading="lazy">${abbr}</div></td>
      <td>${wins}</td>
      <td>${losses}</td>
      <td>${pct}</td>
      <td>${streak}</td>
    </tr>`;
  }).join('');

  return `<div class="table-wrap" style="margin-bottom:var(--space-md)">
    <table class="standings-table">
      ${caption ? `<caption>${caption}</caption>` : ''}
      <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>Pct</th><th>Strk</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
