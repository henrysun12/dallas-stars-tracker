import { getCurrentTeam } from './teams.js';
import { getStandings, getStatValue } from './espn-api.js';
import { showLoading, showError } from './utils.js';

export async function renderEspnStandings(container) {
  const team = getCurrentTeam();
  showLoading(container);
  try {
    const data = await getStandings(team);
    if (!data?.children?.length) {
      showError(container, 'Standings data unavailable.');
      return;
    }

    let html = `<h2>${team.league} Standings</h2>`;

    for (const conf of data.children) {
      html += `<h3 style="margin-top:var(--space-lg);margin-bottom:var(--space-sm)">${conf.name || conf.abbreviation}</h3>`;

      // Conference-level standings (NBA, NFL)
      if (conf.standings?.entries?.length) {
        html += buildTable(conf.standings.entries, team);
      }

      // Division-level children (MLB, sometimes NFL)
      if (conf.children) {
        for (const div of conf.children) {
          if (div.standings?.entries?.length) {
            html += `<h4 style="color:var(--text-muted);font-size:0.85rem;margin:var(--space-md) 0 var(--space-xs)">${div.name}</h4>`;
            html += buildTable(div.standings.entries, team);
          }
        }
      }
    }

    container.innerHTML = html;
  } catch (e) {
    console.error('ESPN Standings error:', e);
    showError(container);
  }
}

function buildTable(entries, team) {
  // Determine sport-specific columns
  const sport = team.sport;
  const hasOTL = sport === 'nhl';
  const hasTies = sport === 'nfl';

  const rows = entries.map((e, i) => {
    const abbr = e.team?.abbreviation || '';
    const logo = e.team?.logos?.[0]?.href || '';
    const isUs = abbr === team.abbrev;
    const seed = getStatValue(e.stats, 'playoffSeed');
    const wins = getStatValue(e.stats, 'wins') ?? '--';
    const losses = getStatValue(e.stats, 'losses') ?? '--';
    const ties = getStatValue(e.stats, 'ties');
    const pct = getStatValue(e.stats, 'winPercent') ?? '--';
    const streak = getStatValue(e.stats, 'streak') ?? '--';
    const diff = getStatValue(e.stats, 'differential') || getStatValue(e.stats, 'pointDifferential') || '--';
    const gb = getStatValue(e.stats, 'gamesBehind');
    const l10 = getStatValue(e.stats, 'Last Ten Games');
    const clinch = getStatValue(e.stats, 'clincher') || '';

    let extraCols = '';
    let extraHeaders = '';
    if (sport === 'mlb') {
      extraCols = `<td>${gb ?? '--'}</td><td>${l10 ?? '--'}</td>`;
    } else if (sport === 'nfl' && ties) {
      extraCols = `<td>${ties}</td>`;
    }

    return `<tr class="${isUs ? 'dal-row' : ''}">
      <td>${seed || (i + 1)}${clinch ? ` <span style="color:var(--text-muted);font-size:0.75rem">${clinch}</span>` : ''}</td>
      <td><div class="team-cell"><img src="${logo}" alt="${abbr}" loading="lazy">${abbr}</div></td>
      <td>${wins}</td>
      <td>${losses}</td>
      ${sport === 'nfl' && ties ? `<td>${ties}</td>` : ''}
      <td>${pct}</td>
      <td>${diff}</td>
      ${sport === 'mlb' ? `<td>${gb ?? '--'}</td><td>${l10 ?? '--'}</td>` : ''}
      <td>${streak}</td>
    </tr>`;
  }).join('');

  return `<div class="table-wrap" style="margin-bottom:var(--space-md)">
    <table class="standings-table">
      <thead><tr>
        <th>#</th><th>Team</th><th>W</th><th>L</th>
        ${sport === 'nfl' ? '<th>T</th>' : ''}
        <th>Pct</th><th>+/-</th>
        ${sport === 'mlb' ? '<th>GB</th><th>L10</th>' : ''}
        <th>Strk</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
