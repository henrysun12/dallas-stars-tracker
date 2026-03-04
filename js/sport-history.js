import { getCurrentTeam } from './teams.js';

const HISTORIES = {
  cowboys: {
    titles: [
      { name: 'Super Bowl Championships', icon: '\uD83C\uDFC6', years: ['VI (1971)', 'XII (1977)', 'XXVII (1992)', 'XXVIII (1993)', 'XXX (1995)'], tier: 'cup', desc: 'Five-time Super Bowl champions, tied for 3rd most in NFL history.' },
      { name: 'NFC Championships', icon: '\uD83C\uDFC5', years: ['1970', '1971', '1975', '1977', '1978', '1992', '1993', '1995'], tier: 'gold', desc: '8 conference championships.' },
      { name: 'NFC East Titles', icon: '\uD83C\uDFF7\uFE0F', years: ['1970', '1971', '1973', '1976-79', '1981', '1985', '1992-96', '2007', '2009', '2014', '2016', '2021', '2023'], tier: 'bronze', desc: 'Perennial division contenders.' },
    ],
    legends: [
      { name: 'Roger Staubach', years: '1969-1979', pos: 'QB', desc: '"Captain America" - 2x Super Bowl champion, led legendary comeback wins.' },
      { name: 'Troy Aikman', years: '1989-2000', pos: 'QB', desc: '3x Super Bowl champion, Hall of Famer, leader of the 90s dynasty.' },
      { name: 'Emmitt Smith', years: '1990-2002', pos: 'RB', desc: 'NFL all-time leading rusher (18,355 yards). 3x Super Bowl champion. Hall of Famer.' },
      { name: 'Michael Irvin', years: '1988-1999', pos: 'WR', desc: '"The Playmaker" - 3x Super Bowl champion, Hall of Famer.' },
      { name: 'Tony Romo', years: '2003-2016', pos: 'QB', desc: 'Franchise passing leader in many categories. Undrafted to Pro Bowler.' },
      { name: 'Jason Witten', years: '2003-2017, 2019', pos: 'TE', desc: '11x Pro Bowler, 2nd most receptions by a TE in NFL history.' },
      { name: 'DeMarcus Ware', years: '2005-2013', pos: 'DE/OLB', desc: 'Franchise sack leader (117). Hall of Famer.' },
      { name: 'Dez Bryant', years: '2010-2017', pos: 'WR', desc: '3x Pro Bowler, iconic "X" celebration.' },
      { name: 'Dak Prescott', years: '2016-Present', pos: 'QB', desc: 'Current franchise quarterback. 2x Pro Bowler.' },
      { name: 'Tom Landry', years: '1960-1988', pos: 'Head Coach', desc: 'Iconic coach with the fedora. 2 Super Bowls, 20 consecutive winning seasons.' },
    ],
    timeline: [
      { year: '1960', text: 'Dallas Cowboys founded as NFL expansion team' },
      { year: '1966', text: 'First playoff appearance, lose NFL Championship to Packers' },
      { year: '1971', text: 'Win Super Bowl VI - first championship' },
      { year: '1975', text: 'Reach Super Bowl X, "Hail Mary" play coined by Roger Staubach' },
      { year: '1977', text: 'Win Super Bowl XII' },
      { year: '1989', text: 'Jerry Jones buys team, hires Jimmy Johnson, begins rebuild' },
      { year: '1992', text: 'Win Super Bowl XXVII - dynasty begins' },
      { year: '1993', text: 'Win Super Bowl XXVIII - back-to-back' },
      { year: '1995', text: 'Win Super Bowl XXX - 3 titles in 4 years' },
      { year: '2007', text: '13-3 season under Wade Phillips, Tony Romo era' },
      { year: '2014', text: '12-4 behind DeMarco Murray\'s rushing title' },
      { year: '2016', text: 'Dak Prescott and Ezekiel Elliott rookie sensations, 13-3 season' },
      { year: '2023', text: '12-5, NFC East champions under Mike McCarthy' },
    ],
  },
  mavs: {
    titles: [
      { name: 'NBA Championship', icon: '\uD83C\uDFC6', years: ['2011'], tier: 'cup', desc: 'Dirk Nowitzki leads Dallas past LeBron\'s Miami Heat in a legendary upset.' },
      { name: 'Western Conference Championships', icon: '\uD83C\uDFC5', years: ['2006', '2011', '2024'], tier: 'gold', desc: '3 trips to the NBA Finals.' },
      { name: 'Division Titles', icon: '\uD83C\uDFF7\uFE0F', years: ['1987', '2007', '2010', '2022', '2024'], tier: 'bronze', desc: 'Multiple Southwest/Midwest division titles.' },
    ],
    legends: [
      { name: 'Dirk Nowitzki', years: '1998-2019', pos: 'PF', desc: 'Greatest Maverick ever. 2011 Finals MVP, league MVP (2007), 14x All-Star. Revolutionized the game as a 7-foot shooter.' },
      { name: 'Luka Doncic', years: '2018-2025', pos: 'PG/SG', desc: 'Generational talent. 5x All-Star, led Mavs to 2024 Finals. Historic scoring and playmaking.' },
      { name: 'Mark Aguirre', years: '1981-1989', pos: 'SF', desc: '3x All-Star, franchise\'s first superstar in Dallas.' },
      { name: 'Rolando Blackman', years: '1981-1992', pos: 'SG', desc: '4x All-Star, franchise all-time great. Number 22 retired.' },
      { name: 'Jason Kidd', years: '1994-96, 2008-12', pos: 'PG', desc: 'Hall of Fame point guard. Key player in 2011 championship run. Later became Mavs head coach.' },
      { name: 'Michael Finley', years: '1996-2005', pos: 'SG/SF', desc: 'Franchise cornerstone during the rise of the Dirk era. 2x All-Star.' },
      { name: 'Jason Terry', years: '2004-2012', pos: 'SG', desc: '"The Jet" - 6th Man of the Year, crucial in 2011 title run.' },
      { name: 'Mark Cuban', years: '2000-Present', pos: 'Owner', desc: 'Transformed the franchise from perennial loser to championship contender.' },
    ],
    timeline: [
      { year: '1980', text: 'Dallas Mavericks founded as NBA expansion team' },
      { year: '1984', text: 'First playoff appearance' },
      { year: '1988', text: 'Reach Western Conference Finals' },
      { year: '1998', text: 'Draft Dirk Nowitzki - franchise-changing moment' },
      { year: '2000', text: 'Mark Cuban buys the team, begins transformation' },
      { year: '2006', text: 'Reach NBA Finals, lose to Miami Heat in 6 games' },
      { year: '2007', text: 'Dirk wins MVP, 67-15 record (best in franchise history)' },
      { year: '2011', text: 'WIN NBA CHAMPIONSHIP - Dirk\'s revenge, beat Miami Heat' },
      { year: '2018', text: 'Draft Luka Doncic, new era begins' },
      { year: '2024', text: 'Luka and Kyrie Irving lead Mavs back to NBA Finals' },
    ],
  },
  rangers: {
    titles: [
      { name: 'World Series Championship', icon: '\uD83C\uDFC6', years: ['2023'], tier: 'cup', desc: 'First championship in franchise history! Beat Arizona Diamondbacks in 5 games.' },
      { name: 'American League Pennant', icon: '\uD83C\uDFC5', years: ['2010', '2011', '2023'], tier: 'gold', desc: '3 trips to the World Series.' },
      { name: 'AL West Titles', icon: '\uD83C\uDFF7\uFE0F', years: ['1996', '1998', '1999', '2010', '2011', '2016', '2023'], tier: 'bronze', desc: 'Multiple division championships.' },
    ],
    legends: [
      { name: 'Nolan Ryan', years: '1989-1993', pos: 'SP', desc: 'All-time strikeout king (5,714). Threw 2 of his 7 career no-hitters as a Ranger. Hall of Famer.' },
      { name: 'Ivan "Pudge" Rodriguez', years: '1991-2002, 2009', pos: 'C', desc: 'Greatest catcher of his era. 10x Gold Glove, 7x All-Star as a Ranger. Hall of Famer.' },
      { name: 'Juan Gonzalez', years: '1989-99, 2002-03', pos: 'OF', desc: '"Juan Gone" - 2x AL MVP (1996, 1998). Power-hitting outfielder.' },
      { name: 'Michael Young', years: '2000-2012', pos: 'SS/3B', desc: 'Mr. Ranger. 7x All-Star, batting champion, franchise hits leader.' },
      { name: 'Adrian Beltre', years: '2011-2018', pos: '3B', desc: '3,000-hit club member. Beloved for his personality and Gold Glove defense. Number 29 retired.' },
      { name: 'Josh Hamilton', years: '2008-2012, 2015', pos: 'OF', desc: '2010 AL MVP. Incredible talent, led Rangers to back-to-back World Series.' },
      { name: 'Corey Seager', years: '2022-Present', pos: 'SS', desc: '2023 World Series MVP. Franchise cornerstone signing.' },
      { name: 'Nelson Cruz', years: '2006-2013', pos: 'OF/DH', desc: 'Power bat who helped lead the 2010-11 World Series runs.' },
    ],
    timeline: [
      { year: '1961', text: 'Washington Senators expansion franchise founded' },
      { year: '1972', text: 'Team relocates to Arlington, Texas - becomes Texas Rangers' },
      { year: '1989', text: 'Sign Nolan Ryan, beginning of a new era' },
      { year: '1994', text: 'Move into The Ballpark in Arlington (now Choctaw Stadium)' },
      { year: '1996', text: 'First division title and playoff appearance' },
      { year: '1998', text: 'Juan Gonzalez wins second AL MVP' },
      { year: '2001', text: 'Alex Rodriguez signs record $252M contract' },
      { year: '2010', text: 'First American League pennant! Lose World Series to Giants' },
      { year: '2011', text: 'Return to World Series, heartbreaking loss to Cardinals in Game 7' },
      { year: '2020', text: 'Open Globe Life Field, new retractable-roof stadium' },
      { year: '2023', text: 'WIN FIRST WORLD SERIES! Beat Diamondbacks, Corey Seager named MVP' },
    ],
  },
};

