import { getCurrentTeam } from './teams.js';
import { getGameSummary, formatEspnDate } from './espn-api.js';
import { showLoading, showError } from './utils.js';

let pollInterval = null;

function cleanup() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

export async function renderEspnGame(container, eventId, liveMode = false) {
  cleanup();
  const team = getCurrentTeam();
  showLoading(container);

  try {
    const data = await getGameSummary(team, eventId);
    renderGameData(container, data, team, liveMode);

    // If live, poll every 15s
    const state = data?.header?.competitions?.[0]?.status?.type?.state;
    if (state === 'in' || liveMode) {
      pollInterval = setInterval(async () => {
        try {
          const fresh = await getGameSummary(team, eventId);
          const el = document.getElementById('espn-game-container');
          if (!el) { cleanup(); return; }
          renderGameData(container, fresh, team, true);
        } catch (_) {}
      }, 15000);
    }
  } catch (e) {
    console.error('ESPN Game error:', e);
    showError(container, 'Unable to load game data.');
  }
}

function renderGameData(container, data, team, liveMode) {
  const header = data?.header;
  const comp = header?.competitions?.[0];
  const status = comp?.status;
  const isLive = status?.type?.state === 'in';
  const isPost = status?.type?.state === 'post';
  const statusDetail = status?.type?.detail || '';

  const competitors = comp?.competitors || [];
  // Check if our team is in this game; if not, show away vs home
  const ourTeam = competitors.find(c => String(c.id) === String(team.espnTeamId));
  const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[0];
  const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[1];
  // Left side = our team if involved, else away; Right side = opponent or home
  const left = ourTeam || awayComp;
  const right = ourTeam ? competitors.find(c => c !== ourTeam) : homeComp;
  const isOurGame = !!ourTeam;

  const usScore = left?.score || '0';
  const oppScore = right?.score || '0';
  const usLogo = left?.team?.logos?.[0]?.href || '';
  const oppLogo = right?.team?.logos?.[0]?.href || '';
  const usAbbr = left?.team?.abbreviation || '';
  const oppAbbr = right?.team?.abbreviation || '';
  const usName = left?.team?.displayName || '';
  const oppName = right?.team?.displayName || '';
  const usRecord = left?.record?.[0]?.displayValue || '';
  const oppRecord = right?.record?.[0]?.displayValue || '';

  const venue = data?.gameInfo?.venue?.fullName || '';
  const gameDate = comp?.date || '';

  // Box score
  const boxscore = data?.boxscore;

  // Play-by-play / scoring plays / drives
  const plays = data?.drives?.previous || data?.scoringPlays || data?.plays || [];

  // Leaders
  const leaders = data?.leaders || [];

  const liveBadge = isLive ? `<span class="badge badge-live" style="margin-left:var(--space-sm)">LIVE</span>` : '';

  // Back link: go to scores if not our game, schedule if ours
  const backLink = isOurGame ? `<a href="#schedule" class="back-link">&larr; Back to Schedule</a>` : `<a href="#scores" class="back-link">&larr; Back to Scores</a>`;

  container.innerHTML = `
    <div class="matchup-preview" id="espn-game-container">
      ${backLink}

      <div class="matchup-header-card card">
        <div class="matchup-header">
          <div class="matchup-team">
            <img src="${usLogo}" alt="${usAbbr}" loading="lazy">
            <span class="matchup-team-abbrev">${usAbbr}</span>
            <span class="matchup-team-name">${usName}</span>
            <span class="matchup-team-record">${usRecord}</span>
          </div>
          <div class="matchup-vs">
            ${isPost || isLive ? `
              <div class="game-header-score" style="font-size:2.5rem">
                <span ${isOurGame ? 'class="dal-score"' : ''}>${usScore}</span>
                <span class="score-divider" style="font-size:1.5rem">&mdash;</span>
                <span>${oppScore}</span>
              </div>` :
              `<span class="matchup-vs-text">VS</span>`}
          </div>
          <div class="matchup-team">
            <img src="${oppLogo}" alt="${oppAbbr}" loading="lazy">
            <span class="matchup-team-abbrev">${oppAbbr}</span>
            <span class="matchup-team-name">${oppName}</span>
            <span class="matchup-team-record">${oppRecord}</span>
          </div>
        </div>
        <div class="matchup-game-info">
          ${statusDetail}${liveBadge}
          ${venue ? ` &middot; ${venue}` : ''}
          ${gameDate ? `<br>${formatEspnDate(gameDate)}` : ''}
        </div>
      </div>

      ${isLive ? buildLiveScorebar(data, isOurGame, team) : ''}
      ${boxscore ? buildBoxScore(boxscore, usAbbr, oppAbbr) : ''}
      ${buildVideoClips(data)}
      ${buildOddsSection(data)}
      ${leaders.length ? buildLeaders(leaders) : ''}
      ${buildScoringPlays(data, isOurGame, team)}
    </div>
  `;

  // Wire video cards
  container.querySelectorAll('.clip-card[data-video-url]').forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('playing')) return;
      const url = card.dataset.videoUrl;
      const headline = card.querySelector('.clip-headline')?.textContent || '';
      card.classList.add('playing');
      card.innerHTML = `
        <video controls autoplay playsinline style="width:100%;display:block;border-radius:var(--radius-md) var(--radius-md) 0 0">
          <source src="${url}" type="video/mp4">
        </video>
        <div class="clip-info"><div class="clip-headline">${headline}</div></div>`;
    });
  });
}

