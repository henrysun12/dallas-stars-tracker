import { getBoxScore, getPlayByPlay, getSeasonSchedule, getName } from './api.js';
import { formatDate, statLabel, showLoading, showError } from './utils.js';
import { getScoreboard, getGameSummary } from './espn-api.js';
import { getCurrentTeam } from './teams.js';

let activeTab = 'away';
let activeView = 'boxscore'; // 'boxscore' or 'pbp'

export async function renderGameDetail(container, gameId) {
  showLoading(container);
  try {
    const team = getCurrentTeam();
    const [boxscore, pbp, schedule, oddsData, espnSummary] = await Promise.all([
      getBoxScore(gameId),
      getPlayByPlay(gameId),
      getSeasonSchedule().catch(() => null),
      fetchGameOdds(gameId).catch(() => null),
      fetchEspnSummary(gameId, team).catch(() => null),
    ]);

    let recapUrl = null;
    if (schedule?.games) {
      const schedGame = schedule.games.find(g => String(g.id) === String(gameId));
      if (schedGame?.threeMinRecap) {
        recapUrl = 'https://nhl.com' + schedGame.threeMinRecap;
      }
    }

    const away = boxscore.awayTeam;
    const home = boxscore.homeTeam;
    const isDalHome = home?.abbrev === 'DAL';
    activeTab = isDalHome ? 'home' : 'away';

    // Build player info map from rosterSpots: id -> { name, pos, number, teamId }
    const playerMap = new Map();
    (pbp.rosterSpots || []).forEach(p => {
      playerMap.set(p.playerId, {
        name: `${getName(p.firstName)} ${getName(p.lastName)}`,
        pos: p.positionCode,
        number: p.sweaterNumber,
        teamId: p.teamId,
      });
    });

    const goals = (pbp.plays || []).filter(p => p.typeCode === 505);

    const periodType = boxscore.gameOutcome?.lastPeriodType || boxscore.periodDescriptor?.periodType;
    let statusText = 'Final';
    if (periodType === 'OT') statusText = 'Final (OT)';
    else if (periodType === 'SO') statusText = 'Final (SO)';

    container.innerHTML = `
      <div class="game-detail">
        <a href="#schedule" class="back-link">&larr; Back to Schedule</a>

        <div class="game-header-card card">
          <div class="game-header">
            <div class="game-header-team">
              <img src="${away?.logo || ''}" alt="${away?.abbrev}" loading="lazy">
              <span class="game-header-abbrev">${away?.abbrev || ''}</span>
              <span class="game-header-name">${getName(away?.name) || getName(away?.commonName) || ''}</span>
            </div>
            <div class="game-header-score">
              <span class="${away?.abbrev === 'DAL' ? 'dal-score' : ''}">${away?.score ?? 0}</span>
              <span class="score-divider">&mdash;</span>
              <span class="${home?.abbrev === 'DAL' ? 'dal-score' : ''}">${home?.score ?? 0}</span>
            </div>
            <div class="game-header-team">
              <img src="${home?.logo || ''}" alt="${home?.abbrev}" loading="lazy">
              <span class="game-header-abbrev">${home?.abbrev || ''}</span>
              <span class="game-header-name">${getName(home?.name) || getName(home?.commonName) || ''}</span>
            </div>
          </div>
          <div class="game-header-meta">
            ${statusText} &middot; ${formatDate(boxscore.startTimeUTC || boxscore.gameDate)}
            &middot; ${statLabel('SOG')}: ${away?.sog ?? '--'} - ${home?.sog ?? '--'}
          </div>
          ${recapUrl ? `<a href="${recapUrl}" target="_blank" rel="noopener" class="recap-link">&#9654; Watch 3-Min Recap</a>` : ''}
        </div>

        ${goals.length ? `
        <h3 class="section-heading">Goal Highlights</h3>
        <div class="goals-list">
          ${goals.map(g => buildGoalEvent(g, playerMap, away, home, pbp.plays)).join('')}
        </div>` : ''}

        ${buildVideoClips(espnSummary)}

        ${oddsData ? buildGameOdds(oddsData, away?.abbrev, home?.abbrev) : ''}

        <div class="view-toggle" id="view-toggle">
          <button class="view-toggle-btn ${activeView === 'boxscore' ? 'active' : ''}" data-view="boxscore">Box Score</button>
          <button class="view-toggle-btn ${activeView === 'pbp' ? 'active' : ''}" data-view="pbp">Play-by-Play</button>
        </div>

        <div id="detail-view-content">
          ${activeView === 'boxscore' ? buildBoxScoreView(boxscore, away, home) : buildPlayByPlay(pbp, away, home)}
        </div>
      </div>
    `;

    // Wire up view toggle
    container.querySelectorAll('#view-toggle .view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#view-toggle .view-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeView = btn.dataset.view;
        const viewEl = document.getElementById('detail-view-content');
        if (viewEl) {
          viewEl.innerHTML = activeView === 'boxscore'
            ? buildBoxScoreView(boxscore, away, home)
            : buildPlayByPlay(pbp, away, home);
          wireBoxScoreTabs(container, boxscore);
        }
      });
    });

    // Wire box score tabs
    wireBoxScoreTabs(container, boxscore);

  } catch (e) {
    console.error('Game detail error:', e);
    showError(container, 'Unable to load game details.');
  }
}

// Decode situationCode: e.g. "1551" -> { away: 5, home: 5, goalieAway: 1, goalieHome: 1 }
function decodeSituation(code) {
  if (!code || code.length < 4) return null;
  const digits = code.split('').map(Number);
  // Format: [awayGoalie][awaySkaters][homeSkaters][homeGoalie]
  return {
    awayGoalie: digits[0],
    awaySkaters: digits[1],
    homeSkaters: digits[2],
    homeGoalie: digits[3],
  };
}

function getSituationLabel(code, scoringTeamId, awayId, homeId) {
  const sit = decodeSituation(code);
  if (!sit) return { label: 'ES', full: 'Even Strength', cssClass: 'sit-es' };

  const awayTotal = sit.awaySkaters;
  const homeTotal = sit.homeSkaters;

  if (awayTotal === homeTotal) {
    if (awayTotal === 5) return { label: 'ES', full: 'Even Strength (5 on 5)', cssClass: 'sit-es' };
    if (awayTotal === 4) return { label: '4v4', full: 'Even Strength (4 on 4)', cssClass: 'sit-es' };
    if (awayTotal === 3) return { label: '3v3', full: 'Even Strength (3 on 3)', cssClass: 'sit-es' };
    return { label: `${awayTotal}v${homeTotal}`, full: `Even Strength (${awayTotal} on ${homeTotal})`, cssClass: 'sit-es' };
  }

  // Determine if scoring team had advantage
  const scorerIsAway = scoringTeamId === awayId;
  const scorerSkaters = scorerIsAway ? awayTotal : homeTotal;
  const defenderSkaters = scorerIsAway ? homeTotal : awayTotal;

  if (scorerSkaters > defenderSkaters) {
    return { label: 'PP', full: `Power Play (${scorerSkaters} on ${defenderSkaters})`, cssClass: 'sit-pp' };
  } else {
    return { label: 'SH', full: `Shorthanded (${scorerSkaters} on ${defenderSkaters})`, cssClass: 'sit-sh' };
  }
}

const POS_LABELS = {
  C: 'Center',
  L: 'Left Wing',
  R: 'Right Wing',
  D: 'Defenseman',
  G: 'Goalie',
};

function playerTag(id, playerMap, role) {
  const p = playerMap.get(id);
  if (!p) return '';
  const posLabel = POS_LABELS[p.pos] || p.pos;
  return `<div class="play-player ${role}">
    <span class="play-player-pos">${p.pos}</span>
    <span class="play-player-name">#${p.number} ${p.name}</span>
    <span class="play-player-role">${posLabel} &middot; ${role === 'scorer' ? 'Goal' : role === 'goalie' ? 'In Net' : 'Assist'}</span>
  </div>`;
}

function buildGoalEvent(goal, playerMap, away, home, allPlays) {
  const d = goal.details || {};
  const scorerInfo = playerMap.get(d.scoringPlayerId);
  const scorer = scorerInfo?.name || 'Unknown';

  const period = goal.periodDescriptor?.number || '';
  const periodType = goal.periodDescriptor?.periodType || 'REG';
  let periodLabel = `P${period}`;
  if (periodType === 'OT') periodLabel = 'OT';
  else if (periodType === 'SO') periodLabel = 'SO';

  const time = goal.timeInPeriod || '';
  const scoreAfter = `${d.awayScore || 0}-${d.homeScore || 0}`;

  const scoringTeamId = d.eventOwnerTeamId;
  const scoringTeamAbbrev = scoringTeamId === away?.id ? away?.abbrev :
                            scoringTeamId === home?.id ? home?.abbrev : '';
  const defendingTeamAbbrev = scoringTeamId === away?.id ? home?.abbrev : away?.abbrev;
  const isDalGoal = scoringTeamAbbrev === 'DAL';

  const shotType = d.shotType || '';
  const videoUrl = d.highlightClipSharingUrl || '';
  const goalNumber = d.scoringPlayerTotal ? `(${d.scoringPlayerTotal})` : '';

  // Situation / strength
  const situation = getSituationLabel(goal.situationCode, scoringTeamId, away?.id, home?.id);

  // Build involved players for the scoring team
  const scoringPlayers = [];
  if (d.scoringPlayerId) scoringPlayers.push(playerTag(d.scoringPlayerId, playerMap, 'scorer'));
  if (d.assist1PlayerId) scoringPlayers.push(playerTag(d.assist1PlayerId, playerMap, 'assist'));
  if (d.assist2PlayerId) scoringPlayers.push(playerTag(d.assist2PlayerId, playerMap, 'assist'));

  // Defending goalie
  const goalieTag = d.goalieInNetId ? playerTag(d.goalieInNetId, playerMap, 'goalie') : '';

  return `
    <div class="goal-event ${isDalGoal ? 'goal-event-dal' : ''}">
      <div class="goal-event-top">
        <div class="goal-event-header">
          <span class="goal-score">${scoreAfter}</span>
          <span class="goal-team-badge">${scoringTeamAbbrev}</span>
          <span class="goal-time">${periodLabel} ${time}</span>
          <span class="sit-badge ${situation.cssClass}" title="${situation.full}">${situation.label}</span>
        </div>
        <div class="goal-event-summary">
          <strong>${scorer}</strong> ${goalNumber} ${shotType ? `&middot; ${shotType}` : ''}
        </div>
        ${videoUrl ? `<a href="${videoUrl}" target="_blank" rel="noopener" class="goal-video-link">&#9654; Watch</a>` : ''}
      </div>
      ${buildRinkDiagram(goal, playerMap, away, home, allPlays)}
      <div class="goal-formations">
        <div class="goal-formation-side">
          <div class="formation-label">${scoringTeamAbbrev} &mdash; Scoring</div>
          <div class="formation-players">${scoringPlayers.join('')}</div>
        </div>
        <div class="goal-formation-side formation-defense">
          <div class="formation-label">${defendingTeamAbbrev} &mdash; Defending</div>
          <div class="formation-players">${goalieTag || '<div class="play-player goalie"><span class="play-player-name">Empty Net</span></div>'}</div>
        </div>
      </div>
    </div>`;
}

function buildBoxScore(boxscore, team) {
  const teamKey = team === 'home' ? 'homeTeam' : 'awayTeam';
  const stats = boxscore.playerByGameStats?.[teamKey];
  if (!stats) return '<p style="color:var(--text-secondary);padding:var(--space-lg)">No stats available</p>';

  const forwards = stats.forwards || [];
  const defense = stats.defense || [];
  const goalies = stats.goalies || [];

  let html = '';
  if (forwards.length) html += buildSkaterTable('Forwards', forwards);
  if (defense.length) html += buildSkaterTable('Defensemen', defense);
  if (goalies.length) html += buildGoalieTable(goalies);
  return html;
}

function buildSkaterTable(label, players) {
  const rows = players.map(p => {
    const name = getName(p.name);
    const pm = p.plusMinus != null ? (p.plusMinus > 0 ? '+' + p.plusMinus : String(p.plusMinus)) : '--';
    return `<tr>
      <td class="name-cell">#${p.sweaterNumber || ''} ${name}</td>
      <td>${p.goals ?? 0}</td>
      <td>${p.assists ?? 0}</td>
      <td><strong>${p.points ?? 0}</strong></td>
      <td>${pm}</td>
      <td>${p.sog ?? 0}</td>
      <td>${p.toi || '--'}</td>
      <td>${p.hits ?? 0}</td>
      <td>${p.blockedShots ?? 0}</td>
      <td>${p.pim ?? 0}</td>
    </tr>`;
  }).join('');

  return `
    <div class="boxscore-section">
      <h4>${label}</h4>
      <div class="table-wrap">
        <table class="boxscore-table">
          <thead><tr>
            <th class="name-header">Player</th>
            <th>${statLabel('G')}</th>
            <th>${statLabel('A')}</th>
            <th>${statLabel('PTS')}</th>
            <th>${statLabel('+/-')}</th>
            <th>${statLabel('SOG')}</th>
            <th>${statLabel('TOI')}</th>
            <th>Hits</th>
            <th>BLK</th>
            <th>${statLabel('PIM')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

async function fetchGameOdds(gameId) {
  try {
    const team = getCurrentTeam();
    // Get game date from schedule
    const sched = await getSeasonSchedule();
    const game = sched?.games?.find(g => String(g.id) === String(gameId));
    if (!game?.startTimeUTC) return null;
    const dateStr = new Date(game.startTimeUTC).toISOString().slice(0, 10).replace(/-/g, '');
    const scoreboard = await getScoreboard(team, dateStr);
    const events = scoreboard?.events || [];
    const matchingEvent = events.find(ev => {
      const comps = ev?.competitions?.[0]?.competitors || [];
      const abbrevs = comps.map(c => c.team?.abbreviation);
      return abbrevs.includes('DAL') || abbrevs.includes(game.homeTeam?.abbrev) || abbrevs.includes(game.awayTeam?.abbrev);
    });
    if (!matchingEvent) return null;
    const odds = matchingEvent?.competitions?.[0]?.odds;
    if (!odds?.length) return null;
    return odds.find(o => o.provider?.name?.toLowerCase().includes('draft')) || odds[0];
  } catch { return null; }
}

function buildGameOdds(odds, awayAbbr, homeAbbr) {
  if (!odds) return '';
  const fmtMoney = v => { if (v == null) return '--'; const n = Number(v); return n > 0 ? `+${n}` : String(n); };
  const spread = odds.spread;
  const ou = odds.overUnder;
  const homeML = odds.homeTeamOdds?.moneyLine;
  const awayML = odds.awayTeamOdds?.moneyLine;
  const homeFav = odds.homeTeamOdds?.favorite;
  const awayFav = odds.awayTeamOdds?.favorite;
  return `
    <div class="odds-section">
      <h3 class="section-heading">Betting Lines</h3>
      <div class="odds-provider"><span class="odds-provider-name">${odds.provider?.name || 'Sportsbook'}</span></div>
      <div class="odds-grid">
        ${spread != null ? `<div class="odds-card"><div class="odds-card-label">Spread</div><div class="odds-card-value">${odds.details || ''}</div>
          <div class="odds-teams"><div class="odds-team"><span class="odds-team-abbr">${awayAbbr}</span><span class="odds-team-value ${awayFav ? 'fav' : ''}">${fmtMoney(odds.awayTeamOdds?.spreadOdds)}</span></div>
          <div class="odds-team"><span class="odds-team-abbr">${homeAbbr}</span><span class="odds-team-value ${homeFav ? 'fav' : ''}">${fmtMoney(odds.homeTeamOdds?.spreadOdds)}</span></div></div></div>` : ''}
        ${homeML != null || awayML != null ? `<div class="odds-card"><div class="odds-card-label">Moneyline</div>
          <div class="odds-teams" style="margin-top:var(--space-md)"><div class="odds-team"><span class="odds-team-abbr">${awayAbbr}</span><span class="odds-team-value ${awayFav ? 'fav' : ''}" style="font-size:1.3rem;font-weight:700">${fmtMoney(awayML)}</span></div>
          <div class="odds-team"><span class="odds-team-abbr">${homeAbbr}</span><span class="odds-team-value ${homeFav ? 'fav' : ''}" style="font-size:1.3rem;font-weight:700">${fmtMoney(homeML)}</span></div></div></div>` : ''}
        ${ou != null ? `<div class="odds-card"><div class="odds-card-label">Over/Under</div><div class="odds-card-value">${ou}</div>
          <div class="odds-teams"><div class="odds-team"><span class="odds-team-abbr">Over</span><span class="odds-team-value">${fmtMoney(odds.overOdds)}</span></div>
          <div class="odds-team"><span class="odds-team-abbr">Under</span><span class="odds-team-value">${fmtMoney(odds.underOdds)}</span></div></div></div>` : ''}
      </div>
      <div class="odds-disclaimer">Odds provided by ${odds.provider?.name || 'Sportsbook'}. Lines subject to change.</div>
    </div>`;
}

function buildGoalieTable(goalies) {
  const rows = goalies.map(p => {
    const name = getName(p.name);
    const sa = p.shotsAgainst ?? '--';
    const sv = p.saves ?? '--';
    const ga = p.goalsAgainst ?? '--';
    let svPct = '--';
    if (p.savePctg != null) {
      svPct = '.' + (p.savePctg * 1000).toFixed(0);
    } else if (typeof sa === 'number' && typeof sv === 'number' && sa > 0) {
      svPct = '.' + ((sv / sa) * 1000).toFixed(0);
    }
    return `<tr>
      <td class="name-cell">#${p.sweaterNumber || ''} ${name}</td>
      <td>${p.saveShotsAgainst || `${sv}/${sa}`}</td>
      <td>${svPct}</td>
      <td>${ga}</td>
      <td>${p.toi || '--'}</td>
      <td>${p.pim ?? 0}</td>
    </tr>`;
  }).join('');

  return `
    <div class="boxscore-section">
      <h4>Goalies</h4>
      <div class="table-wrap">
        <table class="boxscore-table">
          <thead><tr>
            <th class="name-header">Player</th>
            <th>SV-SA</th>
            <th>${statLabel('SV%')}</th>
            <th>${statLabel('GA')}</th>
            <th>${statLabel('TOI')}</th>
            <th>${statLabel('PIM')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ─── Box Score View with Tabs ─────────────────────────────
function buildBoxScoreView(boxscore, away, home) {
  return `
    <div class="boxscore-tabs" id="boxscore-tabs">
      <button class="filter-btn ${activeTab === 'away' ? 'active' : ''}" data-team="away">${away?.abbrev || 'Away'}</button>
      <button class="filter-btn ${activeTab === 'home' ? 'active' : ''}" data-team="home">${home?.abbrev || 'Home'}</button>
    </div>
    <div id="boxscore-content">
      ${buildBoxScore(boxscore, activeTab)}
    </div>`;
}

function wireBoxScoreTabs(container, boxscore) {
  container.querySelectorAll('#boxscore-tabs .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#boxscore-tabs .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.team;
      const el = document.getElementById('boxscore-content');
      if (el) el.innerHTML = buildBoxScore(boxscore, activeTab);
    });
  });
}

// ─── Play-by-Play ─────────────────────────────────────────
function buildPlayByPlay(pbp, away, home) {
  const plays = pbp?.plays || [];
  if (!plays.length) return '<p style="color:var(--text-secondary);padding:var(--space-lg)">No play-by-play data available</p>';

  const playerMap = new Map();
  (pbp.rosterSpots || []).forEach(p => {
    playerMap.set(p.playerId, {
      name: `${getName(p.firstName)} ${getName(p.lastName)}`,
      pos: p.positionCode,
      number: p.sweaterNumber,
      teamId: p.teamId,
    });
  });

  // Group plays by period, show in reverse chronological order
  const periods = {};
  for (const play of plays) {
    const pNum = play.periodDescriptor?.number || 1;
    const pType = play.periodDescriptor?.periodType || 'REG';
    const key = pType === 'OT' ? 'OT' : pType === 'SO' ? 'SO' : `P${pNum}`;
    if (!periods[key]) periods[key] = [];
    periods[key].push(play);
  }

  let html = '<div class="pbp-list">';
  const periodKeys = Object.keys(periods);

  for (const pKey of periodKeys) {
    html += `<div class="pbp-period-header">${pKey === 'OT' ? 'Overtime' : pKey === 'SO' ? 'Shootout' : `Period ${pKey.slice(1)}`}</div>`;

    const periodPlays = periods[pKey]
      .filter(p => ['goal', 'penalty', 'shot-on-goal', 'hit', 'blocked-shot', 'faceoff', 'giveaway', 'takeaway', 'period-start', 'period-end', 'stoppage'].includes(p.typeDescKey))
      .reverse(); // Most recent first within period

    for (const play of periodPlays) {
      const type = play.typeDescKey;
      const time = play.timeInPeriod || '';
      const det = play.details || {};
      const eventTeamId = det.eventOwnerTeamId;
      const teamLogo = eventTeamId === away?.id ? (away?.logo || '') : eventTeamId === home?.id ? (home?.logo || '') : '';
      const teamAbbr = eventTeamId === away?.id ? away?.abbrev : eventTeamId === home?.id ? home?.abbrev : '';

      if (type === 'period-start' || type === 'period-end') {
        html += `<div class="pbp-event pbp-period-start">${type === 'period-start' ? 'Period Start' : 'End of Period'}</div>`;
        continue;
      }

      let cssClass = '';
      let text = '';
      let scoreUpdate = '';

      if (type === 'goal') {
        cssClass = 'pbp-goal';
        const scorer = playerMap.get(det.scoringPlayerId);
        const a1 = playerMap.get(det.assist1PlayerId);
        const a2 = playerMap.get(det.assist2PlayerId);
        text = `<strong>${scorer?.name || 'Goal'}</strong> (${det.scoringPlayerTotal || 0})`;
        if (a1) text += ` from ${a1.name}`;
        if (a2) text += ` and ${a2.name}`;
        if (det.shotType) text += ` &middot; ${det.shotType}`;
        scoreUpdate = `${det.awayScore || 0}-${det.homeScore || 0}`;
      } else if (type === 'penalty') {
        cssClass = 'pbp-penalty';
        const player = playerMap.get(det.committedByPlayerId);
        text = `<strong>${player?.name || 'Penalty'}</strong> &middot; ${det.descKey || ''} (${det.duration || 2} min)`;
      } else if (type === 'shot-on-goal') {
        const shooter = playerMap.get(det.shootingPlayerId);
        text = `${shooter?.name || 'Shot'} &middot; shot on goal`;
      } else if (type === 'hit') {
        const hitter = playerMap.get(det.hittingPlayerId);
        const hittee = playerMap.get(det.hitteePlayerId);
        text = `${hitter?.name || '?'} hit ${hittee?.name || '?'}`;
      } else if (type === 'blocked-shot') {
        const blocker = playerMap.get(det.blockingPlayerId);
        text = `${blocker?.name || '?'} blocked shot`;
      } else if (type === 'faceoff') {
        const winner = playerMap.get(det.winningPlayerId);
        text = `${winner?.name || '?'} won faceoff`;
      } else if (type === 'giveaway') {
        const player = playerMap.get(det.playerId);
        text = `${player?.name || '?'} giveaway`;
      } else if (type === 'takeaway') {
        const player = playerMap.get(det.playerId);
        text = `${player?.name || '?'} takeaway`;
      } else {
        text = type.replace(/-/g, ' ');
      }

      html += `
        <div class="pbp-event ${cssClass}">
          <span class="pbp-time">${time}</span>
          ${teamLogo ? `<img src="${teamLogo}" alt="${teamAbbr}" class="pbp-team-logo" loading="lazy">` : '<span style="width:20px"></span>'}
          <span class="pbp-text">${text}</span>
          ${scoreUpdate ? `<span class="pbp-score-update">${scoreUpdate}</span>` : ''}
        </div>`;
    }
  }

  html += '</div>';
  return html;
}

// ─── 2D Rink Visualization ────────────────────────────────
function buildRinkDiagram(goal, playerMap, away, home, allPlays) {
  const d = goal.details || {};
  const x = d.xCoord;
  const y = d.yCoord;
  if (x == null || y == null) return '';

  const scoringTeamId = d.eventOwnerTeamId;
  const isAwayScorer = scoringTeamId === away?.id;
  const scorerColor = isAwayScorer ? '#3b82f6' : '#ef4444';
  const defenderColor = isAwayScorer ? '#ef4444' : '#3b82f6';

  // NHL rink: 200ft x 85ft, coordinates centered at (0,0)
  // SVG viewBox: -100 to 100 x, -42.5 to 42.5 y
  // Normalize coordinates: NHL API uses -100 to 100 for x, -42 to 42 for y
  const puckX = x;
  const puckY = -y; // Flip y for SVG

  // Goal net positions
  const goalX = x > 0 ? 89 : -89;
  const goalY = 0;

  // Generate nearby player positions from surrounding plays
  const players = [];
  const scorerP = playerMap.get(d.scoringPlayerId);
  if (scorerP) players.push({ x: puckX, y: puckY, label: scorerP.number || '', color: scorerColor, role: 'scorer' });
  if (d.assist1PlayerId) {
    const a1 = playerMap.get(d.assist1PlayerId);
    if (a1) players.push({ x: puckX + (Math.random() * 16 - 8), y: puckY + (Math.random() * 12 - 6), label: a1.number || '', color: scorerColor, role: 'assist' });
  }
  if (d.assist2PlayerId) {
    const a2 = playerMap.get(d.assist2PlayerId);
    if (a2) players.push({ x: puckX + (Math.random() * 20 - 10), y: puckY + (Math.random() * 14 - 7), label: a2.number || '', color: scorerColor, role: 'assist' });
  }
  // Goalie at the net
  if (d.goalieInNetId) {
    const goalie = playerMap.get(d.goalieInNetId);
    if (goalie) players.push({ x: goalX, y: goalY, label: goalie.number || '', color: defenderColor, role: 'goalie' });
  }

  const playerDots = players.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${p.color}" class="rink-player-dot"/>
     <text x="${p.x}" y="${p.y}" class="rink-player-label">${p.label}</text>`
  ).join('');

  return `
    <div class="rink-container">
      <svg class="rink-svg" viewBox="-105 -47 210 94" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="var(--victory-green-light)"/>
          </marker>
        </defs>
        <!-- Ice surface -->
        <rect x="-100" y="-42.5" width="200" height="85" class="rink-ice" rx="28" ry="28"/>
        <!-- Center line & dot -->
        <line x1="0" y1="-42.5" x2="0" y2="42.5" class="rink-center-line"/>
        <circle cx="0" cy="0" r="15" class="rink-faceoff-circle"/>
        <circle cx="0" cy="0" r="2" class="rink-center-dot"/>
        <!-- Blue lines -->
        <line x1="-25" y1="-42.5" x2="-25" y2="42.5" class="rink-blue-line"/>
        <line x1="25" y1="-42.5" x2="25" y2="42.5" class="rink-blue-line"/>
        <!-- Goal lines -->
        <line x1="-89" y1="-42.5" x2="-89" y2="42.5" class="rink-goal-line" stroke-dasharray="2 2"/>
        <line x1="89" y1="-42.5" x2="89" y2="42.5" class="rink-goal-line" stroke-dasharray="2 2"/>
        <!-- Creases -->
        <rect x="-93" y="-4" width="4" height="8" class="rink-crease" rx="1"/>
        <rect x="89" y="-4" width="4" height="8" class="rink-crease" rx="1"/>
        <!-- Goal nets -->
        <rect x="-97" y="-3" width="4" height="6" fill="none" stroke="#666" stroke-width="0.5" rx="1"/>
        <rect x="93" y="-3" width="4" height="6" fill="none" stroke="#666" stroke-width="0.5" rx="1"/>
        <!-- Faceoff circles & dots in zones -->
        <circle cx="-69" cy="-22" r="15" class="rink-faceoff-circle"/>
        <circle cx="-69" cy="22" r="15" class="rink-faceoff-circle"/>
        <circle cx="69" cy="-22" r="15" class="rink-faceoff-circle"/>
        <circle cx="69" cy="22" r="15" class="rink-faceoff-circle"/>
        <circle cx="-69" cy="-22" r="1.5" class="rink-faceoff-dot"/>
        <circle cx="-69" cy="22" r="1.5" class="rink-faceoff-dot"/>
        <circle cx="69" cy="-22" r="1.5" class="rink-faceoff-dot"/>
        <circle cx="69" cy="22" r="1.5" class="rink-faceoff-dot"/>
        <!-- Neutral zone dots -->
        <circle cx="-22" cy="-22" r="1" class="rink-faceoff-dot"/>
        <circle cx="-22" cy="22" r="1" class="rink-faceoff-dot"/>
        <circle cx="22" cy="-22" r="1" class="rink-faceoff-dot"/>
        <circle cx="22" cy="22" r="1" class="rink-faceoff-dot"/>
        <!-- Shot arrow -->
        <line x1="${puckX}" y1="${puckY}" x2="${goalX}" y2="${goalY}" class="rink-shot-arrow"/>
        <!-- Player dots -->
        ${playerDots}
        <!-- Puck (shot location) -->
        <circle cx="${puckX}" cy="${puckY}" r="2.5" class="rink-puck"/>
      </svg>
      <div class="rink-legend">
        <div class="rink-legend-item"><span class="rink-legend-dot" style="background:${scorerColor}"></span> ${isAwayScorer ? away?.abbrev : home?.abbrev}</div>
        <div class="rink-legend-item"><span class="rink-legend-dot" style="background:${defenderColor}"></span> ${isAwayScorer ? home?.abbrev : away?.abbrev}</div>
        <div class="rink-legend-item"><span class="rink-legend-dot" style="background:#111;border:1.5px solid var(--victory-green-light)"></span> Shot</div>
      </div>
    </div>`;
}

// ─── Video Clips from ESPN ────────────────────────────────
async function fetchEspnSummary(gameId, team) {
  try {
    const sched = await getSeasonSchedule();
    const game = sched?.games?.find(g => String(g.id) === String(gameId));
    if (!game?.startTimeUTC) return null;
    const dateStr = new Date(game.startTimeUTC).toISOString().slice(0, 10).replace(/-/g, '');
    const scoreboard = await getScoreboard(team, dateStr);
    const events = scoreboard?.events || [];
    // Find matching event by team abbreviations
    const matchingEvent = events.find(ev => {
      const comps = ev?.competitions?.[0]?.competitors || [];
      const abbrevs = comps.map(c => c.team?.abbreviation);
      return abbrevs.includes(game.homeTeam?.abbrev) && abbrevs.includes(game.awayTeam?.abbrev);
    });
    if (!matchingEvent) return null;
    return await getGameSummary(team, matchingEvent.id);
  } catch { return null; }
}

function buildVideoClips(espnSummary) {
  const videos = espnSummary?.videos || [];
  if (!videos.length) return '';

  const cards = videos.slice(0, 8).map(v => {
    const headline = v.headline || '';
    const duration = v.duration || 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const webUrl = v.links?.web?.href || v.links?.source?.href || '';
    const thumbnail = v.thumbnail || '';

    if (!webUrl) return '';

    return `
      <a class="clip-card" href="${webUrl}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
        <div class="clip-thumbnail">
          ${thumbnail ? `<img src="${thumbnail}" alt="" loading="lazy">` : ''}
          <div class="clip-play-overlay"><div class="clip-play-btn"></div></div>
          <span class="clip-duration">${durationStr}</span>
        </div>
        <div class="clip-info">
          <div class="clip-headline">${headline}</div>
        </div>
      </a>`;
  }).filter(Boolean).join('');

  if (!cards) return '';

  return `
    <h3 class="section-heading">Video Highlights</h3>
    <div class="clips-grid">${cards}</div>`;
}

