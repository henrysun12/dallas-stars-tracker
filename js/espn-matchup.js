import { getCurrentTeam } from './teams.js';
import { getGameSummary, getTeamSchedule, getStandings, getInjuries, getTeamInjuries, findOurTeam, findOppTeam, getCompScore, getEventState, getStatValue, formatEspnDate, formatEspnTime } from './espn-api.js';
import { showLoading, showError } from './utils.js';

export async function renderEspnMatchup(container, eventId) {
  const team = getCurrentTeam();
  showLoading(container);

  try {
    const [gameData, schedData, standData, injData] = await Promise.all([
      getGameSummary(team, eventId),
      getTeamSchedule(team).catch(() => null),
      getStandings(team).catch(() => null),
      getInjuries(team).catch(() => null),
    ]);

    const header = gameData?.header;
    const comp = header?.competitions?.[0];
    const competitors = comp?.competitors || [];
    const ourTeam = competitors.find(c => String(c.id) === String(team.espnTeamId));
    const isOurGame = !!ourTeam;
    const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[0];
    const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[1];
    const us = ourTeam || awayComp;
    const opp = ourTeam ? competitors.find(c => c !== ourTeam) : homeComp;
    const usAbbr = us?.team?.abbreviation || team.abbrev;
    const oppAbbr = opp?.team?.abbreviation || '';
    const usName = us?.team?.displayName || team.name;
    const oppName = opp?.team?.displayName || '';
    const usLogo = us?.team?.logos?.[0]?.href || '';
    const oppLogo = opp?.team?.logos?.[0]?.href || '';
    const usRecord = us?.record?.[0]?.displayValue || '';
    const oppRecord = opp?.record?.[0]?.displayValue || '';
    const venue = gameData?.gameInfo?.venue?.fullName || '';
    const gameDate = comp?.date || '';
    const statusDetail = comp?.status?.type?.detail || '';
    const state = comp?.status?.type?.state || 'pre';

    // Odds from pickcenter
    const pickcenter = gameData?.pickcenter || [];
    const dk = pickcenter.find(p => p.provider?.name?.toLowerCase().includes('draft')) || pickcenter[0];

    // Injuries
    const usInjuries = injData ? getTeamInjuries(injData, usAbbr) : [];
    const oppInjuries = injData ? getTeamInjuries(injData, oppAbbr) : [];

    // Recent form from schedule
    const events = schedData?.events || [];
    const pastGames = events.filter(e => getEventState(e) === 'post');
    const recentGames = pastGames.slice(-10);

    // Win prediction based on records
    const usTeamId = String(us?.id || team.espnTeamId);
    const prediction = buildPrediction(usRecord, oppRecord, dk, usTeamId);

    // If game is already completed or live, redirect to game view
    if (state === 'post' || state === 'in') {
      const { renderEspnGame } = await import('./espn-game.js');
      await renderEspnGame(container, eventId, state === 'in');
      return;
    }

    container.innerHTML = `
      <div class="matchup-preview" id="espn-matchup-container">
        <a href="${isOurGame ? '#schedule' : '#scores'}" class="back-link">&larr; Back to ${isOurGame ? 'Schedule' : 'Scores'}</a>

        <div class="matchup-header-card card">
          <div class="matchup-header">
            <div class="matchup-team">
              <img src="${usLogo}" alt="${usAbbr}" loading="lazy">
              <span class="matchup-team-abbrev">${usAbbr}</span>
              <span class="matchup-team-name">${usName}</span>
              <span class="matchup-team-record">${usRecord}</span>
            </div>
            <div class="matchup-vs">
              <span class="matchup-vs-text">VS</span>
            </div>
            <div class="matchup-team">
              <img src="${oppLogo}" alt="${oppAbbr}" loading="lazy">
              <span class="matchup-team-abbrev">${oppAbbr}</span>
              <span class="matchup-team-name">${oppName}</span>
              <span class="matchup-team-record">${oppRecord}</span>
            </div>
          </div>
          <div class="matchup-game-info">
            ${statusDetail}
            ${venue ? ` &middot; ${venue}` : ''}
            ${gameDate ? `<br>${formatEspnDate(gameDate)} &middot; ${formatEspnTime(gameDate)}` : ''}
          </div>
        </div>

        ${buildPredictionBanner(prediction, usAbbr, oppAbbr)}
        ${dk ? buildOddsSection(dk, usAbbr, oppAbbr, us?.homeAway === 'home') : ''}
        ${buildRecentForm(recentGames, team)}
        ${buildInjurySection(usInjuries, oppInjuries, usAbbr, oppAbbr)}
        ${buildStandingsComparison(standData, usAbbr, oppAbbr)}
      </div>
    `;
  } catch (e) {
    console.error('ESPN Matchup error:', e);
    showError(container, 'Unable to load matchup preview.');
  }
}

