import { getRoster, getTeamStats, getPlayerDetails, getName, getNHLInjuries, getTeamInjuries } from './api.js';
import { positionName, formatHeight, statLabel, formatSavePctg, formatGAA, showLoading, showError } from './utils.js';

let allPlayers = [];
let injuries = [];
let currentFilter = 'all';
let currentSort = 'number';

export async function renderRoster(container) {
  showLoading(container);
  try {
    const [roster, stats, injData] = await Promise.all([
      getRoster(),
      getTeamStats(),
      getNHLInjuries().catch(() => null),
    ]);
    allPlayers = mergeRosterAndStats(roster, stats);
    injuries = injData ? getTeamInjuries(injData, 'DAL') : [];
    currentFilter = 'all';
    currentSort = 'number';
    buildPage(container);
  } catch (e) {
    showError(container);
  }
}

function mergeRosterAndStats(roster, stats) {
  const statMap = new Map();

  // Skater stats
  (stats.skaters || []).forEach(s => statMap.set(s.playerId, { ...s, isGoalie: false }));
  // Goalie stats
  (stats.goalies || []).forEach(g => statMap.set(g.playerId, { ...g, isGoalie: true }));

  const players = [];
  const positions = ['forwards', 'defensemen', 'goalies'];
  positions.forEach(pos => {
    (roster[pos] || []).forEach(p => {
      const pStats = statMap.get(p.id) || {};
      players.push({
        ...pStats,
        id: p.id,
        firstName: getName(p.firstName),
        lastName: getName(p.lastName),
        number: p.sweaterNumber,
        position: p.positionCode,
        posGroup: pos,
        headshot: p.headshot,
        heightInInches: p.heightInInches,
        weightInPounds: p.weightInPounds,
        birthDate: p.birthDate,
        birthCountry: getName(p.birthCountry),
        shootsCatches: p.shootsCatches,
      });
    });
  });
  return players;
}

function buildPage(container) {
  const filtered = applyFilter(allPlayers);
  const sorted = applySort(filtered);

  const injuryHtml = injuries.length ? `
    <div class="injury-section">
      <h3 class="section-heading">Injury Report</h3>
      <div class="injury-list">
        ${injuries.map(buildInjuryRow).join('')}
      </div>
    </div>` : '';

  container.innerHTML = `
    <h2>Roster &amp; Stats</h2>
    ${injuryHtml}
    <div class="roster-filters">
      <div class="filter-group" id="pos-filters">
        <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button class="filter-btn ${currentFilter === 'forwards' ? 'active' : ''}" data-filter="forwards">Forwards</button>
        <button class="filter-btn ${currentFilter === 'defensemen' ? 'active' : ''}" data-filter="defensemen">Defense</button>
        <button class="filter-btn ${currentFilter === 'goalies' ? 'active' : ''}" data-filter="goalies">Goalies</button>
      </div>
      <div class="filter-group" id="sort-btns">
        <button class="filter-btn ${currentSort === 'number' ? 'active' : ''}" data-sort="number">#</button>
        <button class="filter-btn ${currentSort === 'points' ? 'active' : ''}" data-sort="points">${statLabel('PTS')}</button>
        <button class="filter-btn ${currentSort === 'goals' ? 'active' : ''}" data-sort="goals">${statLabel('G')}</button>
        <button class="filter-btn ${currentSort === 'name' ? 'active' : ''}" data-sort="name">Name</button>
      </div>
    </div>
    <div class="roster-grid" id="roster-grid">
      ${sorted.map(p => p.isGoalie || p.posGroup === 'goalies' ? buildGoalieCard(p) : buildSkaterCard(p)).join('')}
    </div>
  `;

  container.querySelectorAll('#pos-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      buildPage(container);
    });
  });
  container.querySelectorAll('#sort-btns .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      buildPage(container);
    });
  });
  container.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      location.hash = `player/${id}`;
    });
  });
}

function applyFilter(players) {
  if (currentFilter === 'all') return players;
  return players.filter(p => p.posGroup === currentFilter);
}

function applySort(players) {
  const arr = [...players];
  switch (currentSort) {
    case 'number': return arr.sort((a, b) => (a.number || 0) - (b.number || 0));
    case 'points': return arr.sort((a, b) => (b.points ?? b.wins ?? 0) - (a.points ?? a.wins ?? 0));
    case 'goals': return arr.sort((a, b) => (b.goals ?? b.wins ?? 0) - (a.goals ?? a.wins ?? 0));
    case 'name': return arr.sort((a, b) => a.lastName.localeCompare(b.lastName));
    default: return arr;
  }
}

