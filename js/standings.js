import { getStandings, getName } from './api.js';
import { formatRecord, formatPctg, statLabel, showLoading, showError } from './utils.js';

let currentView = 'division';

export async function renderStandings(container) {
  showLoading(container);
  try {
    const data = await getStandings();
    currentView = 'division';
    buildPage(container, data);
  } catch (e) {
    showError(container);
  }
}

function buildPage(container, data) {
  container.innerHTML = `
    <h2>Standings</h2>
    <details class="playoff-explainer">
      <summary>How do NHL Playoffs work?</summary>
      <p>The top 3 teams in each division qualify for the playoffs. Then, the 2 next-best teams in each conference (regardless of division) earn "wild card" spots. That means 16 of 32 teams make the playoffs. The gold line in the table below shows the playoff cutoff.</p>
      <p>Teams earn <strong>2 points</strong> for any win, <strong>1 point</strong> for an overtime/shootout loss, and <strong>0 points</strong> for a regulation loss. More points = higher in the standings.</p>
    </details>
    <div class="standings-views">
      <button class="filter-btn active" data-view="division">Division</button>
      <button class="filter-btn" data-view="conference">Conference</button>
      <button class="filter-btn" data-view="league">League</button>
    </div>
    <div id="standings-content"></div>
  `;

  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderView(document.getElementById('standings-content'), data);
    });
  });

  renderView(document.getElementById('standings-content'), data);
}

function renderView(el, data) {
  if (currentView === 'division') el.innerHTML = buildDivisionView(data);
  else if (currentView === 'conference') el.innerHTML = buildConferenceView(data);
  else el.innerHTML = buildLeagueView(data);
}

function tableHeaders() {
  return `<tr>
    <th>#</th><th>Team</th><th>${statLabel('GP')}</th><th>${statLabel('W')}</th><th>${statLabel('L')}</th><th>${statLabel('OTL')}</th><th>${statLabel('PTS')}</th><th>${statLabel('PTS%')}</th><th>${statLabel('GF')}</th><th>${statLabel('GA')}</th><th>${statLabel('DIFF')}</th><th>${statLabel('STK')}</th>
  </tr>`;
}

function teamRow(t, rank) {
  const abbr = t.teamAbbrev?.default || '';
  const isDal = abbr === 'DAL';
  const diff = (t.goalFor || 0) - (t.goalAgainst || 0);
  const diffStr = diff > 0 ? `+${diff}` : String(diff);
  const streak = (t.streakCode || '') + (t.streakCount || '');
  return `<tr class="${isDal ? 'dal-row' : ''}">
    <td>${rank}</td>
    <td><div class="team-cell"><img src="${t.teamLogo || ''}" alt="" loading="lazy">${abbr}</div></td>
    <td>${t.gamesPlayed || 0}</td>
    <td>${t.wins || 0}</td>
    <td>${t.losses || 0}</td>
    <td>${t.otLosses || 0}</td>
    <td><strong>${t.points || 0}</strong></td>
    <td>${formatPctg(t.pointPctg || 0)}</td>
    <td>${t.goalFor || 0}</td>
    <td>${t.goalAgainst || 0}</td>
    <td>${diffStr}</td>
    <td>${streak}</td>
  </tr>`;
}

function buildDivisionView(data) {
  const teams = data.standings || [];
  const divisions = {};
  teams.forEach(t => {
    const div = getName(t.divisionName);
    if (!divisions[div]) divisions[div] = [];
    divisions[div].push(t);
  });

  // Conference grouping for wild cards
  const conferences = {};
  teams.forEach(t => {
    const conf = getName(t.conferenceName);
    if (!conferences[conf]) conferences[conf] = [];
    conferences[conf].push(t);
  });

  let html = '';
  // Order: Central, Pacific, Atlantic, Metropolitan
  const divOrder = ['Central', 'Pacific', 'Atlantic', 'Metropolitan'];
  for (const div of divOrder) {
    if (!divisions[div]) continue;
    const sorted = divisions[div].sort((a, b) => a.divisionSequence - b.divisionSequence);
    html += `<div class="table-wrap"><table class="standings-table"><caption>${div} Division</caption><thead>${tableHeaders()}</thead><tbody>`;
    sorted.forEach((t, i) => {
      html += teamRow(t, i + 1);
      if (i === 2) html += `<tr class="playoff-line"><td colspan="12"></td></tr>`;
    });
    html += '</tbody></table></div>';
  }

  // Wild card sections
  const confOrder = ['Western', 'Eastern'];
  for (const conf of confOrder) {
    const confTeams = conferences[conf];
    if (!confTeams) continue;
    const wc = confTeams.filter(t => t.wildcardSequence > 0).sort((a, b) => a.wildcardSequence - b.wildcardSequence);
    const outside = confTeams.filter(t => (t.wildcardSequence || 0) === 0 && t.divisionSequence > 3).sort((a, b) => (b.points || 0) - (a.points || 0));
    if (wc.length === 0 && outside.length === 0) continue;

    html += `<div class="wild-card-section table-wrap"><table class="standings-table"><caption>${conf} Conference Wild Card</caption><thead>${tableHeaders()}</thead><tbody>`;
    wc.forEach((t, i) => {
      html += teamRow(t, `WC${i + 1}`);
      if (i === 1) html += `<tr class="playoff-line"><td colspan="12"></td></tr>`;
    });
    outside.forEach((t, i) => {
      html += teamRow(t, wc.length + i + 1);
    });
    html += '</tbody></table></div>';
  }

  return html;
}

function buildConferenceView(data) {
  const teams = data.standings || [];
  const conferences = {};
  teams.forEach(t => {
    const conf = getName(t.conferenceName);
    if (!conferences[conf]) conferences[conf] = [];
    conferences[conf].push(t);
  });

  let html = '';
  for (const conf of ['Western', 'Eastern']) {
    if (!conferences[conf]) continue;
    const sorted = conferences[conf].sort((a, b) => a.conferenceSequence - b.conferenceSequence);
    html += `<div class="table-wrap"><table class="standings-table"><caption>${conf} Conference</caption><thead>${tableHeaders()}</thead><tbody>`;
    sorted.forEach((t, i) => {
      html += teamRow(t, i + 1);
      if (i === 7) html += `<tr class="playoff-line"><td colspan="12"></td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  return html;
}

function buildLeagueView(data) {
  const teams = (data.standings || []).sort((a, b) => a.leagueSequence - b.leagueSequence);
  let html = `<div class="table-wrap"><table class="standings-table"><caption>League Standings</caption><thead>${tableHeaders()}</thead><tbody>`;
  teams.forEach((t, i) => {
    html += teamRow(t, i + 1);
    if (i === 15) html += `<tr class="playoff-line"><td colspan="12"></td></tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}