export function renderSportHistory(container) {
  const team = getCurrentTeam();
  const data = HISTORIES[team.key];

  if (!data) {
    container.innerHTML = `<h2>${team.name} History</h2><p style="color:var(--text-secondary)">History not available for this team.</p>`;
    return;
  }

  let currentTab = 'timeline';

  function render() {
    let tabContent = '';
    if (currentTab === 'timeline') tabContent = renderTimeline(data);
    else if (currentTab === 'trophies') tabContent = renderTrophies(data);
    else tabContent = renderLegends(data);

    container.innerHTML = `
      <h2>${team.name} History</h2>
      <div class="history-tabs" id="history-tabs">
        <button class="filter-btn ${currentTab === 'timeline' ? 'active' : ''}" data-tab="timeline">Timeline</button>
        <button class="filter-btn ${currentTab === 'trophies' ? 'active' : ''}" data-tab="trophies">Trophy Cabinet</button>
        <button class="filter-btn ${currentTab === 'legends' ? 'active' : ''}" data-tab="legends">Legends</button>
      </div>
      <div>${tabContent}</div>
    `;

    container.querySelectorAll('#history-tabs .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        render();
      });
    });
  }

  render();
}

function renderTimeline(data) {
  const events = data.timeline || [];
  return `
    <div class="franchise-timeline card">
      <h3>Franchise Timeline</h3>
      <div class="timeline-events">
        ${events.map(e => {
          const isBig = e.text.includes('WIN') || e.text.includes('Championship') || e.text.includes('CHAMPIONSHIP');
          return `<div class="timeline-event ${isBig ? 'highlight cup' : e.text.includes('First') || e.text.includes('founded') ? 'highlight' : ''}">
            <span class="timeline-year">${e.year}</span>
            <span class="timeline-desc">${e.text}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderTrophies(data) {
  const trophies = data.titles || [];
  return `
    <h3>Championships & Titles</h3>
    <div class="trophy-grid">
      ${trophies.map(t => `
        <div class="trophy-card trophy-${t.tier}">
          <div class="trophy-icon">${t.icon}</div>
          <div class="trophy-info">
            <div class="trophy-name">${t.name}</div>
            <div class="trophy-desc">${t.desc}</div>
            <div class="trophy-years">${t.years.join(' \u00B7 ')}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderLegends(data) {
  const legends = data.legends || [];
  return `
    <h3>All-Time Greats</h3>
    <div class="legends-grid">
      ${legends.map(p => `
        <div class="legend-card">
          <div class="legend-header">
            <div>
              <div class="legend-name">${p.name}</div>
              <div class="legend-meta">${p.pos} \u00B7 ${p.years}</div>
            </div>
          </div>
          <div class="legend-desc">${p.desc}</div>
        </div>`).join('')}
    </div>`;
}
