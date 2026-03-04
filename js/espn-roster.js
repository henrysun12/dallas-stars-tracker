import { getCurrentTeam } from './teams.js';
import { getTeamRoster, getInjuries, getTeamInjuries } from './espn-api.js';
import { showLoading, showError } from './utils.js';

export async function renderEspnRoster(container) {
  const team = getCurrentTeam();
  showLoading(container);
  try {
    const [rosterData, injData] = await Promise.all([
      getTeamRoster(team),
      getInjuries(team).catch(() => null),
    ]);

    const injuries = injData ? getTeamInjuries(injData, team.abbrev) : [];
    const groups = rosterData.athletes || [];
    const coach = rosterData.coach?.[0];

    // Handle different grouping formats (NFL/MLB = grouped, NBA = flat)
    let sections;
    if (groups.length && groups[0].items) {
      // Grouped format (NFL, MLB)
      sections = groups.filter(g => g.items?.length > 0).map(g => ({
        label: g.position || g.displayName || 'Players',
        players: g.items,
      }));
    } else {
      // Flat format (NBA) - group by position
      const byPos = new Map();
      groups.forEach(p => {
        const pos = p.position?.displayName || 'Other';
        if (!byPos.has(pos)) byPos.set(pos, []);
        byPos.get(pos).push(p);
      });
      sections = [...byPos.entries()].map(([label, players]) => ({ label, players }));
    }

    // Build injury map for quick lookup
    const injuryMap = new Map();
    injuries.forEach(inj => injuryMap.set(inj.name.toLowerCase(), inj));

    let html = `<h2>Roster</h2>`;

    // Injury report
    if (injuries.length) {
      html += `
        <div class="injury-section">
          <h3 class="section-heading">Injury Report (${injuries.length})</h3>
          <div class="injury-list">
            ${injuries.map(inj => {
              const statusClass = inj.statusType === 'INJURY_STATUS_OUT' ? 'injury-out' : inj.statusType === 'INJURY_STATUS_IR' ? 'injury-ir' : 'injury-dtd';
              const desc = [inj.type, inj.detail].filter(Boolean).join(' - ') || 'Undisclosed';
              return `<div class="injury-row ${statusClass}">
                ${inj.headshot ? `<img src="${inj.headshot}" alt="" class="injury-headshot" loading="lazy">` : '<div class="injury-headshot-placeholder"></div>'}
                <div class="injury-info"><span class="injury-name">${inj.name}</span><span class="injury-pos">${inj.position}</span></div>
                <div class="injury-details"><span class="injury-type">${desc}</span></div>
                <span class="injury-status-badge ${statusClass}">${inj.status}</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    if (coach) {
      html += `<p style="color:var(--text-secondary);margin-bottom:var(--space-md);font-size:0.9rem">Head Coach: <strong style="color:var(--white)">${coach.firstName} ${coach.lastName}</strong>${coach.experience ? ` (${coach.experience} yrs)` : ''}</p>`;
    }

    for (const section of sections) {
      html += `<h3 class="section-heading">${section.label} (${section.players.length})</h3>`;
      html += '<div class="roster-grid">';
      for (const p of section.players) {
        const name = p.displayName || p.fullName || `${p.firstName} ${p.lastName}`;
        const headshot = p.headshot?.href || '';
        const jersey = p.jersey || '--';
        const pos = p.position?.abbreviation || '';
        const ht = p.displayHeight || '';
        const wt = p.displayWeight || '';
        const exp = p.experience?.years != null ? `${p.experience.years} yr${p.experience.years !== 1 ? 's' : ''}` : '';
        const age = p.age || '';
        const college = p.college?.shortName || p.college?.name || '';
        const inj = injuryMap.get(name.toLowerCase());

        html += `
          <div class="player-card">
            ${headshot ? `<img class="headshot" src="${headshot}" alt="${name}" loading="lazy">` : '<div class="headshot" style="aspect-ratio:1;background:#222"></div>'}
            <div class="player-info">
              <div class="player-number">#${jersey}</div>
              <div class="player-name">${name}</div>
              <div class="player-pos">${pos}${age ? ` &middot; Age ${age}` : ''}</div>
              <div class="player-stats">
                ${ht ? `<div class="stat-item"><span>Ht</span><span class="stat-val">${ht}</span></div>` : ''}
                ${wt ? `<div class="stat-item"><span>Wt</span><span class="stat-val">${wt}</span></div>` : ''}
                ${exp ? `<div class="stat-item"><span>Exp</span><span class="stat-val">${exp}</span></div>` : ''}
                ${college ? `<div class="stat-item"><span>College</span><span class="stat-val">${college}</span></div>` : ''}
              </div>
              ${inj ? `<div style="margin-top:var(--space-sm)"><span class="injury-status-badge ${inj.statusType === 'INJURY_STATUS_OUT' ? 'injury-out' : 'injury-dtd'}">${inj.status} - ${inj.type || 'Injury'}</span></div>` : ''}
            </div>
          </div>`;
      }
      html += '</div>';
    }

    container.innerHTML = html;
  } catch (e) {
    console.error('ESPN Roster error:', e);
    showError(container);
  }
}