function buildSkaterCard(p) {
  return `
    <div class="player-card" data-id="${p.id}" role="button" tabindex="0">
      <img class="headshot" src="${p.headshot || ''}" alt="${p.firstName} ${p.lastName}" loading="lazy">
      <div class="player-info">
        <div class="player-number">#${p.number || '--'}</div>
        <div class="player-name">${p.firstName} ${p.lastName}</div>
        <div class="player-pos">${positionName(p.position)}</div>
        <div class="player-stats">
          <div class="stat-item"><span>${statLabel('GP')}</span><span class="stat-val">${p.gamesPlayed ?? '--'}</span></div>
          <div class="stat-item"><span>${statLabel('G')}</span><span class="stat-val">${p.goals ?? '--'}</span></div>
          <div class="stat-item"><span>${statLabel('A')}</span><span class="stat-val">${p.assists ?? '--'}</span></div>
          <div class="stat-item"><span>${statLabel('PTS')}</span><span class="stat-val">${p.points ?? '--'}</span></div>
          <div class="stat-item"><span>${statLabel('+/-')}</span><span class="stat-val">${p.plusMinus != null ? (p.plusMinus > 0 ? '+' : '') + p.plusMinus : '--'}</span></div>
        </div>
      </div>
    </div>`;
}

function buildGoalieCard(p) {
  return `
    <div class="player-card" data-id="${p.id}" role="button" tabindex="0">
      <img class="headshot" src="${p.headshot || ''}" alt="${p.firstName} ${p.lastName}" loading="lazy">
      <div class="player-info">
        <div class="player-number">#${p.number || '--'}</div>
        <div class="player-name">${p.firstName} ${p.lastName}</div>
        <div class="player-pos">${positionName(p.position)}</div>
        <div class="player-stats">
          <div class="stat-item"><span>${statLabel('GP')}</span><span class="stat-val">${p.gamesPlayed ?? '--'}</span></div>
          <div class="stat-item"><span>${statLabel('W')}</span><span class="stat-val">${p.wins ?? '--'}</span></div>
          <div class="stat-item"><span>${statLabel('L')}</span><span class="stat-val">${p.losses ?? '--'}</span></div>
          <div class="stat-item"><span>${statLabel('GAA')}</span><span class="stat-val">${p.goalsAgainstAverage != null ? formatGAA(p.goalsAgainstAverage) : '--'}</span></div>
          <div class="stat-item"><span>${statLabel('SV%')}</span><span class="stat-val">${p.savePercentage != null ? formatSavePctg(p.savePercentage) : '--'}</span></div>
          <div class="stat-item"><span>${statLabel('SO')}</span><span class="stat-val">${p.shutouts ?? '--'}</span></div>
        </div>
      </div>
    </div>`;
}

