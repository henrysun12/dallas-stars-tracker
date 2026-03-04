import { getBoxScore, getPlayByPlay, getName } from './api.js';
import { formatDate, statLabel, showLoading, showError } from './utils.js';
import { getScoreboard } from './espn-api.js';
import { getCurrentTeam } from './teams.js';

let pollInterval = null;

function cleanup() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

export async function renderNHLLive(container, gameId) {
  cleanup();
  showLoading(container);
  try {
    await renderLiveData(container, gameId);
    // Poll every 10s for live updates
    pollInterval = setInterval(async () => {
      try {
        const el = document.getElementById('nhl-live-container');
        if (!el) { cleanup(); return; }
        await renderLiveData(container, gameId);
      } catch (_) {}
    }, 10000);
  } catch (e) {
    console.error('NHL Live error:', e);
    showError(container, 'Unable to load live game data.');
  }
}

async function renderLiveData(container, gameId) {
  const [boxscore, pbp] = await Promise.all([
    getBoxScore(gameId),
    getPlayByPlay(gameId),
  ]);

  const away = boxscore.awayTeam;
  const home = boxscore.homeTeam;

  // Fetch ESPN odds
  let oddsData = null;
  try {
    const espnTeam = getCurrentTeam();
    const gameDate = boxscore.gameDate || new Date().toISOString();
    const dateStr = gameDate.slice(0, 10).replace(/-/g, '');
    const scoreboard = await getScoreboard(espnTeam, dateStr);
    const events = scoreboard?.events || [];
    const matchingEvent = events.find(ev => {
      const comps = ev?.competitions?.[0]?.competitors || [];
      const abbrevs = comps.map(c => c.team?.abbreviation);
      return abbrevs.includes(away?.abbrev) && abbrevs.includes(home?.abbrev);
    });
    if (matchingEvent) {
      const odds = matchingEvent?.competitions?.[0]?.odds;
      if (odds?.length) {
        oddsData = odds.find(o => o.provider?.name?.toLowerCase().includes('draft kings') || o.provider?.name?.toLowerCase().includes('draftkings')) || odds[0];
      }
    }
  } catch (e) {
    console.warn('Could not fetch ESPN odds for live game:', e);
  }
  const isDalHome = home?.abbrev === 'DAL';
  const period = boxscore.periodDescriptor?.number || '';
  const periodType = boxscore.periodDescriptor?.periodType || 'REG';
  const clock = boxscore.clock?.timeRemaining || '';
  const isLive = boxscore.gameState === 'LIVE' || boxscore.gameState === 'CRIT';
  const isFinal = !!boxscore.gameOutcome || boxscore.gameState === 'FINAL';

  let periodLabel = `P${period}`;
  if (periodType === 'OT') periodLabel = 'OT';
  else if (periodType === 'SO') periodLabel = 'SO';

  let statusText = '';
  if (isLive) statusText = `${periodLabel} ${clock}`;
  else if (isFinal) {
    statusText = 'Final';
    if (periodType === 'OT') statusText = 'Final (OT)';
    else if (periodType === 'SO') statusText = 'Final (SO)';
  } else {
    statusText = 'Pregame';
  }

  // Build player map from rosterSpots
  const playerMap = new Map();
  (pbp.rosterSpots || []).forEach(p => {
    playerMap.set(p.playerId, {
      name: `${getName(p.firstName)} ${getName(p.lastName)}`,
      pos: p.positionCode,
      number: p.sweaterNumber,
      teamId: p.teamId,
    });
  });

  // All plays, most recent first
  const allPlays = (pbp.plays || []).slice().reverse();
  const goals = allPlays.filter(p => p.typeCode === 505);
  const recentPlays = allPlays.slice(0, 15);

  // Period-by-period line score
  const periods = [];
  const maxPeriod = Math.max(period, ...(pbp.plays || []).map(p => p.periodDescriptor?.number || 0));
  for (let i = 1; i <= maxPeriod; i++) {
    const pGoals = (pbp.plays || []).filter(p => p.typeCode === 505 && p.periodDescriptor?.number === i);
    const awayG = pGoals.filter(g => g.details?.eventOwnerTeamId === away?.id).length;
    const homeG = pGoals.filter(g => g.details?.eventOwnerTeamId === home?.id).length;
    periods.push({ num: i, away: awayG, home: homeG });
  }

  const liveBadge = isLive ? `<span class="badge badge-live" style="margin-left:var(--space-sm);vertical-align:middle">LIVE</span>` : '';

  container.innerHTML = `
    <div class="matchup-preview" id="nhl-live-container">
      <a href="#schedule" class="back-link">&larr; Back to Schedule</a>

      <div class="matchup-header-card card">
        <div class="matchup-header">
          <div class="matchup-team">
            <img src="${away?.logo || ''}" alt="${away?.abbrev}" loading="lazy">
            <span class="matchup-team-abbrev">${away?.abbrev || ''}</span>
            <span class="matchup-team-name">${getName(away?.name) || getName(away?.commonName) || ''}</span>
          </div>
          <div class="matchup-vs">
            <div class="game-header-score" style="font-size:3rem">
              <span class="${away?.abbrev === 'DAL' ? 'dal-score' : ''}">${away?.score ?? 0}</span>
              <span class="score-divider" style="font-size:2rem">&mdash;</span>
              <span class="${home?.abbrev === 'DAL' ? 'dal-score' : ''}">${home?.score ?? 0}</span>
            </div>
          </div>
          <div class="matchup-team">
            <img src="${home?.logo || ''}" alt="${home?.abbrev}" loading="lazy">
            <span class="matchup-team-abbrev">${home?.abbrev || ''}</span>
            <span class="matchup-team-name">${getName(home?.name) || getName(home?.commonName) || ''}</span>
          </div>
        </div>
        <div class="matchup-game-info">
          ${statusText}${liveBadge}
          &middot; ${statLabel('SOG')}: ${away?.sog ?? '--'} - ${home?.sog ?? '--'}
        </div>
      </div>

      ${periods.length > 0 ? `
      <div class="card" style="padding:var(--space-md);margin-bottom:var(--space-lg)">
        <div class="table-wrap">
          <table class="boxscore-table">
            <thead><tr><th></th>${periods.map(p => `<th>${p.num <= 3 ? p.num : (p.num === 4 ? 'OT' : `OT${p.num - 3}`)}</th>`).join('')}<th>T</th></tr></thead>
            <tbody>
              <tr class="${away?.abbrev === 'DAL' ? 'dal-row' : ''}">
                <td><strong>${away?.abbrev || ''}</strong></td>
                ${periods.map(p => `<td>${p.away}</td>`).join('')}
                <td><strong>${away?.score ?? 0}</strong></td>
              </tr>
              <tr class="${home?.abbrev === 'DAL' ? 'dal-row' : ''}">
                <td><strong>${home?.abbrev || ''}</strong></td>
                ${periods.map(p => `<td>${p.home}</td>`).join('')}
                <td><strong>${home?.score ?? 0}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>` : ''}

      ${oddsData ? buildLiveOdds(oddsData, away?.abbrev, home?.abbrev) : ''}

      ${goals.length ? `
      <h3 class="section-heading">Goals</h3>
      <div class="goals-list">
        ${goals.map(g => buildGoalPlay(g, playerMap, away, home)).join('')}
      </div>` : ''}

      <h3 class="section-heading">Recent Plays</h3>
      <div class="play-feed">
        ${recentPlays.map(p => buildPlayItem(p, playerMap, away, home)).join('')}
      </div>

      ${buildLiveBoxScore(boxscore)}
    </div>
  `;
}

