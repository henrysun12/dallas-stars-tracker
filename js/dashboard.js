import { getStandings, getSeasonSchedule, getTodayScores, getName } from './api.js';
import { formatRecord, formatDate, formatTime, formatCountdown, statLabel, getOpponent, getDallasTeam, isGameComplete, isGameFuture, showLoading, showError } from './utils.js';

let countdownInterval = null;

export function cleanupDashboard() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

export async function renderDashboard(container) {
  showLoading(container);
  try {
    const [standings, schedule, scores] = await Promise.all([
      getStandings(),
      getSeasonSchedule(),
      getTodayScores().catch(() => null),
    ]);

    const games = (schedule.games || []).filter(g => g.gameType === 2);
    const dalStandings = findDallas(standings);
    const lastGame = findLastGame(games);
    const nextGame = findNextGame(games, scores);

    container.innerHTML = `
      <h2>Dashboard</h2>
      <div class="dashboard-grid">
        ${buildNextGameCard(nextGame)}
        ${buildLastGameCard(lastGame)}
        ${buildRecordCard(dalStandings)}
        ${buildStandingsSnapshot(standings, dalStandings)}
      </div>
      ${buildFullStandings(standings)}
    `;

    // Start countdown
    if (nextGame && !nextGame._isLive) {
      startCountdown(nextGame.startTimeUTC);
    }
  } catch (e) {
    console.error('Dashboard error:', e);
    showError(container);
  }
}

function findDallas(standings) {
  return standings.standings?.find(t => t.teamAbbrev?.default === 'DAL');
}

function findLastGame(games) {
  const completed = games.filter(g => isGameComplete(g));
  return completed.length ? completed[completed.length - 1] : null;
}

function findNextGame(games, scores) {
  // Check for a live game first
  if (scores?.games) {
    const liveGame = scores.games.find(g =>
      (g.gameState === 'LIVE' || g.gameState === 'CRIT') &&
      (g.homeTeam?.abbrev === 'DAL' || g.awayTeam?.abbrev === 'DAL')
    );
    if (liveGame) {
      liveGame._isLive = true;
      return liveGame;
    }
  }
  return games.find(g => isGameFuture(g)) || null;
}

function buildNextGameCard(game) {
  if (!game) return `<div class="card"><div class="card-header"><svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>NEXT GAME</div><p style="color:var(--text-secondary)">No upcoming games scheduled</p></div>`;

  const opp = getOpponent(game);

  if (game._isLive) {
    const dal = getDallasTeam(game);
    const oppTeam = game.homeTeam?.abbrev === 'DAL' ? game.awayTeam : game.homeTeam;
    return `
      <div class="card">
        <div class="card-header"><svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>LIVE NOW <span class="badge badge-live" style="margin-left:8px">LIVE</span></div>
        <div class="game-matchup">
          <img src="${dal?.logo || ''}" alt="DAL" loading="lazy">
          <div class="game-score">
            <span class="dal-score">${dal?.score ?? 0}</span> - ${oppTeam?.score ?? 0}
          </div>
          <img src="${oppTeam?.logo || ''}" alt="${opp.abbrev}" loading="lazy">
        </div>
        <div class="game-meta">${opp.isHome ? 'vs' : '@'} ${opp.abbrev} &middot; ${game.periodDescriptor?.periodType || ''} P${game.periodDescriptor?.number || ''}</div>
      </div>`;
  }

  return `
    <div class="card">
      <div class="card-header"><svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>NEXT GAME</div>
      <div class="game-matchup">
        <img src="${game.homeTeam?.logo || ''}" alt="${game.homeTeam?.abbrev || ''}" loading="lazy">
        <span class="vs">${game.homeTeam?.abbrev || ''} vs ${game.awayTeam?.abbrev || ''}</span>
        <img src="${game.awayTeam?.logo || ''}" alt="${game.awayTeam?.abbrev || ''}" loading="lazy">
      </div>
      <div class="countdown-value" id="countdown">--</div>
      <div class="game-meta">
        ${formatDate(game.startTimeUTC)} &middot; ${formatTime(game.startTimeUTC)}<br>
        ${getName(game.venue) || ''}
      </div>
    </div>`;
}

function buildLastGameCard(game) {
  if (!game) return `<div class="card"><div class="card-header"><svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>LAST RESULT</div><p style="color:var(--text-secondary)">No recent games</p></div>`;

  const dal = getDallasTeam(game);
  const oppTeam = game.homeTeam?.abbrev === 'DAL' ? game.awayTeam : game.homeTeam;
  const opp = getOpponent(game);
  const won = (dal?.score ?? 0) > (oppTeam?.score ?? 0);
  const lastPeriod = game.gameOutcome?.lastPeriodType;
  let status = 'Final';
  if (lastPeriod === 'OT') status = 'Final (OT)';
  else if (lastPeriod === 'SO') status = 'Final (SO)';

  const resultClass = won ? 'badge-win' : (lastPeriod === 'OT' || lastPeriod === 'SO' ? 'badge-otl' : 'badge-loss');
  const resultText = won ? 'W' : (lastPeriod === 'OT' || lastPeriod === 'SO' ? 'OTL' : 'L');

  return `
    <div class="card">
      <div class="card-header"><svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>LAST RESULT</div>
      <span class="badge ${resultClass}">${resultText}</span>
      <div class="game-matchup">
        <img src="${dal?.logo || ''}" alt="DAL" loading="lazy">
        <div class="game-score">
          <span class="dal-score">${dal?.score ?? 0}</span> - ${oppTeam?.score ?? 0}
        </div>
        <img src="${oppTeam?.logo || ''}" alt="${opp.abbrev}" loading="lazy">
      </div>
      <div class="game-meta">
        ${status} &middot; ${opp.isHome ? 'vs' : '@'} ${opp.abbrev}<br>
        ${formatDate(game.startTimeUTC)}
      </div>
    </div>`;
}