function buildLiveScorebar(data, isOurGame, team) {
  // Line score (period/quarter/inning scores)
  const linescores = data?.header?.competitions?.[0]?.competitors;
  if (!linescores?.length) return '';

  const periods = linescores[0]?.linescores || [];
  if (!periods.length) return '';

  const headers = periods.map((_, i) => `<th>${i + 1}</th>`).join('');
  const rows = linescores.map(c => {
    const abbr = c.team?.abbreviation || '';
    const isUs = isOurGame && String(c.id) === String(team.espnTeamId);
    const scores = (c.linescores || []).map(ls => `<td>${ls.displayValue || ls.value || 0}</td>`).join('');
    return `<tr class="${isUs ? 'dal-row' : ''}"><td><strong>${abbr}</strong></td>${scores}<td><strong>${c.score || 0}</strong></td></tr>`;
  }).join('');

  return `
    <div class="card" style="margin-bottom:var(--space-lg);padding:var(--space-md)">
      <div class="table-wrap">
        <table class="boxscore-table">
          <thead><tr><th></th>${headers}<th>T</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function buildBoxScore(boxscore, usAbbr, oppAbbr) {
  if (!boxscore?.players?.length && !boxscore?.teams?.length) return '';

  let html = '<h3 class="section-heading">Box Score</h3>';

  // Team stats comparison
  if (boxscore.teams?.length) {
    html += '<div class="card" style="padding:var(--space-md);margin-bottom:var(--space-md)">';
    for (const teamStats of boxscore.teams) {
      const abbr = teamStats.team?.abbreviation || '';
      const stats = teamStats.statistics || [];
      for (const statGroup of stats) {
        if (statGroup.labels?.length && statGroup.totals?.length) {
          html += `<h4 style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;margin:var(--space-sm) 0">${abbr} - ${statGroup.name || 'Stats'}</h4>`;
          html += '<div class="table-wrap"><table class="boxscore-table"><thead><tr>';
          html += statGroup.labels.map(l => `<th>${l}</th>`).join('');
          html += '</tr></thead><tbody><tr>';
          html += statGroup.totals.map(v => `<td>${v}</td>`).join('');
          html += '</tr></tbody></table></div>';
        }
      }
    }
    html += '</div>';
  }

  // Player stats
  if (boxscore.players?.length) {
    for (const teamPlayers of boxscore.players) {
      const abbr = teamPlayers.team?.abbreviation || '';
      html += `<h4 style="margin:var(--space-md) 0 var(--space-sm);color:var(--white)">${teamPlayers.team?.displayName || abbr}</h4>`;
      for (const statGroup of (teamPlayers.statistics || [])) {
        if (!statGroup.athletes?.length) continue;
        const labels = statGroup.labels || [];
        html += `<div class="boxscore-section"><h4>${statGroup.name || 'Stats'}</h4><div class="table-wrap"><table class="boxscore-table">`;
        html += `<thead><tr><th class="name-header">Player</th>${labels.map(l => `<th>${l}</th>`).join('')}</tr></thead>`;
        html += '<tbody>';
        for (const ath of statGroup.athletes) {
          const name = ath.athlete?.displayName || ath.athlete?.shortName || '';
          const vals = ath.stats || [];
          html += `<tr><td class="name-cell">${name}</td>${vals.map(v => `<td>${v}</td>`).join('')}</tr>`;
        }
        // Totals row
        if (statGroup.totals?.length) {
          html += `<tr style="border-top:1px solid var(--card-border);font-weight:600"><td class="name-cell">TOTAL</td>${statGroup.totals.map(v => `<td>${v}</td>`).join('')}</tr>`;
        }
        html += '</tbody></table></div></div>';
      }
    }
  }

  return html;
}

