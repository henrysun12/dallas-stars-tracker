let currentTab = 'seasons';

export function renderHistory(container) {
  currentTab = 'seasons';
  buildPage(container);
}

function buildPage(container) {
  container.innerHTML = `
    <h2>Stars History</h2>
    <div class="history-tabs" id="history-tabs">
      <button class="filter-btn ${currentTab === 'seasons' ? 'active' : ''}" data-tab="seasons">Seasons</button>
      <button class="filter-btn ${currentTab === 'trophies' ? 'active' : ''}" data-tab="trophies">Trophy Cabinet</button>
      <button class="filter-btn ${currentTab === 'legends' ? 'active' : ''}" data-tab="legends">All-Time Greats</button>
    </div>
    <div id="history-content">${renderTab()}</div>
  `;

  container.querySelectorAll('#history-tabs .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#history-tabs .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      document.getElementById('history-content').innerHTML = renderTab();
    });
  });
}

function renderTab() {
  if (currentTab === 'seasons') return renderSeasons();
  if (currentTab === 'trophies') return renderTrophies();
  return renderLegends();
}

// ─── SEASONS ───────────────────────────────────────────

const SEASONS = [
  { season: '2024-25', record: '52-20-10', pts: 114, playoffs: 'Conference Finals', coach: 'Pete DeBoer', note: 'Presidents\' Trophy contender' },
  { season: '2023-24', record: '52-21-9', pts: 113, playoffs: 'Western Conference Champions', coach: 'Pete DeBoer', note: 'Lost Stanley Cup Final to Florida', highlight: true },
  { season: '2022-23', record: '47-21-14', pts: 108, playoffs: '2nd Round', coach: 'Pete DeBoer', note: 'Central Division champions' },
  { season: '2021-22', record: '46-30-6', pts: 98, playoffs: '1st Round', coach: 'Rick Bowness', note: 'Division title, lost to Calgary' },
  { season: '2020-21', record: '23-19-14', pts: 60, playoffs: 'Did not qualify', coach: 'Rick Bowness', note: 'COVID shortened season' },
  { season: '2019-20', record: '37-24-8', pts: 82, playoffs: '2nd Round', coach: 'Rick Bowness', note: 'Bubble playoffs, lost to Vegas' },
  { season: '2018-19', record: '43-32-7', pts: 93, playoffs: '2nd Round', coach: 'Jim Montgomery', note: 'Lost to eventual champ St. Louis' },
  { season: '2017-18', record: '42-32-8', pts: 92, playoffs: 'Did not qualify', coach: 'Ken Hitchcock', note: '' },
  { season: '2016-17', record: '34-37-11', pts: 79, playoffs: 'Did not qualify', coach: 'Lindy Ruff', note: '' },
  { season: '2015-16', record: '50-23-9', pts: 109, playoffs: '2nd Round', coach: 'Lindy Ruff', note: 'Central Division title, 50-win season' },
  { season: '2014-15', record: '41-31-10', pts: 92, playoffs: 'Did not qualify', coach: 'Lindy Ruff', note: '' },
  { season: '2013-14', record: '40-31-11', pts: 91, playoffs: '1st Round', coach: 'Lindy Ruff', note: '' },
  { season: '2012-13', record: '22-22-4', pts: 48, playoffs: 'Did not qualify', coach: 'Glen Gulutzan', note: 'Lockout-shortened season' },
  { season: '2011-12', record: '42-35-5', pts: 89, playoffs: 'Did not qualify', coach: 'Glen Gulutzan', note: '' },
  { season: '2010-11', record: '42-29-11', pts: 95, playoffs: 'Did not qualify', coach: 'Marc Crawford', note: '' },
  { season: '2009-10', record: '37-31-14', pts: 88, playoffs: 'Did not qualify', coach: 'Marc Crawford', note: '' },
  { season: '2008-09', record: '36-35-11', pts: 83, playoffs: 'Did not qualify', coach: 'Dave Tippett', note: '' },
  { season: '2007-08', record: '45-30-7', pts: 97, playoffs: 'Conference Finals', coach: 'Dave Tippett', note: 'Lost to Detroit' },
  { season: '2006-07', record: '50-25-7', pts: 107, playoffs: 'Conference Quarterfinals', coach: 'Dave Tippett', note: '50-win season, upset by Vancouver' },
  { season: '2005-06', record: '53-23-6', pts: 112, playoffs: '1st Round', coach: 'Dave Tippett', note: 'Pacific Division title, 53 wins' },
  { season: '2003-04', record: '41-26-13', pts: 97, playoffs: 'Conference Quarterfinals', coach: 'Dave Tippett', note: '' },
  { season: '2002-03', record: '46-17-15', pts: 111, playoffs: 'Conference Finals', coach: 'Dave Tippett', note: 'Presidents\' Trophy winner', highlight: true },
  { season: '2001-02', record: '36-28-13', pts: 90, playoffs: 'Did not qualify', coach: 'Ken Hitchcock', note: '' },
  { season: '2000-01', record: '48-24-8', pts: 106, playoffs: '2nd Round', coach: 'Ken Hitchcock', note: '' },
  { season: '1999-00', record: '43-29-10', pts: 102, playoffs: 'Stanley Cup Final', coach: 'Ken Hitchcock', note: 'Western Conference champions, lost Cup to NJ', highlight: true },
  { season: '1998-99', record: '51-19-12', pts: 114, playoffs: 'STANLEY CUP CHAMPIONS', coach: 'Ken Hitchcock', note: 'First championship in franchise history!', highlight: true, cup: true },
  { season: '1997-98', record: '49-22-11', pts: 109, playoffs: 'Conference Finals', coach: 'Ken Hitchcock', note: 'Presidents\' Trophy winner', highlight: true },
  { season: '1996-97', record: '48-26-8', pts: 104, playoffs: 'Conference Quarterfinals', coach: 'Ken Hitchcock', note: '' },
  { season: '1995-96', record: '26-42-14', pts: 66, playoffs: 'Did not qualify', coach: 'Ken Hitchcock', note: 'Hitchcock hired mid-season' },
  { season: '1994-95', record: '17-23-8', pts: 42, playoffs: 'Conference Quarterfinals', coach: 'Bob Gainey', note: 'Lockout-shortened season' },
  { season: '1993-94', record: '42-29-13', pts: 97, playoffs: 'Conference Semifinals', coach: 'Bob Gainey', note: 'First season in Dallas' },
];