function buildPrediction(usRecord, oppRecord, odds, usTeamId) {
  // Simple prediction model based on records and odds
  const parseRecord = (rec) => {
    if (!rec) return { wins: 0, losses: 0, pct: 0.5 };
    const parts = rec.split('-').map(Number);
    const w = parts[0] || 0;
    const l = parts[1] || 0;
    const total = w + l || 1;
    return { wins: w, losses: l, pct: w / total };
  };

  const us = parseRecord(usRecord);
  const opp = parseRecord(oppRecord);

  // Base probability from records
  let usPct = (us.pct + (1 - opp.pct)) / 2;

  // Adjust with moneyline odds if available
  if (odds) {
    const homeML = odds.homeTeamOdds?.moneyLine;
    const awayML = odds.awayTeamOdds?.moneyLine;
    if (homeML && awayML) {
      const implied = mlToProb(homeML) + mlToProb(awayML);
      const homeProb = mlToProb(homeML) / implied;
      const awayProb = mlToProb(awayML) / implied;
      // Use odds-based probability weighted 70/30 with record-based
      const oddsUsPct = odds.homeTeamOdds?.teamId === String(usTeamId) ? homeProb : awayProb;
      usPct = usPct * 0.3 + oddsUsPct * 0.7;
    }
  }

  usPct = Math.max(0.05, Math.min(0.95, usPct));
  return { usPct, oppPct: 1 - usPct };
}

function mlToProb(ml) {
  if (ml > 0) return 100 / (ml + 100);
  return Math.abs(ml) / (Math.abs(ml) + 100);
}

function buildPredictionBanner(pred, usAbbr, oppAbbr) {
  const usPctDisplay = Math.round(pred.usPct * 100);
  const oppPctDisplay = 100 - usPctDisplay;
  const usFav = usPctDisplay >= 50;
  return `
    <div class="prediction-banner card">
      <h3 class="section-heading" style="margin-bottom:var(--space-md)">Win Probability</h3>
      <div class="prediction-odds">
        <div class="odds-side">
          <div class="odds-pct ${usFav ? 'fav' : ''}">${usPctDisplay}%</div>
          <div class="odds-label">${usAbbr}</div>
        </div>
        <div class="odds-bar-container">
          <div class="odds-bar">
            <div class="odds-bar-fill" style="width:${usPctDisplay}%"></div>
          </div>
        </div>
        <div class="odds-side">
          <div class="odds-pct ${!usFav ? 'fav' : ''}">${oppPctDisplay}%</div>
          <div class="odds-label">${oppAbbr}</div>
        </div>
      </div>
    </div>`;
}