function buildRecordCard(dal) {
  if (!dal) return `<div class="card"><div class="card-header"><svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>RECORD</div><p style="color:var(--text-secondary)">--</p></div>`;

  const record = formatRecord(dal.wins, dal.losses, dal.otLosses);
  const streakType = dal.streakCode || 'W';
  const streakClass = streakType === 'W' ? 'streak-W' : streakType === 'L' ? 'streak-L' : 'streak-OT';

  return `
    <div class="card">
      <div class="card-header"><svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>RECORD</div>
      <div class="record-big">${record}</div>
      <div class="record-pts">
        ${dal.points} ${statLabel('PTS')}
        <span class="streak-badge ${streakClass}">${dal.streakCode || ''}${dal.streakCount || ''}</span>
      </div>
      <div class="record-details">
        <span>Home: ${formatRecord(dal.homeWins || 0, dal.homeLosses || 0, dal.homeOtLosses || 0)}</span>
        <span>Road: ${formatRecord(dal.roadWins || 0, dal.roadLosses || 0, dal.roadOtLosses || 0)}</span>
      </div>
    </div>`;
}

function buildStandingsSnapshot(standings, dal) {
  if (!dal) return `<div class="card"><div class="card-header"><svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>STANDINGS</div><p style="color:var(--text-secondary)">--</p></div>`;

  const division = getName(dal.divisionName);
  const divTeams = standings.standings
    .filter(t => getName(t.divisionName) === division)
    .sort((a, b) => a.divisionSequence - b.divisionSequence);

  const rows = divTeams.map(t => {
    const abbr = t.teamAbbrev?.default || '';
    const isDal = abbr === 'DAL';
    return `<tr class="${isDal ? 'dal-row' : ''}">
      <td>${t.divisionSequence}</td>
      <td>${abbr}</td>
      <td>${t.points}</td>
      <td>${formatRecord(t.wins, t.losses, t.otLosses)}</td>
    </tr>`;
  }).join('');

  const confPos = dal.conferenceSequence;
  const confName = getName(dal.conferenceName);

  return `
    <div class="card">
      <div class="card-header"><svg class="star-icon" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 78,88 50,68 22,88 32,55 5,35 39,35"/></svg>${division.toUpperCase()} DIVISION</div>
      <table class="mini-standings">
        <thead><tr><th>#</th><th>Team</th><th>${statLabel('PTS')}</th><th>Record</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="game-meta" style="margin-top:var(--space-md)">${confPos ? `${confPos}${ordinalSuffix(confPos)} in ${confName} Conference` : ''}</div>
    </div>`;
}

function buildFullStandings(standings) {
  if (!standings?.standings) return '';
  const teams = standings.standings;

  // Group by conference > division
  const conferences = {};
  teams.forEach(t => {
    const conf = getName(t.conferenceName);
    const div = getName(t.divisionName);
    if (!conferences[conf]) conferences[conf] = {};
    if (!conferences[conf][div]) conferences[conf][div] = [];
    conferences[conf][div].push(t);
  });

  // Sort each division by division sequence
  for (const conf of Object.values(conferences)) {
    for (const div of Object.keys(conf)) {
      conf[div].sort((a, b) => a.divisionSequence - b.divisionSequence);
    }
  }

  let html = '<div class="full-standings-section"><h3 style="margin-top:var(--space-xl);margin-bottom:var(--space-md)">NHL Standings</h3>';

  for (const [confName, divisions] of Object.entries(conferences).sort()) {
    html += `<h4 style="color:var(--text-muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin:var(--space-lg) 0 var(--space-sm)">${confName} Conference</h4>`;
    for (const [divName, divTeams] of Object.entries(divisions).sort()) {
      const rows = divTeams.map(t => {
        const abbr = t.teamAbbrev?.default || '';
        const isDal = abbr === 'DAL';
        const gd = (t.goalFor || 0) - (t.goalAgainst || 0);
        const gdStr = gd > 0 ? '+' + gd : String(gd);
        return `<tr class="${isDal ? 'dal-row' : ''}">
          <td>${t.divisionSequence}</td>
          <td><div class="team-cell"><img src="${t.teamLogo}" alt="${abbr}" loading="lazy">${abbr}</div></td>
          <td>${t.gamesPlayed}</td>
          <td>${t.wins}</td>
          <td>${t.losses}</td>
          <td>${t.otLosses}</td>
          <td><strong>${t.points}</strong></td>
          <td>${gdStr}</td>
        </tr>`;
      }).join('');
      html += `
        <div class="table-wrap" style="margin-bottom:var(--space-md)">
          <table class="standings-table">
            <caption>${divName} Division</caption>
            <thead><tr>
              <th>#</th><th>Team</th><th>${statLabel('GP')}</th><th>${statLabel('W')}</th><th>${statLabel('L')}</th><th>${statLabel('OTL')}</th><th>${statLabel('PTS')}</th><th>+/-</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }
  }
  html += '</div>';
  return html;
}

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function startCountdown(utcString) {
  const target = new Date(utcString).getTime();
  const el = document.getElementById('countdown');
  if (!el) return;

  const update = () => {
    if (!document.getElementById('countdown')) {
      cleanupDashboard();
      return;
    }
    document.getElementById('countdown').textContent = formatCountdown(target);
  };
  update();
  countdownInterval = setInterval(update, 1000);
}