function buildLeaders(leaders) {
  if (!leaders.length) return '';
  let html = '<h3 class="section-heading">Game Leaders</h3><div class="edge-cards">';
  for (const cat of leaders) {
    for (const leader of (cat.leaders || []).slice(0, 1)) {
      const name = leader.athlete?.displayName || '';
      const headshot = leader.athlete?.headshot || '';
      const value = leader.displayValue || '';
      const team = leader.athlete?.team?.abbreviation || '';
      html += `
        <div class="edge-card">
          <div class="edge-category">${cat.displayName || cat.name || ''}</div>
          <div style="display:flex;align-items:center;gap:var(--space-sm);margin-top:var(--space-xs)">
            ${headshot ? `<img src="${headshot}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : ''}
            <div>
              <div style="font-weight:600;color:var(--white);font-size:0.85rem">${name}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${team}</div>
            </div>
          </div>
          <div style="color:var(--victory-green-light);font-size:0.8rem;margin-top:var(--space-xs)">${value}</div>
        </div>`;
    }
  }
  html += '</div>';
  return html;
}

function buildOddsSection(data) {
  const pickcenter = data?.pickcenter;
  if (!pickcenter?.length) return '';

  // Find DraftKings entry, fall back to first provider
  const dk = pickcenter.find(p => p.provider?.name?.toLowerCase().includes('draft kings') || p.provider?.name?.toLowerCase().includes('draftkings')) || pickcenter[0];
  if (!dk) return '';

  const providerName = dk.provider?.name || 'Sportsbook';

  // Get team abbreviations from header competitors
  const comp = data?.header?.competitions?.[0];
  const competitors = comp?.competitors || [];
  const homeComp = competitors.find(c => c.homeAway === 'home');
  const awayComp = competitors.find(c => c.homeAway === 'away');
  const homeAbbr = homeComp?.team?.abbreviation || '';
  const awayAbbr = awayComp?.team?.abbreviation || '';

  const fmtMoney = (val) => {
    if (val == null) return '--';
    const n = Number(val);
    return n > 0 ? `+${n}` : String(n);
  };

  const spread = dk.spread;
  const overUnder = dk.overUnder;
  const overOdds = dk.overOdds;
  const underOdds = dk.underOdds;
  const homeML = dk.homeTeamOdds?.moneyLine;
  const awayML = dk.awayTeamOdds?.moneyLine;
  const homeSpreadOdds = dk.homeTeamOdds?.spreadOdds;
  const awaySpreadOdds = dk.awayTeamOdds?.spreadOdds;
  const homeFav = dk.homeTeamOdds?.favorite;
  const awayFav = dk.awayTeamOdds?.favorite;

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
          <div class="odds-card-detail">${dk.details || ''}</div>
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

function buildScoringPlays(data, isOurGame, team) {
  // Try different data sources for play-by-play
  const scoringPlays = data?.scoringPlays || [];
  const keyEvents = data?.keyEvents || [];
  const items = scoringPlays.length ? scoringPlays : keyEvents;

  if (!items.length) return '';

  // Determine period label based on sport
  const league = team.league;
  const periodLabel = league === 'NHL' ? 'P' : league === 'MLB' ? '' : 'Q';

  let html = '<h3 class="section-heading">Scoring Plays</h3><div class="goals-list">';
  for (const play of items) {
    const text = play.text || play.shortText || play.description || '';
    const clock = play.clock?.displayValue || '';
    const period = play.period?.number || play.period || '';
    const teamData = play.team;
    const abbr = teamData?.abbreviation || '';
    const score = play.awayScore != null ? `${play.awayScore}-${play.homeScore}` : '';
    const isOurPlay = isOurGame && abbr === team.abbrev;

    html += `
      <div class="goal-event ${isOurPlay ? 'goal-event-dal' : ''}">
        <div class="goal-event-top">
          <div class="goal-event-header">
            ${score ? `<span class="goal-score">${score}</span>` : ''}
            ${abbr ? `<span class="goal-team-badge">${abbr}</span>` : ''}
            ${period ? `<span class="goal-time">${periodLabel}${period} ${clock}</span>` : ''}
          </div>
          <div class="goal-event-summary">${text}</div>
        </div>
      </div>`;
  }
  html += '</div>';
  return html;
}

function buildVideoClips(data) {
  const videos = data?.videos || [];
  if (!videos.length) return '';

  const cards = videos.slice(0, 8).map(v => {
    const headline = v.headline || '';
    const duration = v.duration || 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const videoUrl = v.links?.source?.href || v.links?.mobile?.source?.href || '';
    const thumbnail = v.thumbnail || '';

    if (!videoUrl) return '';

    return `
      <div class="clip-card" data-video-url="${videoUrl}">
        <div class="clip-thumbnail">
          ${thumbnail ? `<img src="${thumbnail}" alt="" loading="lazy">` : ''}
          <div class="clip-play-overlay"><div class="clip-play-btn"></div></div>
          <span class="clip-duration">${durationStr}</span>
        </div>
        <div class="clip-info">
          <div class="clip-headline">${headline}</div>
        </div>
      </div>`;
  }).filter(Boolean).join('');

  if (!cards) return '';

  return `
    <h3 class="section-heading">Video Highlights</h3>
    <div class="clips-grid">${cards}</div>`;
}
