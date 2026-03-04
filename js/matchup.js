import { getSeasonSchedule, getStandings, getClubStats, getTeamSchedule, getName, getNHLInjuries, getTeamInjuries } from './api.js';
import { formatDate, formatDateLong, formatTime, formatPctg, statLabel, isGameComplete, isGameFuture, showLoading, showError } from './utils.js';
import { getScoreboard } from './espn-api.js';
import { getCurrentTeam } from './teams.js';

export async function renderMatchupPreview(container, gameId) {
  showLoading(container);
  try {
    const [schedule, standings] = await Promise.all([
      getSeasonSchedule(),
      getStandings(),
    ]);

    const game = schedule.games?.find(g => String(g.id) === String(gameId));
    if (!game) {
      showError(container, 'Game not found.');
      return;
    }

    const isDalHome = game.homeTeam?.abbrev === 'DAL';
    const dalTeam = isDalHome ? game.homeTeam : game.awayTeam;
    const oppTeam = isDalHome ? game.awayTeam : game.homeTeam;
    const oppAbbrev = oppTeam?.abbrev;

    // Get opponent schedule for recent form + H2H + injuries
    const [dalClubStats, oppClubStats, oppSchedule, injData] = await Promise.all([
      getClubStats('DAL').catch(() => null),
      getClubStats(oppAbbrev).catch(() => null),
      getTeamSchedule(oppAbbrev).catch(() => null),
      getNHLInjuries().catch(() => null),
    ]);

    const dalInjuries = injData ? getTeamInjuries(injData, 'DAL') : [];
    const oppInjuries = injData ? getTeamInjuries(injData, oppAbbrev) : [];

    // Find teams in standings
    const dalStanding = standings.standings?.find(t => t.teamAbbrev?.default === 'DAL');
    const oppStanding = standings.standings?.find(t => t.teamAbbrev?.default === oppAbbrev);

    // Head-to-head from Dallas schedule
    const h2hGames = (schedule.games || []).filter(g => {
      const isH2H = (g.homeTeam?.abbrev === oppAbbrev || g.awayTeam?.abbrev === oppAbbrev);
      return isH2H && isGameComplete(g);
    });

    // Recent form (last 10 completed games for each team)
    const dalRecentGames = getRecentForm(schedule.games || [], 'DAL');
    const oppRecentGames = oppSchedule ? getRecentForm(oppSchedule.games || [], oppAbbrev) : [];

    // Key players from club stats
    const dalSkaters = getTopSkaters(dalClubStats, 'DAL');
    const oppSkaters = getTopSkaters(oppClubStats, oppAbbrev);
    const dalGoalies = getTopGoalies(dalClubStats);
    const oppGoalies = getTopGoalies(oppClubStats);

    // Fetch ESPN odds for this game
    let oddsData = null;
    try {
      const espnTeam = getCurrentTeam();
      const gameDate = game.startTimeUTC ? new Date(game.startTimeUTC).toISOString().slice(0, 10).replace(/-/g, '') : '';
      if (gameDate) {
        const scoreboard = await getScoreboard(espnTeam, gameDate);
        const events = scoreboard?.events || [];
        // Find matching game by looking for both team abbreviations in competitors
        const matchingEvent = events.find(ev => {
          const comps = ev?.competitions?.[0]?.competitors || [];
          const abbrevs = comps.map(c => c.team?.abbreviation);
          return abbrevs.includes('DAL') && abbrevs.includes(oppAbbrev);
        });
        if (matchingEvent) {
          const odds = matchingEvent?.competitions?.[0]?.odds;
          if (odds?.length) {
            oddsData = odds.find(o => o.provider?.name?.toLowerCase().includes('draft kings') || o.provider?.name?.toLowerCase().includes('draftkings')) || odds[0];
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch ESPN odds for matchup:', e);
    }

    // Build prediction
    const prediction = buildPrediction(dalStanding, oppStanding, dalRecentGames, oppRecentGames, isDalHome, h2hGames, 'DAL');

    // Render
    const venue = getName(game.venue?.default || game.venue) || '';
    const broadcasts = game.tvBroadcasts?.map(b => b.network).join(', ') || '';

    container.innerHTML = `
      <div class="matchup-preview">
        <a href="#schedule" class="back-link">&larr; Back to Schedule</a>

        <div class="matchup-header-card card">
          <div class="matchup-header">
            <div class="matchup-team">
              <img src="${dalTeam?.logo || ''}" alt="DAL" loading="lazy">
              <span class="matchup-team-abbrev">DAL</span>
              <span class="matchup-team-name">${getName(dalTeam?.placeName)} ${getName(dalTeam?.commonName || dalTeam?.teamName)}</span>
              <span class="matchup-team-record">${dalStanding ? `${dalStanding.wins}-${dalStanding.losses}-${dalStanding.otLosses}` : ''}</span>
            </div>
            <div class="matchup-vs">
              <span class="matchup-vs-text">VS</span>
            </div>
            <div class="matchup-team">
              <img src="${oppTeam?.logo || ''}" alt="${oppAbbrev}" loading="lazy">
              <span class="matchup-team-abbrev">${oppAbbrev}</span>
              <span class="matchup-team-name">${getName(oppTeam?.placeName)} ${getName(oppTeam?.commonName || oppTeam?.teamName)}</span>
              <span class="matchup-team-record">${oppStanding ? `${oppStanding.wins}-${oppStanding.losses}-${oppStanding.otLosses}` : ''}</span>
            </div>
          </div>
          <div class="matchup-game-info">
            ${formatDateLong(game.startTimeUTC)} &middot; ${formatTime(game.startTimeUTC)}
            ${venue ? ` &middot; ${venue}` : ''}
            ${broadcasts ? `<br>${broadcasts}` : ''}
          </div>
        </div>

        ${buildPredictionBanner(prediction, oppAbbrev)}

        ${oddsData ? buildMatchupOdds(oddsData, 'DAL', oppAbbrev, isDalHome) : ''}

        <h3 class="section-heading">Statistical Edge</h3>
        ${buildEdgeCards(dalStanding, oppStanding, dalRecentGames, oppRecentGames, oppAbbrev)}

        <h3 class="section-heading">Team Comparison</h3>
        ${buildComparison(dalStanding, oppStanding, oppAbbrev)}

        <h3 class="section-heading">Last 10 Games</h3>
        ${buildRecentForm(dalRecentGames, oppRecentGames, 'DAL', oppAbbrev)}

        ${h2hGames.length ? `
        <h3 class="section-heading">Season Series (${getH2HSummary(h2hGames, 'DAL')})</h3>
        ${buildH2H(h2hGames)}` : ''}

        <h3 class="section-heading">Key Players</h3>
        ${buildKeyPlayers(dalSkaters, oppSkaters, dalGoalies, oppGoalies, oppAbbrev)}

        ${(dalInjuries.length || oppInjuries.length) ? `
        <h3 class="section-heading">Injury Report</h3>
        ${buildInjuryReport(dalInjuries, oppInjuries, oppAbbrev)}` : ''}
      </div>
    `;
  } catch (e) {
    console.error('Matchup preview error:', e);
    showError(container, 'Unable to load matchup data.');
  }
}

// ─── DATA HELPERS ────────────────────────────────────

function getRecentForm(games, teamAbbrev) {
  return games
    .filter(g => isGameComplete(g) && (g.homeTeam?.abbrev === teamAbbrev || g.awayTeam?.abbrev === teamAbbrev))
    .sort((a, b) => new Date(b.startTimeUTC) - new Date(a.startTimeUTC))
    .slice(0, 10)
    .reverse();
}

function getGameResultFor(game, teamAbbrev) {
  const isHome = game.homeTeam?.abbrev === teamAbbrev;
  const myTeam = isHome ? game.homeTeam : game.awayTeam;
  const theirTeam = isHome ? game.awayTeam : game.homeTeam;
  const won = (myTeam?.score ?? 0) > (theirTeam?.score ?? 0);
  if (won) return 'W';
  const lastPeriod = game.gameOutcome?.lastPeriodType;
  if (lastPeriod === 'OT' || lastPeriod === 'SO') return 'OTL';
  return 'L';
}

function getTopSkaters(clubStats, teamAbbrev) {
  if (!clubStats?.skaters) return [];
  return [...clubStats.skaters]
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 5)
    .map(p => ({
      name: `${getName(p.firstName)} ${getName(p.lastName)}`,
      headshot: p.headshot || '',
      pos: p.positionCode,
      gp: p.gamesPlayed || 0,
      goals: p.goals || 0,
      assists: p.assists || 0,
      points: p.points || 0,
    }));
}

function getTopGoalies(clubStats) {
  if (!clubStats?.goalies) return [];
  return [...clubStats.goalies]
    .sort((a, b) => (b.wins || 0) - (a.wins || 0))
    .slice(0, 2)
    .map(p => ({
      name: `${getName(p.firstName)} ${getName(p.lastName)}`,
      headshot: p.headshot || '',
      gp: p.gamesPlayed || 0,
      wins: p.wins || 0,
      losses: p.losses || 0,
      otLosses: p.otLosses || 0,
      gaa: p.goalsAgainstAverage || 0,
      svPct: p.savePercentage || 0,
    }));
}

// ─── PREDICTION MODEL ────────────────────────────────

function buildPrediction(dalStanding, oppStanding, dalRecent, oppRecent, isDalHome, h2hGames, dalAbbrev) {
  if (!dalStanding || !oppStanding) return { dalPct: 50, oppPct: 50, factors: [] };

  const factors = [];
  let dalScore = 0;

  // 1. Point percentage (biggest factor)
  const dalPtPct = dalStanding.pointPctg || 0;
  const oppPtPct = oppStanding.pointPctg || 0;
  const ptDiff = dalPtPct - oppPtPct;
  dalScore += ptDiff * 30;
  factors.push({
    label: 'Season Record',
    edge: ptDiff > 0.02 ? 'DAL' : ptDiff < -0.02 ? 'OPP' : 'EVEN',
    detail: `DAL ${formatPctg(dalPtPct)} vs ${formatPctg(oppPtPct)} point%`,
  });

  // 2. Goal differential per game
  const dalGD = ((dalStanding.goalFor || 0) - (dalStanding.goalAgainst || 0)) / Math.max(dalStanding.gamesPlayed, 1);
  const oppGD = ((oppStanding.goalFor || 0) - (oppStanding.goalAgainst || 0)) / Math.max(oppStanding.gamesPlayed, 1);
  const gdDiff = dalGD - oppGD;
  dalScore += gdDiff * 8;
  factors.push({
    label: 'Goal Differential',
    edge: gdDiff > 0.1 ? 'DAL' : gdDiff < -0.1 ? 'OPP' : 'EVEN',
    detail: `DAL ${dalGD > 0 ? '+' : ''}${dalGD.toFixed(2)}/gm vs ${oppGD > 0 ? '+' : ''}${oppGD.toFixed(2)}/gm`,
  });

  // 3. Recent form (last 10)
  const dalRecentPts = dalRecent.reduce((sum, g) => {
    const r = getGameResultFor(g, 'DAL');
    return sum + (r === 'W' ? 2 : r === 'OTL' ? 1 : 0);
  }, 0);
  const oppRecentPts = oppRecent.reduce((sum, g) => {
    const r = getGameResultFor(g, oppStanding.teamAbbrev?.default);
    return sum + (r === 'W' ? 2 : r === 'OTL' ? 1 : 0);
  }, 0);
  const dalRecentPct = dalRecent.length ? dalRecentPts / (dalRecent.length * 2) : 0.5;
  const oppRecentPct = oppRecent.length ? oppRecentPts / (oppRecent.length * 2) : 0.5;
  const recentDiff = dalRecentPct - oppRecentPct;
  dalScore += recentDiff * 15;
  factors.push({
    label: 'Recent Form',
    edge: recentDiff > 0.05 ? 'DAL' : recentDiff < -0.05 ? 'OPP' : 'EVEN',
    detail: `DAL ${dalRecentPts}/${dalRecent.length * 2} pts vs ${oppRecentPts}/${oppRecent.length * 2} pts (L10)`,
  });

  // 4. Home/away advantage
  if (isDalHome) {
    const homeWinPct = dalStanding.homeWins / Math.max(dalStanding.homeGamesPlayed || (dalStanding.homeWins + dalStanding.homeLosses + dalStanding.homeOtLosses), 1);
    dalScore += 0.04;
    factors.push({ label: 'Home Ice', edge: 'DAL', detail: `DAL at home (${dalStanding.homeWins}-${dalStanding.homeLosses}-${dalStanding.homeOtLosses})` });
  } else {
    const awayWinPct = dalStanding.roadWins / Math.max(dalStanding.roadGamesPlayed || (dalStanding.roadWins + dalStanding.roadLosses + dalStanding.roadOtLosses), 1);
    factors.push({ label: 'Away Game', edge: 'OPP', detail: `DAL on road (${dalStanding.roadWins}-${dalStanding.roadLosses}-${dalStanding.roadOtLosses})` });
  }

  // 5. Head-to-head
  if (h2hGames.length > 0) {
    const dalH2HWins = h2hGames.filter(g => getGameResultFor(g, 'DAL') === 'W').length;
    const h2hPct = dalH2HWins / h2hGames.length;
    dalScore += (h2hPct - 0.5) * 8;
    factors.push({
      label: 'Head-to-Head',
      edge: dalH2HWins > h2hGames.length / 2 ? 'DAL' : dalH2HWins < h2hGames.length / 2 ? 'OPP' : 'EVEN',
      detail: `DAL ${dalH2HWins}-${h2hGames.length - dalH2HWins} this season`,
    });
  }

  // Convert score to percentage (sigmoid-ish)
  let dalPct = 50 + dalScore * 100;
  dalPct = Math.max(20, Math.min(80, dalPct)); // clamp to 20-80%
  dalPct = Math.round(dalPct);

  return { dalPct, oppPct: 100 - dalPct, factors };
}

// ─── ODDS HELPER ─────────────────────────────────────

function buildMatchupOdds(odds, dalAbbrev, oppAbbrev, isDalHome) {
  if (!odds) return '';

  const providerName = odds.provider?.name || 'Sportsbook';
  const homeAbbr = isDalHome ? dalAbbrev : oppAbbrev;
  const awayAbbr = isDalHome ? oppAbbrev : dalAbbrev;

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

// ─── RENDER HELPERS ──────────────────────────────────

function buildPredictionBanner(prediction, oppAbbrev) {
  const { dalPct, oppPct, factors } = prediction;
  const favored = dalPct >= 50 ? 'DAL' : oppAbbrev;
  const favoredPct = Math.max(dalPct, oppPct);

  return `
    <div class="prediction-banner">
      <div class="prediction-title">Analytics Projection</div>
      <div class="prediction-result">${favored} favored (${favoredPct}%)</div>
      <div class="odds-bar">
        <div class="odds-bar-fill" style="width:${dalPct}%"></div>
        <div class="odds-bar-fill-opp"></div>
      </div>
      <div class="prediction-odds">
        <div class="odds-team">
          <span class="odds-pct dal">${dalPct}%</span>
          <span class="odds-label">DAL Win</span>
        </div>
        <div class="odds-team">
          <span class="odds-pct opp">${oppPct}%</span>
          <span class="odds-label">${oppAbbrev} Win</span>
        </div>
      </div>
    </div>`;
}

function buildEdgeCards(dalStanding, oppStanding, dalRecent, oppRecent, oppAbbrev) {
  if (!dalStanding || !oppStanding) return '<p style="color:var(--text-secondary)">Standings data unavailable</p>';

  const dalGFpg = (dalStanding.goalFor || 0) / Math.max(dalStanding.gamesPlayed, 1);
  const oppGFpg = (oppStanding.goalFor || 0) / Math.max(oppStanding.gamesPlayed, 1);
  const dalGApg = (dalStanding.goalAgainst || 0) / Math.max(dalStanding.gamesPlayed, 1);
  const oppGApg = (oppStanding.goalAgainst || 0) / Math.max(oppStanding.gamesPlayed, 1);
  const dalPP = dalStanding.powerPlayPctg || 0;
  const oppPP = oppStanding.powerPlayPctg || 0;
  const dalPK = dalStanding.penaltyKillPctg || 0;
  const oppPK = oppStanding.penaltyKillPctg || 0;

  const dalL10W = dalRecent.filter(g => getGameResultFor(g, 'DAL') === 'W').length;
  const oppL10W = oppRecent.filter(g => getGameResultFor(g, oppAbbrev) === 'W').length;

  const edges = [
    { cat: 'Offense', val: dalGFpg.toFixed(2), sub: 'GF/Game', compare: dalGFpg, oppVal: oppGFpg.toFixed(2), oppCompare: oppGFpg, higherBetter: true },
    { cat: 'Defense', val: dalGApg.toFixed(2), sub: 'GA/Game', compare: dalGApg, oppVal: oppGApg.toFixed(2), oppCompare: oppGApg, higherBetter: false },
    { cat: 'Power Play', val: formatPctg(dalPP), sub: 'PP%', compare: dalPP, oppVal: formatPctg(oppPP), oppCompare: oppPP, higherBetter: true },
    { cat: 'Penalty Kill', val: formatPctg(dalPK), sub: 'PK%', compare: dalPK, oppVal: formatPctg(oppPK), oppCompare: oppPK, higherBetter: true },
    { cat: 'Last 10', val: `${dalL10W}W`, sub: `of ${dalRecent.length}`, compare: dalL10W, oppVal: `${oppL10W}W`, oppCompare: oppL10W, higherBetter: true },
    { cat: 'Points', val: dalStanding.points, sub: `${dalStanding.gamesPlayed} GP`, compare: dalStanding.points, oppVal: oppStanding.points, oppCompare: oppStanding.points, higherBetter: true },
  ];

  return `<div class="edge-cards">${edges.map(e => {
    const dalBetter = e.higherBetter ? e.compare > e.oppCompare : e.compare < e.oppCompare;
    const oppBetter = e.higherBetter ? e.oppCompare > e.compare : e.oppCompare < e.compare;
    const edgeClass = dalBetter ? 'edge-dal' : oppBetter ? 'edge-opp' : 'edge-neutral';
    return `
      <div class="edge-card ${edgeClass}">
        <div class="edge-category">${e.cat}</div>
        <div class="edge-value">${dalBetter ? e.val : oppBetter ? e.oppVal : e.val}</div>
        <div class="edge-sublabel">${dalBetter ? 'DAL' : oppBetter ? oppAbbrev : 'Even'} &middot; ${e.sub}</div>
      </div>`;
  }).join('')}</div>`;
}

function buildComparison(dalStanding, oppStanding, oppAbbrev) {
  if (!dalStanding || !oppStanding) return '';

  const dalGP = Math.max(dalStanding.gamesPlayed, 1);
  const oppGP = Math.max(oppStanding.gamesPlayed, 1);

  const rows = [
    { label: 'Points', dalVal: dalStanding.points, oppVal: oppStanding.points, max: Math.max(dalStanding.points, oppStanding.points, 1), higherBetter: true },
    { label: 'Point %', dalVal: formatPctg(dalStanding.pointPctg || 0), oppVal: formatPctg(oppStanding.pointPctg || 0), dalRaw: dalStanding.pointPctg || 0, oppRaw: oppStanding.pointPctg || 0, max: 1, higherBetter: true },
    { label: statLabel('GF') + '/Game', dalVal: ((dalStanding.goalFor || 0) / dalGP).toFixed(2), oppVal: ((oppStanding.goalFor || 0) / oppGP).toFixed(2), dalRaw: (dalStanding.goalFor || 0) / dalGP, oppRaw: (oppStanding.goalFor || 0) / oppGP, max: 5, higherBetter: true },
    { label: statLabel('GA') + '/Game', dalVal: ((dalStanding.goalAgainst || 0) / dalGP).toFixed(2), oppVal: ((oppStanding.goalAgainst || 0) / oppGP).toFixed(2), dalRaw: (dalStanding.goalAgainst || 0) / dalGP, oppRaw: (oppStanding.goalAgainst || 0) / oppGP, max: 5, higherBetter: false },
    { label: statLabel('PP') + '%', dalVal: formatPctg(dalStanding.powerPlayPctg || 0), oppVal: formatPctg(oppStanding.powerPlayPctg || 0), dalRaw: dalStanding.powerPlayPctg || 0, oppRaw: oppStanding.powerPlayPctg || 0, max: 0.4, higherBetter: true },
    { label: statLabel('PK') + '%', dalVal: formatPctg(dalStanding.penaltyKillPctg || 0), oppVal: formatPctg(oppStanding.penaltyKillPctg || 0), dalRaw: dalStanding.penaltyKillPctg || 0, oppRaw: oppStanding.penaltyKillPctg || 0, max: 1, higherBetter: true },
    { label: 'Goal Diff', dalVal: (dalStanding.goalFor - dalStanding.goalAgainst) > 0 ? '+' + (dalStanding.goalFor - dalStanding.goalAgainst) : String(dalStanding.goalFor - dalStanding.goalAgainst), oppVal: (oppStanding.goalFor - oppStanding.goalAgainst) > 0 ? '+' + (oppStanding.goalFor - oppStanding.goalAgainst) : String(oppStanding.goalFor - oppStanding.goalAgainst), dalRaw: dalStanding.goalFor - dalStanding.goalAgainst, oppRaw: oppStanding.goalFor - oppStanding.goalAgainst, max: Math.max(Math.abs(dalStanding.goalFor - dalStanding.goalAgainst), Math.abs(oppStanding.goalFor - oppStanding.goalAgainst), 1), higherBetter: true },
  ];

  return `<div class="comparison-section"><div class="comparison-grid">${rows.map(r => {
    const dalRaw = r.dalRaw ?? r.dalVal;
    const oppRaw = r.oppRaw ?? r.oppVal;
    const dalNum = typeof dalRaw === 'number' ? dalRaw : parseFloat(dalRaw);
    const oppNum = typeof oppRaw === 'number' ? oppRaw : parseFloat(oppRaw);
    const dalBetter = r.higherBetter ? dalNum > oppNum : dalNum < oppNum;
    const oppBetter = r.higherBetter ? oppNum > dalNum : oppNum < dalNum;
    const maxVal = r.max || Math.max(Math.abs(dalNum), Math.abs(oppNum), 1);
    const dalBarPct = Math.min(Math.abs(dalNum) / maxVal * 100, 100);
    const oppBarPct = Math.min(Math.abs(oppNum) / maxVal * 100, 100);

    return `<div class="comp-row">
      <span class="comp-val left ${dalBetter ? 'better' : ''}">${r.dalVal}</span>
      <div class="comp-bar left"><div class="comp-bar-fill" style="width:${dalBarPct}%"></div></div>
      <span class="comp-label">${r.label}</span>
      <div class="comp-bar right"><div class="comp-bar-fill" style="width:${oppBarPct}%"></div></div>
      <span class="comp-val right ${oppBetter ? 'better' : ''}">${r.oppVal}</span>
    </div>`;
  }).join('')}</div></div>`;
}

function buildRecentForm(dalRecent, oppRecent, dalAbbrev, oppAbbrev) {
  function formRow(games, abbrev) {
    const dots = games.map(g => {
      const result = getGameResultFor(g, abbrev);
      const cls = result === 'W' ? 'win' : result === 'OTL' ? 'otl' : 'loss';
      return `<span class="form-dot ${cls}">${result}</span>`;
    }).join('');
    const wins = games.filter(g => getGameResultFor(g, abbrev) === 'W').length;
    const otl = games.filter(g => getGameResultFor(g, abbrev) === 'OTL').length;
    const losses = games.length - wins - otl;
    return `<div class="form-row">
      <span class="form-team-label">${abbrev}</span>
      <div class="form-dots">${dots}</div>
      <span class="form-record">${wins}-${losses}-${otl}</span>
    </div>`;
  }

  return `<div class="form-section card" style="padding:var(--space-lg)">
    ${formRow(dalRecent, dalAbbrev)}
    ${formRow(oppRecent, oppAbbrev)}
  </div>`;
}

function getH2HSummary(h2hGames, teamAbbrev) {
  const wins = h2hGames.filter(g => getGameResultFor(g, teamAbbrev) === 'W').length;
  const otl = h2hGames.filter(g => getGameResultFor(g, teamAbbrev) === 'OTL').length;
  const losses = h2hGames.length - wins - otl;
  return `DAL leads ${wins}-${losses}${otl ? `-${otl}` : ''}`;
}

function buildH2H(h2hGames) {
  const sorted = [...h2hGames].sort((a, b) => new Date(b.startTimeUTC) - new Date(a.startTimeUTC));
  return `<div class="h2h-section"><div class="h2h-games">${sorted.map(g => {
    const result = getGameResultFor(g, 'DAL');
    const dal = g.homeTeam?.abbrev === 'DAL' ? g.homeTeam : g.awayTeam;
    const opp = g.homeTeam?.abbrev === 'DAL' ? g.awayTeam : g.homeTeam;
    const badgeClass = result === 'W' ? 'badge-win' : result === 'OTL' ? 'badge-otl' : 'badge-loss';
    const lastPeriod = g.gameOutcome?.lastPeriodType;
    let extra = '';
    if (lastPeriod === 'OT') extra = ' (OT)';
    else if (lastPeriod === 'SO') extra = ' (SO)';

    return `<a href="#game/${g.id}" class="h2h-game">
      <span class="h2h-date">${formatDate(g.startTimeUTC)}</span>
      <span class="h2h-score">DAL ${dal?.score ?? 0} - ${opp?.score ?? 0} ${opp?.abbrev}</span>
      <span class="h2h-result"><span class="badge ${badgeClass}">${result}${extra}</span></span>
    </a>`;
  }).join('')}</div></div>`;
}

function buildKeyPlayers(dalSkaters, oppSkaters, dalGoalies, oppGoalies, oppAbbrev) {
  function playerRows(skaters, goalies) {
    const skaterRows = skaters.map(p => `
      <div class="key-player-row">
        ${p.headshot ? `<img src="${p.headshot}" alt="" loading="lazy">` : ''}
        <span class="key-player-name">${p.name}</span>
        <span class="key-player-stats">${p.goals}G ${p.assists}A (${p.points}P)</span>
      </div>`).join('');
    const goalieRows = goalies.map(p => `
      <div class="key-player-row">
        ${p.headshot ? `<img src="${p.headshot}" alt="" loading="lazy">` : ''}
        <span class="key-player-name">${p.name}</span>
        <span class="key-player-stats">${p.wins}W .${(p.svPct * 1000).toFixed(0)} ${p.gaa.toFixed(2)}</span>
      </div>`).join('');
    return skaterRows + goalieRows;
  }

  return `<div class="key-players-grid">
    <div class="key-players-team">
      <h4>DAL Top Players</h4>
      ${playerRows(dalSkaters, dalGoalies)}
    </div>
    <div class="key-players-team">
      <h4>${oppAbbrev} Top Players</h4>
      ${playerRows(oppSkaters, oppGoalies)}
    </div>
  </div>`;
}

function buildInjuryReport(dalInjuries, oppInjuries, oppAbbrev) {
  function injuryRows(injuries) {
    if (!injuries.length) return '<div class="injury-row"><span style="color:var(--text-muted);font-size:0.85rem">No injuries reported</span></div>';
    return injuries.map(inj => {
      const statusClass = inj.statusType === 'INJURY_STATUS_OUT' ? 'injury-out' :
        inj.statusType === 'INJURY_STATUS_IR' ? 'injury-ir' : 'injury-dtd';
      const injuryDesc = [inj.type, inj.detail, inj.side].filter(Boolean).join(' - ') || 'Undisclosed';
      return `
        <div class="injury-row ${statusClass}">
          ${inj.headshot ? `<img src="${inj.headshot}" alt="" class="injury-headshot" loading="lazy">` : '<div class="injury-headshot-placeholder"></div>'}
          <div class="injury-info">
            <span class="injury-name">${inj.name}</span>
            <span class="injury-pos">${inj.position}</span>
          </div>
          <div class="injury-details">
            <span class="injury-type">${injuryDesc}</span>
          </div>
          <span class="injury-status-badge ${statusClass}">${inj.status}</span>
        </div>`;
    }).join('');
  }

  return `<div class="key-players-grid">
    <div class="key-players-team">
      <h4>DAL Injuries${dalInjuries.length ? ` (${dalInjuries.length})` : ''}</h4>
      ${injuryRows(dalInjuries)}
    </div>
    <div class="key-players-team">
      <h4>${oppAbbrev} Injuries${oppInjuries.length ? ` (${oppInjuries.length})` : ''}</h4>
      ${injuryRows(oppInjuries)}
    </div>
  </div>`;
}