function buildInjuryRow(inj) {
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
        ${inj.shortComment ? `<span class="injury-comment">${inj.shortComment}</span>` : ''}
      </div>
      <span class="injury-status-badge ${statusClass}">${inj.status}</span>
    </div>`;
}

export async function renderPlayerDetail(container, playerId) {
  showLoading(container);
  try {
    const data = await getPlayerDetails(playerId);
    const p = data;
    const isGoalie = p.position === 'G';
    const fullName = `${getName(p.firstName)} ${getName(p.lastName)}`;

    const seasonStats = p.featuredStats?.season
      || (p.seasonTotals?.length ? p.seasonTotals[p.seasonTotals.length - 1] : null);

    let statsHtml = '';
    if (isGoalie && seasonStats) {
      statsHtml = `
        <h3>This Season</h3>
        <div class="stats-table"><table>
          <thead><tr><th>${statLabel('GP')}</th><th>${statLabel('W')}</th><th>${statLabel('L')}</th><th>${statLabel('OTL')}</th><th>${statLabel('GAA')}</th><th>${statLabel('SV%')}</th><th>${statLabel('SO')}</th></tr></thead>
          <tbody><tr>
            <td>${seasonStats.gamesPlayed ?? '--'}</td>
            <td>${seasonStats.wins ?? '--'}</td>
            <td>${seasonStats.losses ?? '--'}</td>
            <td>${seasonStats.otLosses ?? seasonStats.overtimeLosses ?? '--'}</td>
            <td>${seasonStats.goalsAgainstAverage != null ? formatGAA(seasonStats.goalsAgainstAverage) : '--'}</td>
            <td>${seasonStats.savePercentage != null ? formatSavePctg(seasonStats.savePercentage) : '--'}</td>
            <td>${seasonStats.shutouts ?? '--'}</td>
          </tr></tbody>
        </table></div>`;
    } else if (seasonStats) {
      statsHtml = `
        <h3>This Season</h3>
        <div class="stats-table"><table>
          <thead><tr><th>${statLabel('GP')}</th><th>${statLabel('G')}</th><th>${statLabel('A')}</th><th>${statLabel('PTS')}</th><th>${statLabel('+/-')}</th><th>${statLabel('PIM')}</th><th>${statLabel('SOG')}</th><th>${statLabel('SH%')}</th></tr></thead>
          <tbody><tr>
            <td>${seasonStats.gamesPlayed ?? '--'}</td>
            <td>${seasonStats.goals ?? '--'}</td>
            <td>${seasonStats.assists ?? '--'}</td>
            <td>${seasonStats.points ?? '--'}</td>
            <td>${seasonStats.plusMinus != null ? (seasonStats.plusMinus > 0 ? '+' : '') + seasonStats.plusMinus : '--'}</td>
            <td>${seasonStats.pim ?? seasonStats.penaltyMinutes ?? '--'}</td>
            <td>${seasonStats.shots ?? '--'}</td>
            <td>${seasonStats.shootingPctg != null ? (seasonStats.shootingPctg * 100).toFixed(1) + '%' : '--'}</td>
          </tr></tbody>
        </table></div>`;
    }

    // Last 5 games
    let last5Html = '';
    if (p.last5Games?.length) {
      const rows = p.last5Games.map(g => {
        if (isGoalie) {
          return `<tr>
            <td>${g.opponentAbbrev || '--'}</td>
            <td>${g.decision || '--'}</td>
            <td>${g.goalsAgainst ?? '--'}</td>
            <td>${g.savePctg != null ? formatSavePctg(g.savePctg) : '--'}</td>
            <td>${g.shotsAgainst ?? '--'}</td>
          </tr>`;
        }
        return `<tr>
          <td>${g.opponentAbbrev || '--'}</td>
          <td>${g.goals ?? 0}</td>
          <td>${g.assists ?? 0}</td>
          <td>${g.points ?? 0}</td>
          <td>${g.plusMinus != null ? (g.plusMinus > 0 ? '+' : '') + g.plusMinus : '--'}</td>
          <td>${g.shots ?? 0}</td>
        </tr>`;
      }).join('');

      const headers = isGoalie
        ? `<th>Opp</th><th>Dec</th><th>${statLabel('GA')}</th><th>${statLabel('SV%')}</th><th>SA</th>`
        : `<th>Opp</th><th>${statLabel('G')}</th><th>${statLabel('A')}</th><th>${statLabel('PTS')}</th><th>${statLabel('+/-')}</th><th>${statLabel('SOG')}</th>`;

      last5Html = `
        <h3 style="margin-top:var(--space-lg)">Last 5 Games</h3>
        <div class="stats-table"><table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
    }

    container.innerHTML = `
      <div class="player-detail">
        <a href="#roster" class="back-link">&larr; Back to Roster</a>
        <div class="player-hero">
          <img src="${p.headshot || ''}" alt="${fullName}" loading="lazy">
          <div class="player-hero-info">
            <h2>#${p.sweaterNumber || '--'} ${fullName}</h2>
            <div class="meta">
              ${positionName(p.position)}<br>
              Height: ${formatHeight(p.heightInInches)}&nbsp;&middot;&nbsp;Weight: ${p.weightInPounds || '--'} lbs<br>
              Born: ${p.birthDate || '--'}&nbsp;&middot;&nbsp;${getName(p.birthCity)}, ${getName(p.birthCountry)}<br>
              Shoots/Catches: ${p.shootsCatches || '--'}
            </div>
          </div>
        </div>
        ${statsHtml}
        ${last5Html}
      </div>`;
  } catch (e) {
    showError(container, 'Unable to load player details.');
  }
}
