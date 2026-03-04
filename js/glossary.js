import { debounce } from './utils.js';

const GLOSSARY_DATA = [
  // Game Basics
  { term: 'Period', abbr: 'P', category: 'Game', definition: 'A hockey game has 3 periods, each 20 minutes of playing time. Unlike basketball quarters or soccer halves, hockey uses "periods."' },
  { term: 'Overtime', abbr: 'OT', category: 'Game', definition: 'If the score is tied after 3 periods in the regular season, teams play a 5-minute sudden-death overtime period with 3 skaters per side instead of 5. First goal wins. In the playoffs, overtime periods are full 20-minute 5-on-5 periods until someone scores.' },
  { term: 'Shootout', abbr: 'SO', category: 'Game', definition: 'If nobody scores in regular-season overtime, the game is decided by a shootout \u2014 each team picks 3 players to take solo shots against the opposing goalie. If still tied after 3 rounds, it goes to sudden-death rounds. Shootouts do not exist in the playoffs.' },
  { term: 'Regulation', abbr: 'REG', category: 'Game', definition: 'The standard 60 minutes of a game (three 20-minute periods). A "regulation win" means the team won within these 60 minutes.' },
  { term: 'Power Play', abbr: 'PP', category: 'Game', definition: 'When the opposing team commits a penalty, they lose a player for 2 minutes. The team with more players is "on the power play" \u2014 they have a man advantage and a better chance to score.' },
  { term: 'Penalty Kill', abbr: 'PK', category: 'Game', definition: 'The opposite of a power play. Your team committed a penalty and must play shorthanded (fewer players) for 2 minutes while trying to prevent the other team from scoring.' },
  { term: 'Even Strength', abbr: 'ES', category: 'Game', definition: 'When both teams have the same number of players on the ice (typically 5-on-5). Most of the game is played at even strength.' },
  { term: 'Face-off', abbr: null, category: 'Game', definition: 'How play starts or restarts. Two players face each other and try to win the puck when the ref drops it between them, like a tip-off in basketball.' },
  { term: 'Icing', abbr: null, category: 'Game', definition: 'A rule violation where a team shoots the puck from their half all the way past the opposing goal line without anyone touching it. The puck comes back for a face-off in the offending team\'s zone. Prevents teams from just dumping the puck.' },
  { term: 'Offside', abbr: null, category: 'Game', definition: 'Attacking players cannot enter the opponent\'s zone (past the blue line) before the puck does. Similar to offside in soccer, but based on a fixed line rather than opposing players.' },
  { term: 'Hat Trick', abbr: null, category: 'Game', definition: 'When a single player scores 3 goals in one game. Fans traditionally throw hats onto the ice to celebrate!' },
  { term: 'Empty Net', abbr: 'EN', category: 'Game', definition: 'When a team pulls their goalie and replaces them with an extra skater for an offensive advantage. Usually happens in the final minutes when a team is losing.' },
  { term: 'Crease', abbr: null, category: 'Game', definition: 'The blue-painted area directly in front of the goal. This is the goalie\'s protected territory.' },

  // Player Stats
  { term: 'Goals', abbr: 'G', category: 'Stats', definition: 'Number of goals a player has scored. The most straightforward stat \u2014 the puck went in and this player was the one who shot it.' },
  { term: 'Assists', abbr: 'A', category: 'Stats', definition: 'Number of assists \u2014 passes that directly led to a goal. Up to 2 assists are awarded per goal (primary and secondary).' },
  { term: 'Points', abbr: 'PTS', category: 'Stats', definition: 'Goals + Assists combined. This is the main measure of a player\'s offensive production. 20 goals + 30 assists = 50 points.' },
  { term: 'Plus/Minus', abbr: '+/-', category: 'Stats', definition: 'A player gets +1 when their team scores at even strength while they\'re on the ice, and -1 when the opponent scores. Measures whether good or bad things happen when that player is playing.' },
  { term: 'Games Played', abbr: 'GP', category: 'Stats', definition: 'Number of games a player has appeared in this season.' },
  { term: 'Penalty Minutes', abbr: 'PIM', category: 'Stats', definition: 'Total minutes a player has spent in the penalty box. A rough/aggressive player will have more penalty minutes.' },
  { term: 'Power Play Goals', abbr: 'PPG', category: 'Stats', definition: 'Goals scored while the player\'s team had a power play (man advantage). Shows how effective a player is with the extra space.' },
  { term: 'Shorthanded Goals', abbr: 'SHG', category: 'Stats', definition: 'Goals scored while the player\'s team had fewer players on the ice. These are rare and impressive \u2014 scoring while at a disadvantage.' },
  { term: 'Game-Winning Goal', abbr: 'GWG', category: 'Stats', definition: 'The goal that puts the winning team one ahead of the loser\'s final total. In a 4-2 win, the 3rd goal is the game-winner.' },
  { term: 'Shots on Goal', abbr: 'SOG', category: 'Stats', definition: 'Shots that would have gone in if the goalie hadn\'t stopped them. Missed shots and blocked shots don\'t count.' },
  { term: 'Shooting Percentage', abbr: 'SH%', category: 'Stats', definition: 'Goals divided by shots on goal. 10 goals on 80 shots = 12.5%. League average is around 10-12%.' },
  { term: 'Time on Ice', abbr: 'TOI', category: 'Stats', definition: 'Average time a player spends on the ice per game. Players rotate in "shifts" of about 45-90 seconds. Top players average 20+ minutes.' },
  { term: 'Face-off Win %', abbr: 'FO%', category: 'Stats', definition: 'Percentage of face-offs a player wins. Only tracked for centers. 50% is average; above 55% is excellent.' },

  // Goalie Stats
  { term: 'Wins (Goalie)', abbr: 'W', category: 'Goalie', definition: 'Games won by the goalie. A goalie gets the win if they\'re in net when the go-ahead goal is scored and the team holds the lead.' },
  { term: 'Losses (Goalie)', abbr: 'L', category: 'Goalie', definition: 'Games lost in regulation (the standard 60 minutes).' },
  { term: 'Overtime Losses', abbr: 'OTL', category: 'Goalie', definition: 'Losses in overtime or shootout. Tracked separately because the team still earns 1 point for making it to OT. Less painful than a regulation loss.' },
  { term: 'Goals Against Average', abbr: 'GAA', category: 'Goalie', definition: 'Average goals the goalie allows per 60 minutes. Lower is better. Under 2.50 is very good. Under 2.00 is elite.' },
  { term: 'Save Percentage', abbr: 'SV%', category: 'Goalie', definition: 'Percentage of shots the goalie stops, shown as a 3-decimal number like .920 (stops 92 of 100 shots). Above .910 is solid; above .920 is excellent.' },
  { term: 'Shutout', abbr: 'SO', category: 'Goalie', definition: 'A game where the goalie allows zero goals. One of the most impressive individual accomplishments for a goalie.' },
  { term: 'Saves', abbr: 'SV', category: 'Goalie', definition: 'Total shots the goalie has stopped this season.' },

  // Team / Standings
  { term: 'Points (Standings)', abbr: 'PTS', category: 'Standings', definition: 'The main measure of team success. Teams earn 2 points for any win, 1 point for an overtime/shootout loss, and 0 for a regulation loss. More points = higher in the standings.' },
  { term: 'Points Percentage', abbr: 'PTS%', category: 'Standings', definition: 'Points earned divided by max possible. Useful when teams have played different numbers of games. Higher is better.' },
  { term: 'Goal Differential', abbr: 'DIFF', category: 'Standings', definition: 'Goals scored minus goals allowed. Positive = team scores more than it gives up. Strong indicator of team quality.' },
  { term: 'Goals For', abbr: 'GF', category: 'Standings', definition: 'Total goals the team has scored this season.' },
  { term: 'Goals Against', abbr: 'GA', category: 'Standings', definition: 'Total goals the team has allowed this season.' },
  { term: 'Record', abbr: 'W-L-OTL', category: 'Standings', definition: 'Shown as Wins-Losses-OvertimeLosses (e.g., 36-14-9). The third number is OT/SO losses, which still earn 1 point each.' },
  { term: 'Last 10', abbr: 'L10', category: 'Standings', definition: 'Record over the last 10 games. Gives a sense of recent form / hot or cold streaks.' },
  { term: 'Streak', abbr: 'STK', category: 'Standings', definition: 'Current consecutive win or loss streak, like "W3" (won 3 in a row) or "L2" (lost 2 straight).' },
  { term: 'Division', abbr: 'DIV', category: 'Standings', definition: 'The NHL has 4 divisions: Atlantic, Metropolitan (East), Central, Pacific (West). Dallas is in the Central Division with 8 teams.' },
  { term: 'Conference', abbr: 'CONF', category: 'Standings', definition: 'Two conferences: Eastern (Atlantic + Metropolitan) and Western (Central + Pacific). Dallas is in the Western Conference.' },
  { term: 'Wild Card', abbr: 'WC', category: 'Standings', definition: 'The 2 playoff spots per conference that go to the best remaining teams after the top 3 from each division clinch.' },
  { term: 'Clinch Indicators', abbr: 'x/y/z/p', category: 'Standings', definition: 'Letters next to team names: "x" = clinched playoff spot, "y" = clinched division, "z" = clinched conference, "p" = best league record (Presidents\' Trophy).' },

  // Penalties
  { term: 'Minor Penalty', abbr: null, category: 'Penalties', definition: 'A 2-minute penalty. Most common type. The penalized player sits in the penalty box and their team plays shorthanded. Ends early if the other team scores.' },
  { term: 'Major Penalty', abbr: null, category: 'Penalties', definition: 'A 5-minute penalty for serious offenses like fighting. The full 5 minutes must be served even if the other team scores.' },
  { term: 'Hooking', abbr: null, category: 'Penalties', definition: 'Using the stick to impede another player\'s movement. One of the most common penalties called.' },
  { term: 'Tripping', abbr: null, category: 'Penalties', definition: 'Using the stick or body to knock an opponent\'s feet out from under them.' },
  { term: 'High-Sticking', abbr: null, category: 'Penalties', definition: 'Hitting an opponent with the stick above shoulder height.' },
  { term: 'Cross-Checking', abbr: null, category: 'Penalties', definition: 'Hitting an opponent with both hands on the stick, arms extended. A shoving motion with the stick.' },
  { term: 'Boarding', abbr: null, category: 'Penalties', definition: 'Violently pushing or checking an opponent into the boards (rink walls).' },
  { term: 'Interference', abbr: null, category: 'Penalties', definition: 'Impeding a player who doesn\'t have the puck. You can only hit the player who has the puck.' },

  // Hockey Culture
  { term: 'Dangle', abbr: null, category: 'Culture', definition: 'A fancy stickhandling move to get past a defender. When a player dekes out a defender with skill, they "dangled" them.' },
  { term: 'Top Shelf', abbr: null, category: 'Culture', definition: 'The upper part of the goal. Scoring "top shelf" means the puck went in high, usually over the goalie\'s shoulder. Difficult and impressive.' },
  { term: 'Five-Hole', abbr: null, category: 'Culture', definition: 'The gap between a goalie\'s legs. One of the classic spots to score. Named because the goal has 5 openings: glove side high/low, blocker side high/low, and between the legs.' },
  { term: 'Bar Down', abbr: null, category: 'Culture', definition: 'When a shot hits the crossbar and deflects down into the net. Makes a satisfying "ping" sound that fans love.' },
  { term: 'Gordie Howe Hat Trick', abbr: null, category: 'Culture', definition: 'A goal, an assist, AND a fight all in the same game. Named after legendary player Gordie Howe. The ultimate tough-guy stat line.' },
  { term: 'Zamboni', abbr: null, category: 'Culture', definition: 'The large ice-resurfacing machine that smooths the ice between periods. One of the most iconic machines in all of sports.' },
  { term: 'Blue Line', abbr: null, category: 'Culture', definition: 'The two blue lines dividing the ice into three zones. They define offensive/defensive zones and are key to the offside rule.' },
  { term: 'Red Line', abbr: null, category: 'Culture', definition: 'The line at center ice dividing the rink in half. Used in the icing rule.' },
];