function buildOddsSection(odds, usAbbr, oppAbbr, usIsHome) {
  if (!odds) return '';
  const fmtMoney = v => { if (v == null) return '--'; const n = Number(v); return n > 0 ? `+${n}` : String(n); };
  const homeAbbr = usIsHome ? usAbbr : oppAbbr;
  const awayAbbr = usIsHome ? oppAbbr : usAbbr;
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

function buildRecentForm(games, team) {
  if (!games.length) return '';
  const dots = games.map(e => {
    const comp = e.competitions?.[0];
    const us = comp?.competitors?.find(c => String(c.team?.id) === String(team.espnTeamId));
    const won = us?.winner === true;
    const opp = comp?.competitors?.find(c => String(c.team?.id) !== String(team.espnTeamId));
    const oppAbbr = opp?.team?.abbreviation || '';
    const usScore = us?.score || '0';
    const oppScore = opp?.score || '0';
    return `<div class="form-dot ${won ? 'form-win' : 'form-loss'}" title="${won ? 'W' : 'L'} ${usScore}-${oppScore} vs ${oppAbbr}">${won ? 'W' : 'L'}</div>`;
  }).join('');

  const wins = games.filter(e => {
    const comp = e.competitions?.[0];
    const us = comp?.competitors?.find(c => String(c.team?.id) === String(team.espnTeamId));
    return us?.winner === true;
  }).length;

  return `
    <div class="card" style="padding:var(--space-md);margin-bottom:var(--space-lg)">
      <h3 class="section-heading">Recent Form (Last ${games.length})</h3>
      <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap;margin-bottom:var(--space-sm)">${dots}</div>
      <div style="font-size:0.85rem;color:var(--text-secondary)">${wins}-${games.length - wins} in last ${games.length} games</div>
    </div>`;
}

function buildInjurySection(usInjuries, oppInjuries, usAbbr, oppAbbr) {
  if (!usInjuries.length && !oppInjuries.length) return '';
  const renderList = (injuries) => injuries.slice(0, 8).map(inj => {
    const statusClass = inj.statusType === 'INJURY_STATUS_OUT' ? 'injury-out' : inj.statusType === 'INJURY_STATUS_IR' ? 'injury-ir' : 'injury-dtd';
    return `<div class="injury-row ${statusClass}">
      ${inj.headshot ? `<img src="${inj.headshot}" alt="" class="injury-headshot" loading="lazy">` : '<div class="injury-headshot-placeholder"></div>'}
      <div class="injury-info"><span class="injury-name">${inj.name}</span><span class="injury-pos">${inj.position}</span></div>
      <span class="injury-status-badge ${statusClass}">${inj.status}</span>
    </div>`;
  }).join('');

  return `
    <div class="card" style="padding:var(--space-md);margin-bottom:var(--space-lg)">
      <h3 class="section-heading">Injury Report</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
        <div>
          <h4 style="color:var(--victory-green-light);font-size:0.85rem;margin-bottom:var(--space-sm)">${usAbbr} (${usInjuries.length})</h4>
          ${usInjuries.length ? renderList(usInjuries) : '<p style="color:var(--text-muted);font-size:0.85rem">No injuries reported</p>'}
        </div>
        <div>
          <h4 style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:var(--space-sm)">${oppAbbr} (${oppInjuries.length})</h4>
          ${oppInjuries.length ? renderList(oppInjuries) : '<p style="color:var(--text-muted);font-size:0.85rem">No injuries reported</p>'}
        </div>
      </div>
    </div>`;
}

function buildStandingsComparison(standData, usAbbr, oppAbbr) {
  if (!standData?.children) return '';

  const findTeam = (abbr) => {
    for (const conf of standData.children) {
      for (const entry of (conf.standings?.entries || [])) {
        if (entry.team?.abbreviation === abbr) return entry;
      }
      for (const div of (conf.children || [])) {
        for (const entry of (div.standings?.entries || [])) {
          if (entry.team?.abbreviation === abbr) return entry;
        }
      }
    }
    return null;
  };

  const usEntry = findTeam(usAbbr);
  const oppEntry = findTeam(oppAbbr);
  if (!usEntry && !oppEntry) return '';

  const getStat = (entry, name) => {
    const s = entry?.stats?.find(st => st.name === name);
    return s?.displayValue ?? s?.value ?? '--';
  };

  const stats = [
    { label: 'Wins', key: 'wins' },
    { label: 'Losses', key: 'losses' },
    { label: 'Win %', key: 'winPercent' },
    { label: 'Streak', key: 'streak' },
    { label: '+/-', key: 'differential' },
  ];

  const rows = stats.map(s => {
    const usVal = getStat(usEntry, s.key);
    const oppVal = getStat(oppEntry, s.key);
    return `<div class="comp-row">
      <span class="comp-val comp-val-us">${usVal}</span>
      <div class="comp-bar-container"><div class="comp-label">${s.label}</div></div>
      <span class="comp-val comp-val-opp">${oppVal}</span>
    </div>`;
  }).join('');

  return `
    <div class="card" style="padding:var(--space-md);margin-bottom:var(--space-lg)">
      <h3 class="section-heading">Season Comparison</h3>
      <div class="comp-header">
        <span style="color:var(--victory-green-light);font-weight:600">${usAbbr}</span>
        <span style="color:var(--text-secondary);font-weight:600">${oppAbbr}</span>
      </div>
      ${rows}
    </div>`;
}