function buildGoalPlay(goal, playerMap, away, home) {
  const d = goal.details || {};
  const scorer = playerMap.get(d.scoringPlayerId);
  const scorerName = scorer?.name || 'Unknown';
  const teamId = d.eventOwnerTeamId;
  const teamAbbrev = teamId === away?.id ? away?.abbrev : home?.abbrev;
  const isDal = teamAbbrev === 'DAL';
  const period = goal.periodDescriptor?.number || '';
  const pType = goal.periodDescriptor?.periodType || 'REG';
  let pLabel = `P${period}`;
  if (pType === 'OT') pLabel = 'OT';
  else if (pType === 'SO') pLabel = 'SO';
  const time = goal.timeInPeriod || '';
  const score = `${d.awayScore || 0}-${d.homeScore || 0}`;
  const shotType = d.shotType || '';

  const assists = [];
  if (d.assist1PlayerId) { const a = playerMap.get(d.assist1PlayerId); if (a) assists.push(a.name); }
  if (d.assist2PlayerId) { const a = playerMap.get(d.assist2PlayerId); if (a) assists.push(a.name); }

  return `
    <div class="goal-event ${isDal ? 'goal-event-dal' : ''}">
      <div class="goal-event-top">
        <div class="goal-event-header">
          <span class="goal-score">${score}</span>
          <span class="goal-team-badge">${teamAbbrev}</span>
          <span class="goal-time">${pLabel} ${time}</span>
        </div>
        <div class="goal-event-summary">
          <strong>${scorerName}</strong>${shotType ? ` &middot; ${shotType}` : ''}
          ${assists.length ? `<br><span style="color:var(--text-muted);font-size:0.8rem">Assists: ${assists.join(', ')}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function buildPlayItem(play, playerMap, away, home) {
  const desc = play.typeDescKey || '';
  const time = play.timeInPeriod || '';
  const period = play.periodDescriptor?.number || '';
  const teamId = play.details?.eventOwnerTeamId;
  const teamAbbrev = teamId === away?.id ? away?.abbrev : teamId === home?.id ? home?.abbrev : '';
  const isDal = teamAbbrev === 'DAL';

  // Build description
  let text = desc.replace(/-/g, ' ');
  const playerId = play.details?.scoringPlayerId || play.details?.shootingPlayerId ||
    play.details?.hittingPlayerId || play.details?.playerId;
  if (playerId) {
    const p = playerMap.get(playerId);
    if (p) text = `${p.name} - ${text}`;
  }

  const isGoal = play.typeCode === 505;
  const isPenalty = play.typeCode === 509;

  return `
    <div class="play-item ${isDal ? 'play-item-dal' : ''} ${isGoal ? 'play-item-goal' : ''}" style="display:flex;gap:var(--space-sm);padding:var(--space-xs) var(--space-md);border-bottom:1px solid var(--card-border);font-size:0.8rem;${isDal ? 'border-left:2px solid var(--victory-green);' : ''}">
      <span style="color:var(--text-muted);min-width:55px;flex-shrink:0">P${period} ${time}</span>
      ${teamAbbrev ? `<span style="font-weight:600;min-width:35px;color:${isDal ? 'var(--victory-green-light)' : 'var(--text-secondary)'}">${teamAbbrev}</span>` : '<span style="min-width:35px"></span>'}
      <span style="color:${isGoal ? '#ffd700' : isPenalty ? '#ff6b6b' : 'var(--text-secondary)'}">${isGoal ? '\u{1F6A8} ' : ''}${text}</span>
    </div>`;
}

function buildLiveOdds(odds, awayAbbr, homeAbbr) {
  if (!odds) return '';

  const providerName = odds.provider?.name || 'Sportsbook';

  const fmtMoney = (val) => {
    if (val == null) return '--';
    const n = Number(val);
    return n > 0 ? `+${n}` : String(n);
  };

  const spread = odds.spread;
  const overUnder = odds.overUnder;
  const overOdds = odds.overOdds;
  const underOdds = odds.underOdds;
  const homeML = odds.homeTeamOdds?.moneyLine;
  const awayML = odds.awayTeamOdds?.moneyLine;
  const homeSpreadOdds = odds.homeTeamOdds?.spreadOdds;
  const awaySpreadOdds = odds.awayTeamOdds?.spreadOdds;
  const homeFav = odds.homeTeamOdds?.favorite;
  const awayFav = odds.awayTeamOdds?.favorite;

  return `
    <div class="odds-section">
      <h3 class="section-heading">Betting Lines</h3>
      <div class="odds-provider">
        <span class="odds-provider-name">${providerName}</span>
      </div>
      <div class="odds-grid">
        ${spread != null ? `
        <div class="odds-card">
          <div class="odds-card-label">Spread</div>
          <div class="odds-card-value">${spread > 0 ? '+' : ''}${spread}</div>
          <div class="odds-card-detail">${odds.details || ''}</div>
          <div class="odds-teams">
            <div class="odds-team">
              <span class="odds-team-abbr">${awayAbbr}</span>
              <span class="odds-team-value ${awayFav ? 'fav' : ''}">${spread > 0 ? '+' + spread : String(-spread > 0 ? '+' + (-spread) : spread)}${awaySpreadOdds != null ? ' (' + fmtMoney(awaySpreadOdds) + ')' : ''}</span>
            </div>
            <div class="odds-team">
              <span class="odds-team-abbr">${homeAbbr}</span>
              <span class="odds-team-value ${homeFav ? 'fav' : ''}">${spread > 0 ? String(-spread) : '+' + (-spread)}${homeSpreadOdds != null ? ' (' + fmtMoney(homeSpreadOdds) + ')' : ''}</span>
            </div>
          </div>
        </div>` : ''}

        ${homeML != null || awayML != null ? `
        <div class="odds-card">
          <div class="odds-card-label">Moneyline</div>
          <div class="odds-teams" style="margin-top:var(--space-md)">
            <div class="odds-team">
              <span class="odds-team-abbr">${awayAbbr}</span>
              <span class="odds-team-value ${awayFav ? 'fav' : ''}" style="font-size:1.3rem;font-weight:700">${fmtMoney(awayML)}</span>
            </div>
            <div class="odds-team">
              <span class="odds-team-abbr">${homeAbbr}</span>
              <span class="odds-team-value ${homeFav ? 'fav' : ''}" style="font-size:1.3rem;font-weight:700">${fmtMoney(homeML)}</span>
            </div>
          </div>
        </div>` : ''}

        ${overUnder != null ? `
        <div class="odds-card">
          <div class="odds-card-label">Over/Under</div>
          <div class="odds-card-value">${overUnder}</div>
          <div class="odds-teams">
            <div class="odds-team">
              <span class="odds-team-abbr">Over</span>
              <span class="odds-team-value">${overOdds != null ? fmtMoney(overOdds) : '--'}</span>
            </div>
            <div class="odds-team">
              <span class="odds-team-abbr">Under</span>
              <span class="odds-team-value">${underOdds != null ? fmtMoney(underOdds) : '--'}</span>
            </div>
          </div>
        </div>` : ''}
      </div>
      <div class="odds-disclaimer">Odds provided by ${providerName}. Lines subject to change.</div>
    </div>`;
}

function buildLiveBoxScore(boxscore) {
  const stats = boxscore.playerByGameStats;
  if (!stats) return '';

  let html = '<h3 class="section-heading">Box Score</h3>';
  for (const side of ['awayTeam', 'homeTeam']) {
    const teamStats = stats[side];
    if (!teamStats) continue;
    const teamData = boxscore[side];
    const abbr = teamData?.abbrev || '';
    html += `<h4 style="margin:var(--space-md) 0 var(--space-sm);color:var(--white)">${getName(teamData?.name) || abbr}</h4>`;

    const forwards = teamStats.forwards || [];
    const defense = teamStats.defense || [];
    const goalies = teamStats.goalies || [];

    if (forwards.length || defense.length) {
      const skaters = [...forwards, ...defense];
      html += `<div class="boxscore-section"><div class="table-wrap"><table class="boxscore-table">
        <thead><tr><th class="name-header">Player</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th><th>SOG</th><th>TOI</th></tr></thead>
        <tbody>${skaters.map(p => {
          const name = getName(p.name);
          const pm = p.plusMinus != null ? (p.plusMinus > 0 ? '+' + p.plusMinus : String(p.plusMinus)) : '--';
          return `<tr><td class="name-cell">#${p.sweaterNumber || ''} ${name}</td><td>${p.goals ?? 0}</td><td>${p.assists ?? 0}</td><td><strong>${p.points ?? 0}</strong></td><td>${pm}</td><td>${p.sog ?? 0}</td><td>${p.toi || '--'}</td></tr>`;
        }).join('')}</tbody></table></div></div>`;
    }

    if (goalies.length) {
      html += `<div class="boxscore-section"><h4>Goalies</h4><div class="table-wrap"><table class="boxscore-table">
        <thead><tr><th class="name-header">Player</th><th>SV-SA</th><th>SV%</th><th>GA</th><th>TOI</th></tr></thead>
        <tbody>${goalies.map(p => {
          const name = getName(p.name);
          const sa = p.shotsAgainst ?? '--';
          const sv = p.saves ?? '--';
          let svPct = '--';
          if (p.savePctg != null) svPct = '.' + (p.savePctg * 1000).toFixed(0);
          return `<tr><td class="name-cell">#${p.sweaterNumber || ''} ${name}</td><td>${p.saveShotsAgainst || `${sv}/${sa}`}</td><td>${svPct}</td><td>${p.goalsAgainst ?? '--'}</td><td>${p.toi || '--'}</td></tr>`;
        }).join('')}</tbody></table></div></div>`;
    }
  }
  return html;
}