const CATEGORIES = ['All', 'Game', 'Stats', 'Goalie', 'Standings', 'Penalties', 'Culture'];

let currentCat = 'All';
let searchText = '';

export function renderGlossary(container) {
  currentCat = 'All';
  searchText = '';

  const catTabs = CATEGORIES.map(c =>
    `<button class="filter-btn ${c === currentCat ? 'active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');

  container.innerHTML = `
    <h2>NHL Glossary</h2>
    <input type="search" class="glossary-search" id="glossary-search" placeholder="Search terms..." autocomplete="off">
    <div class="glossary-cats" id="glossary-cats">${catTabs}</div>
    <div id="glossary-list"></div>
  `;

  renderList();

  const searchInput = document.getElementById('glossary-search');
  searchInput.addEventListener('input', debounce(() => {
    searchText = searchInput.value.trim().toLowerCase();
    renderList();
  }, 200));

  container.querySelectorAll('#glossary-cats .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#glossary-cats .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      renderList();
    });
  });
}

function filterTerms() {
  return GLOSSARY_DATA.filter(t => {
    if (currentCat !== 'All' && t.category !== currentCat) return false;
    if (searchText) {
      const hay = (t.term + ' ' + (t.abbr || '') + ' ' + t.definition).toLowerCase();
      return hay.includes(searchText);
    }
    return true;
  });
}

function groupByLetter(terms) {
  const groups = {};
  terms.forEach(t => {
    const letter = t.term[0].toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(t);
  });
  return groups;
}

function renderList() {
  const el = document.getElementById('glossary-list');
  if (!el) return;

  const terms = filterTerms();
  if (terms.length === 0) {
    el.innerHTML = '<p style="color:var(--text-secondary);padding:var(--space-lg)">No matching terms found.</p>';
    return;
  }

  const groups = groupByLetter(terms);
  const letters = Object.keys(groups).sort();

  el.innerHTML = letters.map(letter => `
    <div class="letter-heading">${letter}</div>
    ${groups[letter].map(t => `
      <div class="glossary-term">
        <span class="term-name">${t.term}</span>${t.abbr ? `<span class="term-abbr">(${t.abbr})</span>` : ''}
        <div class="term-def">${t.definition}</div>
      </div>
    `).join('')}
  `).join('');
}