function renderSeasons() {
  const timeline = `
    <div class="franchise-timeline card">
      <h3>Franchise Timeline</h3>
      <div class="timeline-events">
        <div class="timeline-event">
          <span class="timeline-year">1967</span>
          <span class="timeline-desc">Minnesota North Stars founded as NHL expansion team</span>
        </div>
        <div class="timeline-event">
          <span class="timeline-year">1981</span>
          <span class="timeline-desc">North Stars reach the Stanley Cup Final, lose to NY Islanders</span>
        </div>
        <div class="timeline-event">
          <span class="timeline-year">1991</span>
          <span class="timeline-desc">North Stars reach the Stanley Cup Final again, lose to Pittsburgh</span>
        </div>
        <div class="timeline-event highlight">
          <span class="timeline-year">1993</span>
          <span class="timeline-desc">Franchise relocates to Dallas, becomes the Dallas Stars</span>
        </div>
        <div class="timeline-event">
          <span class="timeline-year">1998</span>
          <span class="timeline-desc">Win Presidents' Trophy with best record in the NHL</span>
        </div>
        <div class="timeline-event highlight cup">
          <span class="timeline-year">1999</span>
          <span class="timeline-desc">Win the Stanley Cup! Beat Buffalo Sabres in 6 games (Brett Hull's "No Goal" triple-OT winner)</span>
        </div>
        <div class="timeline-event">
          <span class="timeline-year">2000</span>
          <span class="timeline-desc">Return to Stanley Cup Final, lose to New Jersey Devils</span>
        </div>
        <div class="timeline-event">
          <span class="timeline-year">2003</span>
          <span class="timeline-desc">Second Presidents' Trophy, 111 points</span>
        </div>
        <div class="timeline-event">
          <span class="timeline-year">2014</span>
          <span class="timeline-desc">Jamie Benn wins the Art Ross Trophy as NHL scoring leader</span>
        </div>
        <div class="timeline-event">
          <span class="timeline-year">2024</span>
          <span class="timeline-desc">Return to the Stanley Cup Final for the first time in 24 years</span>
        </div>
      </div>
    </div>`;

  const rows = SEASONS.map(s => `
    <tr class="${s.cup ? 'season-cup' : s.highlight ? 'season-highlight' : ''}">
      <td class="season-year">${s.season}</td>
      <td>${s.record}</td>
      <td><strong>${s.pts}</strong></td>
      <td class="${s.cup ? 'playoff-champ' : ''}">${s.playoffs}</td>
      <td>${s.coach}</td>
      <td class="season-note">${s.note}</td>
    </tr>`).join('');

  return `
    ${timeline}
    <h3 style="margin-top:var(--space-xl)">Dallas Stars Seasons (1993-Present)</h3>
    <div class="table-wrap">
      <table class="standings-table seasons-table">
        <thead><tr>
          <th>Season</th><th>Record</th><th>Pts</th><th>Playoffs</th><th>Coach</th><th>Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── TROPHY CABINET ────────────────────────────────────

const TROPHIES = [
  {
    name: 'Stanley Cup',
    desc: 'NHL Championship \u2014 the most coveted trophy in hockey. Awarded to the playoff champion.',
    years: ['1999'],
    icon: '\uD83C\uDFC6',
    tier: 'cup',
  },
  {
    name: 'Presidents\' Trophy',
    desc: 'Awarded to the team with the best regular-season record in the entire NHL.',
    years: ['1997-98', '2002-03'],
    icon: '\uD83C\uDFC5',
    tier: 'gold',
  },
  {
    name: 'Clarence Campbell Bowl',
    desc: 'Awarded to the Western Conference playoff champions. Winning this means you\'re going to the Stanley Cup Final.',
    years: ['1999', '2000', '2024'],
    icon: '\uD83E\uDD48',
    tier: 'silver',
  },
  {
    name: 'Division Titles',
    desc: 'Best record in the division during the regular season.',
    years: ['1997-98', '1998-99', '2002-03', '2005-06', '2015-16', '2021-22', '2023-24'],
    icon: '\uD83C\uDFF7\uFE0F',
    tier: 'bronze',
  },
];

const INDIVIDUAL_TROPHIES = [
  { name: 'Conn Smythe Trophy', desc: 'Playoff MVP', winner: 'Joe Nieuwendyk', year: '1999', detail: '6 game-winning goals in the 1999 playoffs' },
  { name: 'Art Ross Trophy', desc: 'NHL scoring leader', winner: 'Jamie Benn', year: '2015', detail: '87 points (35G, 52A) \u2014 won on the last day of the season' },
  { name: 'Frank J. Selke Trophy', desc: 'Best defensive forward', winner: 'Jere Lehtinen', year: '1998, 1999, 2003', detail: 'Won three times \u2014 elite two-way winger' },
  { name: 'Bill Masterton Trophy', desc: 'Perseverance & dedication to hockey', winner: 'Various', year: '2019 (Seguin runner-up)', detail: '' },
];

function renderTrophies() {
  const teamCards = TROPHIES.map(t => `
    <div class="trophy-card trophy-${t.tier}">
      <div class="trophy-icon">${t.icon}</div>
      <div class="trophy-info">
        <div class="trophy-name">${t.name}</div>
        <div class="trophy-desc">${t.desc}</div>
        <div class="trophy-years">${t.years.join(' \u00B7 ')}</div>
      </div>
    </div>`).join('');

  const indivRows = INDIVIDUAL_TROPHIES.map(t => `
    <div class="trophy-individual">
      <div class="trophy-indiv-header">
        <span class="trophy-indiv-name">${t.name}</span>
        <span class="trophy-indiv-year">${t.year}</span>
      </div>
      <div class="trophy-indiv-desc">${t.desc}</div>
      <div class="trophy-indiv-winner"><strong>${t.winner}</strong>${t.detail ? ` \u2014 ${t.detail}` : ''}</div>
    </div>`).join('');

  return `
    <h3>Team Trophies</h3>
    <div class="trophy-grid">${teamCards}</div>
    <h3 style="margin-top:var(--space-xl)">Individual Awards</h3>
    <div class="trophy-indiv-list">${indivRows}</div>
  `;
}

// ─── ALL-TIME GREATS ───────────────────────────────────

const LEGENDS = [
  {
    name: 'Mike Modano',
    number: 9,
    retired: true,
    pos: 'Center',
    years: '1993\u20132010',
    stats: '1,459 GP \u00B7 561 G \u00B7 813 A \u00B7 1,374 PTS (franchise totals)',
    accomplishments: [
      'All-time leading American-born scorer in NHL history',
      'Franchise all-time leader in goals, assists, and points',
      'Hockey Hall of Fame inductee (2014)',
      'Stanley Cup champion (1999)',
      'Olympic silver medalist (2002)',
    ],
    desc: 'The greatest player in franchise history. Modano combined elite speed, skill, and longevity to become the face of hockey in Dallas and the highest-scoring American player ever.',
  },
  {
    name: 'Jere Lehtinen',
    number: 26,
    retired: true,
    pos: 'Right Wing',
    years: '1995\u20132010',
    stats: '875 GP \u00B7 243 G \u00B7 271 A \u00B7 514 PTS',
    accomplishments: [
      '3x Frank J. Selke Trophy winner (best defensive forward)',
      'Stanley Cup champion (1999)',
      'One of the best two-way forwards of his era',
      'Spent entire NHL career with Dallas',
    ],
    desc: 'The ultimate two-way winger. Lehtinen could shut down the opponent\'s best players while still contributing offensively. Three Selke Trophies speak for themselves.',
  },
  {
    name: 'Sergei Zubov',
    number: 56,
    retired: true,
    pos: 'Defenseman',
    years: '1996\u20132009',
    stats: '839 GP \u00B7 111 G \u00B7 438 A \u00B7 549 PTS',
    accomplishments: [
      'Hockey Hall of Fame inductee (2019)',
      '2x Stanley Cup champion (1994 with NYR, 1999 with Dallas)',
      'One of the most offensively gifted defensemen ever',
      'Franchise record for points by a defenseman',
    ],
    desc: 'A silky-smooth puck-moving defenseman who could control the game from the blue line. Zubov\'s vision and passing were elite, and he quarterbacked the Stars\' power play for over a decade.',
  },
  {
    name: 'Ed Belfour',
    number: 20,
    retired: false,
    pos: 'Goalie',
    years: '1997\u20132002',
    stats: '307 GP \u00B7 161 W \u00B7 .907 SV% \u00B7 2.26 GAA',
    accomplishments: [
      'Stanley Cup champion (1999)',
      'Hockey Hall of Fame inductee (2011)',
      'Calder Trophy winner, 4x All-Star',
      'Backbone of the Cup-winning team',
    ],
    desc: '"Eagle" Belfour was the fierce, competitive goaltender who backstopped Dallas to the 1999 Cup. Known for his intensity and athleticism between the pipes.',
  },
  {
    name: 'Joe Nieuwendyk',
    number: 25,
    retired: false,
    pos: 'Center',
    years: '1995\u20132002',
    stats: '431 GP \u00B7 178 G \u00B7 167 A \u00B7 345 PTS',
    accomplishments: [
      'Conn Smythe Trophy winner (1999 playoff MVP)',
      'Stanley Cup champion (1999)',
      '3x Stanley Cup champion overall',
      '6 game-winning goals in the 1999 playoffs',
    ],
    desc: 'A clutch playoff performer who earned the Conn Smythe Trophy with 6 game-winning goals in the 1999 playoffs. Nieuwendyk was the ultimate big-game player.',
  },
  {
    name: 'Derian Hatcher',
    number: 2,
    retired: false,
    pos: 'Defenseman',
    years: '1991\u20132003',
    stats: '727 GP \u00B7 56 G \u00B7 178 A \u00B7 234 PTS',
    accomplishments: [
      'Team captain during the 1999 Stanley Cup run',
      'Hoisted the Cup first as captain',
      'Imposing physical defenseman at 6\'5"',
      'Longest-tenured Stars captain of that era',
    ],
    desc: 'The towering captain who led Dallas to the promised land. Hatcher was a tough, physical defenseman who set the tone and was the first Star to lift the Cup in 1999.',
  },
  {
    name: 'Marty Turco',
    number: 35,
    retired: false,
    pos: 'Goalie',
    years: '2000\u20132010',
    stats: '509 GP \u00B7 262 W \u00B7 .910 SV% \u00B7 2.28 GAA',
    accomplishments: [
      'Franchise leader in goaltender wins',
      'Led NHL in GAA in 2002-03 (1.72)',
      'Pioneered puck-handling goaltending in Dallas',
      'Three consecutive 40-win seasons',
    ],
    desc: 'Turco took the reins from Belfour and became one of the league\'s premier goalies. His puck-handling skills were ahead of his time and his 1.72 GAA season in 2003 was spectacular.',
  },
  {
    name: 'Brenden Morrow',
    number: 10,
    retired: false,
    pos: 'Left Wing',
    years: '1999\u20132013',
    stats: '698 GP \u00B7 193 G \u00B7 210 A \u00B7 403 PTS',
    accomplishments: [
      'Team captain (2006\u20132013)',
      'Olympic gold medalist with Canada (2010)',
      'Heart and soul of the team for a decade',
      'Known for his toughness and leadership',
    ],
    desc: 'The gritty, hard-nosed captain who played through injuries and led by example every night. Morrow embodied the Stars\' identity during the 2000s.',
  },
  {
    name: 'Jamie Benn',
    number: 14,
    retired: false,
    pos: 'Left Wing',
    years: '2009\u2013Present',
    stats: '1,100+ GP \u00B7 370+ G \u00B7 470+ A \u00B7 840+ PTS',
    accomplishments: [
      'Art Ross Trophy winner (2015) \u2014 NHL scoring leader',
      'Team captain since 2013',
      'Longest-tenured current NHL captain',
      'Olympic gold medalist with Canada (2014)',
      'Five-time All-Star',
    ],
    desc: 'The current captain and face of the franchise for over a decade. Benn won the Art Ross Trophy on the final day of the 2014-15 season and has been the heart of the Stars ever since.',
  },
  {
    name: 'Tyler Seguin',
    number: 91,
    retired: false,
    pos: 'Center',
    years: '2013\u2013Present',
    stats: '750+ GP \u00B7 300+ G \u00B7 350+ A \u00B7 650+ PTS',
    accomplishments: [
      'Stanley Cup champion (2011 with Boston)',
      'Multiple 30+ goal seasons with Dallas',
      'Dynamic offensive center',
      'Three-time All-Star',
    ],
    desc: 'Acquired in a blockbuster trade with Boston, Seguin became one of the NHL\'s most dynamic offensive talents. He and Benn formed one of the league\'s most feared duos.',
  },
];

const RETIRED_NUMBERS = [
  { number: 1, name: 'Bill Masterton', note: 'Honored \u2014 the only NHL player to die from injuries sustained during a game (1968, as a Minnesota North Star). The NHL\'s perseverance award is named after him.' },
  { number: 7, name: 'Neal Broten', note: 'Minnesota North Stars legend. "Miracle on Ice" member (1980 Olympics). First American to score 100 points in an NHL season.' },
  { number: 8, name: 'Bill Goldsworthy', note: 'Minnesota North Stars legend. Franchise\'s first star player and goal-celebration pioneer.' },
  { number: 9, name: 'Mike Modano', note: 'Greatest player in franchise history. All-time American-born scoring leader.' },
  { number: 19, name: 'Bill Masterton', note: 'Also honored for Masterton (wore #19 originally in Minnesota).' },
  { number: 26, name: 'Jere Lehtinen', note: 'Three-time Selke Trophy winner. Spent his entire NHL career in Dallas.' },
  { number: 56, name: 'Sergei Zubov', note: 'Hockey Hall of Famer. Greatest defenseman in franchise history.' },
];

function renderLegends() {
  const cards = LEGENDS.map(p => `
    <div class="legend-card">
      <div class="legend-header">
        <div class="legend-number ${p.retired ? 'number-retired' : ''}">#${p.number}</div>
        <div>
          <div class="legend-name">${p.name}</div>
          <div class="legend-meta">${p.pos} \u00B7 ${p.years}</div>
        </div>
      </div>
      <div class="legend-desc">${p.desc}</div>
      <div class="legend-stats">${p.stats}</div>
      <ul class="legend-accolades">
        ${p.accomplishments.map(a => `<li>${a}</li>`).join('')}
      </ul>
      ${p.retired ? '<span class="retired-badge">Number Retired</span>' : ''}
    </div>`).join('');

  const retiredRows = RETIRED_NUMBERS.map(r => `
    <tr>
      <td><strong class="retired-num">#${r.number}</strong></td>
      <td><strong>${r.name}</strong></td>
      <td class="retired-note">${r.note}</td>
    </tr>`).join('');

  return `
    <h3>Franchise Legends</h3>
    <div class="legends-grid">${cards}</div>

    <h3 style="margin-top:var(--space-xl)">Retired Numbers</h3>
    <p style="color:var(--text-secondary);margin-bottom:var(--space-md);font-size:0.9rem">These numbers hang in the rafters at American Airlines Center and will never be worn by another Stars player.</p>
    <div class="table-wrap">
      <table class="standings-table retired-table">
        <thead><tr><th>#</th><th>Player</th><th>Significance</th></tr></thead>
        <tbody>${retiredRows}</tbody>
      </table>
    </div>
  `;
}
