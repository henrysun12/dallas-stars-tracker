import { getCurrentTeam } from './teams.js';
import { getName, getStandings } from './api.js';
import { showLoading, showError, formatHeight } from './utils.js';

const API_BASE = '/api';

// ─── COUNTRY FLAG EMOJI MAP ──────────────────────────
const FLAGS = {
  CAN: '\u{1F1E8}\u{1F1E6}', USA: '\u{1F1FA}\u{1F1F8}', SWE: '\u{1F1F8}\u{1F1EA}',
  FIN: '\u{1F1EB}\u{1F1EE}', RUS: '\u{1F1F7}\u{1F1FA}', CZE: '\u{1F1E8}\u{1F1FF}',
  SVK: '\u{1F1F8}\u{1F1F0}', CHE: '\u{1F1E8}\u{1F1ED}', DEU: '\u{1F1E9}\u{1F1EA}',
  AUT: '\u{1F1E6}\u{1F1F9}', GBR: '\u{1F1EC}\u{1F1E7}', DNK: '\u{1F1E9}\u{1F1F0}',
  NOR: '\u{1F1F3}\u{1F1F4}', LVA: '\u{1F1F1}\u{1F1FB}', BLR: '\u{1F1E7}\u{1F1FE}',
  SVN: '\u{1F1F8}\u{1F1EE}', AUS: '\u{1F1E6}\u{1F1FA}', FRA: '\u{1F1EB}\u{1F1F7}',
};

function getFlag(countryCode) {
  return FLAGS[countryCode] || '\u{1F30D}';
}

// ─── MAIN RENDER ─────────────────────────────────────

export async function renderDraft(container) {
  const team = getCurrentTeam();
  showLoading(container);

  if (team.useNativeAPI) {
    await renderNHLDraft(container, team);
  } else {
    renderMockDraft(container, team);
  }
}

// ─── NHL DRAFT (LIVE DATA) ───────────────────────────

async function fetchDraftRankings() {
  const res = await fetch(`${API_BASE}/v1/draft/rankings/now`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function estimateDraftPosition(standings) {
  // NHL draft order: worst teams pick first (lottery for top picks)
  // Find Dallas's league standing and estimate pick
  const teams = (standings?.standings || []).sort((a, b) => (b.points || 0) - (a.points || 0));
  const totalTeams = teams.length || 32;
  const dalIdx = teams.findIndex(t => (t.teamAbbrev?.default || '') === 'DAL');

  if (dalIdx === -1) return { pick: 25, note: 'Estimated based on playoff contention' };

  // Teams that make playoffs pick 17-32 (reversed by standing)
  // Teams that miss pick 1-16 (lottery eligible)
  const dal = teams[dalIdx];
  const leagueRank = dalIdx + 1;

  // If Dallas is in playoff position (top half), pick is near bottom of first round
  // Draft pick ~ totalTeams - leagueRank + 1 for non-playoff teams,
  // or based on playoff exit for playoff teams
  if (leagueRank <= 16) {
    // Likely playoff team - pick in the 20s-30s
    const estimatedPick = Math.min(32, totalTeams - leagueRank + 17);
    return {
      pick: Math.min(32, Math.max(17, estimatedPick)),
      note: `Based on current ${leagueRank}${ordSuffix(leagueRank)} place in the league`,
      record: `${dal.wins || 0}-${dal.losses || 0}-${dal.otLosses || 0}`,
      points: dal.points || 0,
    };
  } else {
    // Outside playoffs - lottery eligible
    const estimatedPick = totalTeams - leagueRank + 1;
    return {
      pick: Math.max(1, Math.min(16, estimatedPick)),
      note: `Based on current ${leagueRank}${ordSuffix(leagueRank)} place in the league (lottery eligible)`,
      record: `${dal.wins || 0}-${dal.losses || 0}-${dal.otLosses || 0}`,
      points: dal.points || 0,
    };
  }
}

function ordSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

async function renderNHLDraft(container, team) {
  try {
    const [draftData, standingsData] = await Promise.all([
      fetchDraftRankings(),
      getStandings(),
    ]);

    const rankings = (draftData.rankings || []).slice(0, 32);
    const draftYear = draftData.draftYear || 2026;
    const pickInfo = estimateDraftPosition(standingsData);

    let html = `<h2>${draftYear} NHL Draft Prospects</h2>`;

    // Projected pick section
    html += `
      <div class="draft-projected-section">
        <h3>Stars' Projected Pick</h3>
        <div style="display:flex;align-items:center;gap:var(--space-lg);flex-wrap:wrap;">
          <div>
            <div style="font-size:2.5rem;font-weight:800;color:var(--victory-green-light);">#${pickInfo.pick}</div>
            <div style="font-size:0.85rem;color:var(--text-secondary);">Overall</div>
          </div>
          <div style="flex:1;min-width:200px;">
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:var(--space-xs);">${pickInfo.note}</p>
            ${pickInfo.record ? `<p style="color:var(--text-muted);font-size:0.85rem;">Current record: <strong style="color:var(--white);">${pickInfo.record}</strong> (${pickInfo.points} pts)</p>` : ''}
            ${rankings[pickInfo.pick - 1] ? `
              <p style="color:var(--text-muted);font-size:0.85rem;margin-top:var(--space-xs);">
                Prospect at this pick: <strong style="color:var(--victory-green-light);">${getName(rankings[pickInfo.pick - 1].firstName)} ${getName(rankings[pickInfo.pick - 1].lastName)}</strong>
                (${rankings[pickInfo.pick - 1].positionCode})
              </p>` : ''}
          </div>
        </div>
        <p style="font-size:0.75rem;color:var(--text-muted);margin-top:var(--space-md);font-style:italic;">
          * Draft order is determined after season ends. Lottery teams (bottom 16) participate in the draft lottery. Playoff teams pick based on elimination round and regular-season record.
        </p>
      </div>`;

    // Prospect list
    html += '<div class="draft-list">';
    for (let i = 0; i < rankings.length; i++) {
      const p = rankings[i];
      const rank = p.midtermRank || (i + 1);
      const isOurPick = rank === pickInfo.pick;
      const name = `${getName(p.firstName)} ${getName(p.lastName)}`;
      const pos = p.positionCode || '--';
      const height = formatHeight(p.heightInInches);
      const weight = p.weightInPounds ? `${p.weightInPounds} lbs` : '--';
      const country = p.birthCountry || '';
      const flag = getFlag(country);
      const birthDate = p.birthDate ? formatBirthDate(p.birthDate) : '--';
      const amateurTeam = getName(p.lastAmateurTeamName) || '--';
      const amateurLeague = getName(p.lastAmateurLeague) || '';

      html += `
        <div class="draft-pick-card ${isOurPick ? 'our-pick' : ''}">
          <div class="draft-rank">${rank}</div>
          <div class="draft-prospect-info">
            <div class="draft-prospect-name">${name}</div>
            <div class="draft-prospect-meta">
              ${pos} &middot; ${height} / ${weight} &middot;
              <span class="country-flag">${flag}</span> ${country}
            </div>
            <div class="draft-prospect-detail">
              ${amateurTeam}${amateurLeague ? ` (${amateurLeague})` : ''} &middot; Born: ${birthDate}
            </div>
          </div>
          ${isOurPick ? '<div class="draft-team-pick"><span style="font-size:0.75rem;color:var(--victory-green-light);font-weight:600;">STARS PICK</span></div>' : ''}
        </div>`;
    }
    html += '</div>';

    html += `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:var(--space-lg);font-style:italic;">
      Rankings from NHL Central Scouting midterm rankings. Draft order subject to lottery results.
    </p>`;

    container.innerHTML = html;
  } catch (e) {
    showError(container, 'Unable to load draft rankings. The NHL API might be temporarily unavailable.');
  }
}

function formatBirthDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── MOCK DRAFT DATA (NFL / NBA / MLB) ──────────────

const MOCK_DRAFTS = {
  cowboys: {
    year: 2026,
    teamPick: 18,
    teamName: 'Dallas Cowboys',
    round: 1,
    note: 'Cowboys projected late 1st round based on 2025 record.',
    picks: [
      { pick: 1, name: 'Cam Ward', pos: 'QB', school: 'Miami (FL)', note: 'Elite arm talent, Heisman contender' },
      { pick: 2, name: 'Travis Hunter', pos: 'WR/CB', school: 'Colorado', note: 'Two-way sensation, generational talent' },
      { pick: 3, name: 'Shedeur Sanders', pos: 'QB', school: 'Colorado', note: 'Poised passer, strong pocket presence' },
      { pick: 4, name: 'Abdul Carter', pos: 'EDGE', school: 'Penn State', note: 'Explosive pass rusher, elite athleticism' },
      { pick: 5, name: 'Mason Graham', pos: 'DT', school: 'Michigan', note: 'Dominant interior presence' },
      { pick: 6, name: 'Tetairoa McMillan', pos: 'WR', school: 'Arizona', note: 'Elite size and ball skills' },
      { pick: 7, name: 'Will Johnson', pos: 'CB', school: 'Michigan', note: 'Physical cover corner, ball hawk' },
      { pick: 8, name: 'Ashton Jeanty', pos: 'RB', school: 'Boise State', note: 'Record-breaking rusher, dynamic playmaker' },
      { pick: 9, name: 'Kelvin Banks Jr.', pos: 'OT', school: 'Texas', note: 'Premier blind-side protector' },
      { pick: 10, name: 'Will Campbell', pos: 'OT', school: 'LSU', note: 'Mauler in the run game, versatile' },
      { pick: 11, name: 'Mykel Williams', pos: 'EDGE', school: 'Georgia', note: 'Power rusher with elite tools' },
      { pick: 12, name: 'Tyler Warren', pos: 'TE', school: 'Penn State', note: 'Swiss-army weapon, elite receiving TE' },
      { pick: 13, name: 'Colston Loveland', pos: 'TE', school: 'Michigan', note: 'Smooth route-runner, red zone threat' },
      { pick: 14, name: 'James Pearce Jr.', pos: 'EDGE', school: 'Tennessee', note: 'Speed rusher with bend' },
      { pick: 15, name: 'Benjamin Morrison', pos: 'CB', school: 'Notre Dame', note: 'Lockdown cover skills' },
      { pick: 16, name: 'Jalen Milroe', pos: 'QB', school: 'Alabama', note: 'Dual-threat with elite speed' },
      { pick: 17, name: 'Nick Scourton', pos: 'EDGE', school: 'Texas A&M', note: 'Long, violent edge setter' },
      { pick: 18, name: 'Derrick Harmon', pos: 'DT', school: 'Oregon', note: 'Disruptive interior defender', isTeamPick: true },
      { pick: 19, name: 'Emeka Egbuka', pos: 'WR', school: 'Ohio State', note: 'Polished route technician' },
      { pick: 20, name: 'Luther Burden III', pos: 'WR', school: 'Missouri', note: 'Dynamic playmaker after the catch' },
    ],
  },
  mavs: {
    year: 2026,
    teamPick: 24,
    teamName: 'Dallas Mavericks',
    round: 1,
    note: 'Mavericks projected late 1st round as a playoff contender.',
    picks: [
      { pick: 1, name: 'Cooper Flagg', pos: 'SF/PF', school: 'Duke', note: 'Consensus #1 pick, two-way star' },
      { pick: 2, name: 'Dylan Harper', pos: 'SG', school: 'Rutgers', note: 'Elite shot creator, combo guard' },
      { pick: 3, name: 'Ace Bailey', pos: 'SF', school: 'Rutgers', note: 'Long wing scorer with high ceiling' },
      { pick: 4, name: 'VJ Edgecombe', pos: 'SG', school: 'Baylor', note: 'Athletic slasher with explosive burst' },
      { pick: 5, name: 'Kon Knueppel', pos: 'SG/SF', school: 'Duke', note: 'Skilled shooter and playmaker' },
      { pick: 6, name: 'Airn Williams', pos: 'PG', school: 'UConn', note: 'Floor general with high IQ' },
      { pick: 7, name: 'Tre Johnson', pos: 'SG', school: 'Texas', note: 'Bucket getter with range' },
      { pick: 8, name: 'Kasparas Jakucionis', pos: 'PG', school: 'Illinois', note: 'International floor general, crafty passer' },
      { pick: 9, name: 'Liam McNeeley', pos: 'SF', school: 'UConn', note: 'Versatile wing, high motor' },
      { pick: 10, name: 'Jalen Shelley', pos: 'SF', school: 'Iowa State', note: 'Two-way wing with NBA frame' },
      { pick: 11, name: 'Egor Demin', pos: 'PG', school: 'BYU', note: 'Size and vision at point guard' },
      { pick: 12, name: 'Nolan Traore', pos: 'PG', school: 'France (pro)', note: 'Lightning-quick French PG, elite speed' },
      { pick: 13, name: 'Tyler Smith', pos: 'PF', school: 'G League Ignite', note: 'Stretch big with shooting touch' },
      { pick: 14, name: 'Khaman Maluach', pos: 'C', school: 'Duke', note: 'Rim protector with developing offense' },
      { pick: 15, name: 'Collin Murray-Boyles', pos: 'PF', school: 'South Carolina', note: 'Physical combo forward, high motor' },
      { pick: 16, name: 'Alex Sarr', pos: 'C', school: 'France (pro)', note: 'Mobile center, shot-blocking upside' },
      { pick: 17, name: 'Asa Newell', pos: 'PF', school: 'Georgia', note: 'Versatile frontcourt defender' },
      { pick: 18, name: 'Jeremiah Fears', pos: 'PG', school: 'Oklahoma', note: 'Dynamic scoring point guard' },
      { pick: 19, name: 'Hugo Gonzalez', pos: 'PG', school: 'Spain (pro)', note: 'Crafty international floor general' },
      { pick: 20, name: 'Boogie Fland', pos: 'PG', school: 'Arkansas', note: 'Quick guard with scoring punch' },
      { pick: 21, name: 'Darryn Peterson', pos: 'SG', school: 'USC', note: 'Length and scoring versatility' },
      { pick: 22, name: 'Jaland Lowe', pos: 'PG', school: 'Pittsburgh', note: 'Crafty shot creator' },
      { pick: 23, name: 'Bryce James', pos: 'SG/SF', school: 'Arizona', note: 'Athletic wing with upside' },
      { pick: 24, name: 'Koa Peat', pos: 'PF', school: 'Arizona State', note: 'Physical forward with inside-out game', isTeamPick: true },
    ],
  },
  rangers: {
    year: 2026,
    teamPick: 12,
    teamName: 'Texas Rangers',
    round: 1,
    note: 'Rangers projected pick based on 2025 season. MLB draft order follows reverse standings.',
    picks: [
      { pick: 1, name: 'Jac Caglianone', pos: 'LHP/1B', school: 'Florida', note: 'Two-way talent with elite power' },
      { pick: 2, name: 'Braden Montgomery', pos: 'OF', school: 'Texas A&M', note: 'Power-speed combo outfielder' },
      { pick: 3, name: 'Luke Holman', pos: 'RHP', school: 'LSU', note: 'Power arm with plus stuff' },
      { pick: 4, name: 'Trey Yesavage', pos: 'RHP', school: 'East Carolina', note: 'Premium arm with riding fastball' },
      { pick: 5, name: 'Ryan Waldschmidt', pos: 'OF', school: 'Kentucky', note: 'Contact-oriented hitter, high floor' },
      { pick: 6, name: 'Isaiah Lowe', pos: 'LHP', school: 'Cape Fear CC', note: 'Projectable lefty, mid-90s heat' },
      { pick: 7, name: 'Cam Caminiti', pos: '3B', school: 'Saguaro HS (AZ)', note: 'Elite prep bat, advanced approach' },
      { pick: 8, name: 'Seager Wells', pos: 'SS', school: 'Vanderbilt', note: 'Premium defensive shortstop' },
      { pick: 9, name: 'Jackson Ferris', pos: 'LHP', school: 'Virginia', note: 'High-spin fastball, sharp breaking ball' },
      { pick: 10, name: 'Chase Burns', pos: 'RHP', school: 'Wake Forest', note: 'Electric stuff, triple-digit heat' },
      { pick: 11, name: 'Theo Gillen', pos: 'SS', school: 'Australia (HS)', note: 'Toolsy international prep shortstop' },
      { pick: 12, name: 'Grant Turner', pos: 'RHP', school: 'Clemson', note: 'Mid-rotation upside, plus slider', isTeamPick: true },
      { pick: 13, name: 'JJ Wetherholt', pos: '2B', school: 'West Virginia', note: 'Pure hitter with solid bat-to-ball' },
      { pick: 14, name: 'Braylon Mullins', pos: 'SS', school: 'Oklahoma State', note: 'Dynamic athlete, bat speed plus' },
      { pick: 15, name: 'Noah Schultz', pos: 'LHP', school: 'Illinois HS', note: 'Projectable prep lefty with upside' },
    ],
  },
};

// ─── RENDER MOCK DRAFT (ESPN TEAMS) ──────────────────

function renderMockDraft(container, team) {
  const mockData = MOCK_DRAFTS[team.key];
  if (!mockData) {
    showError(container, `Draft data is not available for ${team.name}.`);
    return;
  }

  let html = `<h2>${mockData.year} ${team.league} Mock Draft</h2>`;

  // Disclaimer
  html += `
    <div style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius-md);padding:var(--space-md) var(--space-lg);margin-bottom:var(--space-lg);font-size:0.85rem;color:var(--text-secondary);line-height:1.6;">
      These are projected mock draft picks based on pre-draft analysis. Actual draft order and selections will vary.
      ${mockData.note ? `<br>${mockData.note}` : ''}
    </div>`;

  // Projected pick section
  const teamPick = mockData.picks.find(p => p.isTeamPick);
  if (teamPick) {
    html += `
      <div class="draft-projected-section">
        <h3>${mockData.teamName}'s Projected Pick</h3>
        <div style="display:flex;align-items:center;gap:var(--space-lg);flex-wrap:wrap;">
          <div>
            <div style="font-size:2.5rem;font-weight:800;color:var(--victory-green-light);">#${teamPick.pick}</div>
            <div style="font-size:0.85rem;color:var(--text-secondary);">Round ${mockData.round}, Pick ${teamPick.pick}</div>
          </div>
          <div style="flex:1;min-width:200px;">
            <div style="font-size:1.1rem;font-weight:700;color:var(--white);margin-bottom:var(--space-xs);">
              ${teamPick.name}
            </div>
            <div style="color:var(--text-secondary);font-size:0.9rem;">${teamPick.pos} &middot; ${teamPick.school}</div>
            ${teamPick.note ? `<div style="color:var(--text-muted);font-size:0.85rem;margin-top:var(--space-xs);">${teamPick.note}</div>` : ''}
          </div>
        </div>
      </div>`;
  }

  // Pick list
  html += '<div class="draft-list">';
  for (const p of mockData.picks) {
    const isTeam = !!p.isTeamPick;
    html += `
      <div class="draft-pick-card ${isTeam ? 'our-pick' : ''}">
        <div class="draft-rank">${p.pick}</div>
        <div class="draft-prospect-info">
          <div class="draft-prospect-name">${p.name}</div>
          <div class="draft-prospect-meta">${p.pos} &middot; ${p.school}</div>
          ${p.note ? `<div class="draft-prospect-detail">${p.note}</div>` : ''}
        </div>
        ${isTeam ? `<div class="draft-team-pick"><span style="font-size:0.75rem;color:var(--victory-green-light);font-weight:600;">${team.abbrev} PICK</span></div>` : ''}
      </div>`;
  }
  html += '</div>';

  html += `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:var(--space-lg);font-style:italic;">
    Mock draft projections for illustrative purposes only. Actual picks will differ.
  </p>`;

  container.innerHTML = html;
}
