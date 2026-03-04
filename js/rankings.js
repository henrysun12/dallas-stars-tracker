import { getCurrentTeam } from './teams.js';
import { showLoading, showError } from './utils.js';

// ─── MAIN RENDER ────────────────────────────────────────

export async function renderRankings(container) {
  const team = getCurrentTeam();
  showLoading(container);

  try {
    const [leaders, teamStats] = await Promise.all([
      fetchLeaders(team),
      fetchTeamStats(team),
    ]);

    buildPage(container, team, leaders, teamStats);
  } catch (e) {
    console.error('Rankings error:', e);
    showError(container, 'Unable to load power rankings. Please try again later.');
  }
}

// ─── DATA FETCHING ──────────────────────────────────────

async function fetchLeaders(team) {
  if (team.useNativeAPI) {
    return fetchNHLLeaders();
  }
  return getHardcodedLeaders(team.league);
}

async function fetchNHLLeaders() {
  try {
    const [skaterResp, goalieResp] = await Promise.all([
      fetch('/api/v1/skater-stats-leaders/current?categories=goals,assists,points,plusMinus&limit=10'),
      fetch('/api/v1/goalie-stats-leaders/current?categories=wins,savePctg,goalsAgainstAverage&limit=5'),
    ]);

    if (!skaterResp.ok || !goalieResp.ok) throw new Error('NHL API error');

    const skaterData = await skaterResp.json();
    const goalieData = await goalieResp.json();

    return {
      categories: [
        { title: 'Goals', key: 'goals', players: normalizeNHLLeaders(skaterData.goals) },
        { title: 'Assists', key: 'assists', players: normalizeNHLLeaders(skaterData.assists) },
        { title: 'Points', key: 'points', players: normalizeNHLLeaders(skaterData.points) },
        { title: 'Plus/Minus', key: 'plusMinus', players: normalizeNHLLeaders(skaterData.plusMinus, true) },
        { title: 'Goalie Wins', key: 'wins', players: normalizeNHLLeaders(goalieData.wins) },
        { title: 'Save Percentage', key: 'savePctg', players: normalizeNHLLeaders(goalieData.savePctg, false, true) },
        { title: 'Goals Against Avg', key: 'gaa', players: normalizeNHLLeaders(goalieData.goalsAgainstAverage, false, false, true) },
      ],
    };
  } catch (e) {
    console.warn('NHL leaders fetch failed, using fallback:', e);
    return getHardcodedLeaders('NHL');
  }
}

function normalizeNHLLeaders(leaderArr, isPlusMinus = false, isSavePct = false, isGAA = false) {
  if (!Array.isArray(leaderArr)) return [];
  return leaderArr.map((p, i) => {
    let displayValue = p.value;
    if (isSavePct) displayValue = '.' + (p.value * 1000).toFixed(0);
    else if (isGAA) displayValue = Number(p.value).toFixed(2);
    else if (isPlusMinus && p.value > 0) displayValue = '+' + p.value;

    return {
      rank: i + 1,
      name: `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(),
      team: p.teamAbbrev || '',
      position: p.position || '',
      value: displayValue,
      headshot: p.headshot || '',
      sweaterNumber: p.sweaterNumber || '',
      teamLogo: p.teamLogo || '',
    };
  });
}

async function fetchTeamStats(team) {
  try {
    const resp = await fetch(`/espn/apis/site/v2/sports/${team.espnSport}/teams/${team.espnTeamId}/statistics`);
    if (!resp.ok) throw new Error(`ESPN stats ${resp.status}`);
    const data = await resp.json();
    return parseESPNStats(data, team.league);
  } catch (e) {
    console.warn('ESPN team stats fetch failed:', e);
    return null;
  }
}

function parseESPNStats(data, league) {
  const categories = data?.results?.stats?.categories || data?.stats?.categories || [];
  const statMap = {};

  for (const cat of categories) {
    const catName = cat.displayName || cat.name || '';
    statMap[catName] = {};
    for (const stat of (cat.stats || [])) {
      statMap[catName][stat.displayName || stat.name] = {
        value: parseFloat(stat.displayValue) || 0,
        displayValue: stat.displayValue || '0',
        rank: stat.rankDisplayValue || '',
      };
    }
  }

  return statMap;
}

// ─── HARDCODED LEADERS ──────────────────────────────────

function getHardcodedLeaders(league) {
  const data = HARDCODED_LEADERS[league];
  if (!data) return { categories: [] };
  return { categories: data };
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect fill="%23333" width="80" height="80" rx="40"/><text x="40" y="48" text-anchor="middle" fill="%23888" font-size="28" font-family="sans-serif">?</text></svg>'
);

const HARDCODED_LEADERS = {
  NHL: [
    { title: 'Goals', key: 'goals', players: [
      { rank: 1, name: 'Sam Reinhart', team: 'FLA', position: 'C', value: 33, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Leon Draisaitl', team: 'EDM', position: 'C', value: 32, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Nikita Kucherov', team: 'TBL', position: 'RW', value: 31, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Nathan MacKinnon', team: 'COL', position: 'C', value: 30, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Kirill Kaprizov', team: 'MIN', position: 'LW', value: 29, headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Auston Matthews', team: 'TOR', position: 'C', value: 28, headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Jason Robertson', team: 'DAL', position: 'LW', value: 27, headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Jake Guentzel', team: 'TBL', position: 'LW', value: 26, headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Brady Tkachuk', team: 'OTT', position: 'LW', value: 25, headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Mikko Rantanen', team: 'CAR', position: 'RW', value: 25, headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Assists', key: 'assists', players: [
      { rank: 1, name: 'Nathan MacKinnon', team: 'COL', position: 'C', value: 55, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Nikita Kucherov', team: 'TBL', position: 'RW', value: 52, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Connor McDavid', team: 'EDM', position: 'C', value: 50, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Cale Makar', team: 'COL', position: 'D', value: 48, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Mitch Marner', team: 'TOR', position: 'RW', value: 46, headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Leon Draisaitl', team: 'EDM', position: 'C', value: 44, headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Roope Hintz', team: 'DAL', position: 'C', value: 38, headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Quinn Hughes', team: 'VAN', position: 'D', value: 37, headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Jack Hughes', team: 'NJD', position: 'C', value: 36, headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Kirill Kaprizov', team: 'MIN', position: 'LW', value: 35, headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Points', key: 'points', players: [
      { rank: 1, name: 'Nathan MacKinnon', team: 'COL', position: 'C', value: 85, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Nikita Kucherov', team: 'TBL', position: 'RW', value: 83, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Leon Draisaitl', team: 'EDM', position: 'C', value: 76, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Connor McDavid', team: 'EDM', position: 'C', value: 74, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Kirill Kaprizov', team: 'MIN', position: 'LW', value: 64, headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Sam Reinhart', team: 'FLA', position: 'C', value: 63, headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Jason Robertson', team: 'DAL', position: 'LW', value: 61, headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Auston Matthews', team: 'TOR', position: 'C', value: 60, headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Cale Makar', team: 'COL', position: 'D', value: 59, headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Mitch Marner', team: 'TOR', position: 'RW', value: 58, headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Goalie Wins', key: 'wins', players: [
      { rank: 1, name: 'Connor Hellebuyck', team: 'WPG', position: 'G', value: 30, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Sergei Bobrovsky', team: 'FLA', position: 'G', value: 26, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Jake Oettinger', team: 'DAL', position: 'G', value: 25, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Igor Shesterkin', team: 'NYR', position: 'G', value: 24, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Ilya Sorokin', team: 'NYI', position: 'G', value: 23, headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Save Percentage', key: 'savePctg', players: [
      { rank: 1, name: 'Connor Hellebuyck', team: 'WPG', position: 'G', value: '.924', headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Jake Oettinger', team: 'DAL', position: 'G', value: '.921', headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Igor Shesterkin', team: 'NYR', position: 'G', value: '.918', headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Andrei Vasilevskiy', team: 'TBL', position: 'G', value: '.916', headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Linus Ullmark', team: 'OTT', position: 'G', value: '.914', headshot: PLACEHOLDER_IMG },
    ]},
  ],

  NFL: [
    { title: 'Passing Yards', key: 'passYards', players: [
      { rank: 1, name: 'Joe Burrow', team: 'CIN', position: 'QB', value: '4,918', headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Jared Goff', team: 'DET', position: 'QB', value: '4,629', headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Lamar Jackson', team: 'BAL', position: 'QB', value: '4,501', headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Patrick Mahomes', team: 'KC', position: 'QB', value: '4,337', headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Dak Prescott', team: 'DAL', position: 'QB', value: '4,212', headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Josh Allen', team: 'BUF', position: 'QB', value: '4,108', headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Jayden Daniels', team: 'WAS', position: 'QB', value: '3,978', headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Brock Purdy', team: 'SF', position: 'QB', value: '3,864', headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Tua Tagovailoa', team: 'MIA', position: 'QB', value: '3,756', headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'C.J. Stroud', team: 'HOU', position: 'QB', value: '3,691', headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Rushing Yards', key: 'rushYards', players: [
      { rank: 1, name: 'Derrick Henry', team: 'BAL', position: 'RB', value: '1,921', headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Saquon Barkley', team: 'PHI', position: 'RB', value: '1,838', headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Josh Jacobs', team: 'GB', position: 'RB', value: '1,329', headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Bijan Robinson', team: 'ATL', position: 'RB', value: '1,276', headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Jahmyr Gibbs', team: 'DET', position: 'RB', value: '1,204', headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'De\'Von Achane', team: 'MIA', position: 'RB', value: '1,102', headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Rico Dowdle', team: 'DAL', position: 'RB', value: '1,079', headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Kyren Williams', team: 'LAR', position: 'RB', value: '1,054', headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Jonathan Taylor', team: 'IND', position: 'RB', value: '1,033', headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'James Cook', team: 'BUF', position: 'RB', value: '1,009', headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Receiving Yards', key: 'recYards', players: [
      { rank: 1, name: 'Ja\'Marr Chase', team: 'CIN', position: 'WR', value: '1,708', headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Amon-Ra St. Brown', team: 'DET', position: 'WR', value: '1,263', headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Terry McLaurin', team: 'WAS', position: 'WR', value: '1,215', headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'CeeDee Lamb', team: 'DAL', position: 'WR', value: '1,194', headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Malik Nabers', team: 'NYG', position: 'WR', value: '1,167', headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Zay Flowers', team: 'BAL', position: 'WR', value: '1,124', headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Brian Thomas Jr.', team: 'JAX', position: 'WR', value: '1,088', headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Puka Nacua', team: 'LAR', position: 'WR', value: '1,054', headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Drake London', team: 'ATL', position: 'WR', value: '1,021', headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Ladd McConkey', team: 'LAC', position: 'WR', value: '998', headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Sacks', key: 'sacks', players: [
      { rank: 1, name: 'Trey Hendrickson', team: 'CIN', position: 'DE', value: 17.5, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Myles Garrett', team: 'CLE', position: 'DE', value: 14.0, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Micah Parsons', team: 'DAL', position: 'LB', value: 12.5, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Jonathan Greenard', team: 'MIN', position: 'DE', value: 12.0, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Patrick Jones', team: 'MIN', position: 'DE', value: 11.5, headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Nik Bonitto', team: 'DEN', position: 'LB', value: 11.5, headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Danielle Hunter', team: 'HOU', position: 'DE', value: 11.0, headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Maxx Crosby', team: 'LV', position: 'DE', value: 10.5, headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Josh Hines-Allen', team: 'JAX', position: 'LB', value: 10.5, headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Chris Jones', team: 'KC', position: 'DT', value: 10.0, headshot: PLACEHOLDER_IMG },
    ]},
  ],

  NBA: [
    { title: 'Points Per Game', key: 'ppg', players: [
      { rank: 1, name: 'Luka Doncic', team: 'DAL', position: 'PG', value: 33.2, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Shai Gilgeous-Alexander', team: 'OKC', position: 'SG', value: 32.1, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Giannis Antetokounmpo', team: 'MIL', position: 'PF', value: 31.5, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Jayson Tatum', team: 'BOS', position: 'SF', value: 28.4, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Anthony Edwards', team: 'MIN', position: 'SG', value: 27.8, headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Kevin Durant', team: 'PHX', position: 'SF', value: 27.1, headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Donovan Mitchell', team: 'CLE', position: 'SG', value: 26.3, headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Anthony Davis', team: 'LAL', position: 'PF', value: 25.9, headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Jalen Brunson', team: 'NYK', position: 'PG', value: 25.6, headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'De\'Aaron Fox', team: 'SAC', position: 'PG', value: 25.2, headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Rebounds Per Game', key: 'rpg', players: [
      { rank: 1, name: 'Domantas Sabonis', team: 'SAC', position: 'C', value: 14.1, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Anthony Davis', team: 'LAL', position: 'PF', value: 12.4, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Nikola Jokic', team: 'DEN', position: 'C', value: 12.3, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Giannis Antetokounmpo', team: 'MIL', position: 'PF', value: 11.6, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Rudy Gobert', team: 'MIN', position: 'C', value: 10.8, headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Daniel Gafford', team: 'DAL', position: 'C', value: 9.2, headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Bam Adebayo', team: 'MIA', position: 'C', value: 9.1, headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Karl-Anthony Towns', team: 'NYK', position: 'C', value: 8.9, headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Evan Mobley', team: 'CLE', position: 'PF', value: 8.7, headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Chet Holmgren', team: 'OKC', position: 'C', value: 8.5, headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Assists Per Game', key: 'apg', players: [
      { rank: 1, name: 'Tyrese Haliburton', team: 'IND', position: 'PG', value: 10.8, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Nikola Jokic', team: 'DEN', position: 'C', value: 9.8, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Trae Young', team: 'ATL', position: 'PG', value: 9.5, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Luka Doncic', team: 'DAL', position: 'PG', value: 9.3, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'LaMelo Ball', team: 'CHA', position: 'PG', value: 8.1, headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Shai Gilgeous-Alexander', team: 'OKC', position: 'SG', value: 6.4, headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Jalen Brunson', team: 'NYK', position: 'PG', value: 6.2, headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Fred VanVleet', team: 'HOU', position: 'PG', value: 6.0, headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Kyrie Irving', team: 'DAL', position: 'SG', value: 5.8, headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Darius Garland', team: 'CLE', position: 'PG', value: 5.6, headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Blocks Per Game', key: 'bpg', players: [
      { rank: 1, name: 'Victor Wembanyama', team: 'SAS', position: 'C', value: 3.8, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Chet Holmgren', team: 'OKC', position: 'C', value: 2.6, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Anthony Davis', team: 'LAL', position: 'PF', value: 2.4, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Brook Lopez', team: 'MIL', position: 'C', value: 2.3, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Evan Mobley', team: 'CLE', position: 'PF', value: 1.9, headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Daniel Gafford', team: 'DAL', position: 'C', value: 1.8, headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Walker Kessler', team: 'UTA', position: 'C', value: 1.7, headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Rudy Gobert', team: 'MIN', position: 'C', value: 1.6, headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Bam Adebayo', team: 'MIA', position: 'C', value: 1.5, headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Jaren Jackson Jr.', team: 'MEM', position: 'PF', value: 1.5, headshot: PLACEHOLDER_IMG },
    ]},
  ],

  MLB: [
    { title: 'Batting Average', key: 'avg', players: [
      { rank: 1, name: 'Luis Arraez', team: 'SD', position: '2B', value: '.332', headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Bobby Witt Jr.', team: 'KC', position: 'SS', value: '.322', headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Shohei Ohtani', team: 'LAD', position: 'DH', value: '.310', headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Yordan Alvarez', team: 'HOU', position: 'DH', value: '.306', headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Marcus Semien', team: 'TEX', position: '2B', value: '.301', headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Steven Kwan', team: 'CLE', position: 'LF', value: '.298', headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Juan Soto', team: 'NYM', position: 'RF', value: '.295', headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Corey Seager', team: 'TEX', position: 'SS', value: '.292', headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Freddie Freeman', team: 'LAD', position: '1B', value: '.290', headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Aaron Judge', team: 'NYY', position: 'RF', value: '.288', headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'Home Runs', key: 'hr', players: [
      { rank: 1, name: 'Aaron Judge', team: 'NYY', position: 'RF', value: 58, headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Shohei Ohtani', team: 'LAD', position: 'DH', value: 54, headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Kyle Schwarber', team: 'PHI', position: 'DH', value: 38, headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Marcell Ozuna', team: 'ATL', position: 'DH', value: 37, headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Adolis Garcia', team: 'TEX', position: 'RF', value: 35, headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Pete Alonso', team: 'NYM', position: '1B', value: 34, headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Bobby Witt Jr.', team: 'KC', position: 'SS', value: 33, headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Gunnar Henderson', team: 'BAL', position: 'SS', value: 32, headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Anthony Santander', team: 'BAL', position: 'RF', value: 31, headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Matt Olson', team: 'ATL', position: '1B', value: 30, headshot: PLACEHOLDER_IMG },
    ]},
    { title: 'ERA (Pitchers)', key: 'era', players: [
      { rank: 1, name: 'Chris Sale', team: 'ATL', position: 'SP', value: '2.38', headshot: PLACEHOLDER_IMG },
      { rank: 2, name: 'Tarik Skubal', team: 'DET', position: 'SP', value: '2.39', headshot: PLACEHOLDER_IMG },
      { rank: 3, name: 'Corbin Burnes', team: 'BAL', position: 'SP', value: '2.92', headshot: PLACEHOLDER_IMG },
      { rank: 4, name: 'Zack Wheeler', team: 'PHI', position: 'SP', value: '2.97', headshot: PLACEHOLDER_IMG },
      { rank: 5, name: 'Nathan Eovaldi', team: 'TEX', position: 'SP', value: '3.12', headshot: PLACEHOLDER_IMG },
      { rank: 6, name: 'Logan Webb', team: 'SF', position: 'SP', value: '3.14', headshot: PLACEHOLDER_IMG },
      { rank: 7, name: 'Cole Ragans', team: 'KC', position: 'SP', value: '3.19', headshot: PLACEHOLDER_IMG },
      { rank: 8, name: 'Framber Valdez', team: 'HOU', position: 'SP', value: '3.21', headshot: PLACEHOLDER_IMG },
      { rank: 9, name: 'Gerrit Cole', team: 'NYY', position: 'SP', value: '3.28', headshot: PLACEHOLDER_IMG },
      { rank: 10, name: 'Seth Lugo', team: 'KC', position: 'SP', value: '3.30', headshot: PLACEHOLDER_IMG },
    ]},
  ],
};

// ─── GRADE COMPUTATION ──────────────────────────────────

const GRADE_THRESHOLDS = {
  NHL: {
    Offense:      { statPath: ['Offensive', 'Goals'],              elite: 260, average: 220, invert: false },
    Defense:      { statPath: ['Defensive', 'Goals Against'],      elite: 190, average: 240, invert: true },
    Goaltending:  { statPath: ['Defensive', 'Save Percentage'],    elite: 92.0, average: 90.0, invert: false },
    'Power Play': { statPath: ['Penalties', 'Power Play Pct'],     elite: 26.0, average: 20.0, invert: false },
    'Penalty Kill':{ statPath: ['Penalties', 'Penalty Kill Pct'],  elite: 84.0, average: 78.0, invert: false },
    Physicality:  { statPath: ['General', 'Hits'],                 elite: 1800, average: 1400, invert: false },
  },
  NFL: {
    Passing:      { statPath: ['Passing', 'Completion Pct'],       elite: 68.0, average: 62.0, invert: false },
    Rushing:      { statPath: ['Rushing', 'Yards Per Rush Attempt'], elite: 5.0, average: 4.0, invert: false },
    Defense:      { statPath: ['Defense', 'Sacks'],                elite: 50, average: 30, invert: false },
    Scoring:      { statPath: ['Scoring', 'Total Touchdowns'],     elite: 55, average: 35, invert: false },
    'Special Teams': { statPath: ['Kicking', 'Field Goal Pct'],    elite: 92.0, average: 82.0, invert: false },
  },
  NBA: {
    Offense:      { statPath: ['Offensive', 'Field Goal Pct'],     elite: 49.0, average: 45.0, invert: false },
    Defense:      { statPath: ['Defensive', 'Steals Per Game'],    elite: 9.0, average: 7.0, invert: false },
    Rebounding:   { statPath: ['Defensive', 'Rebounds Per Game'],  elite: 46.0, average: 42.0, invert: false },
    Playmaking:   { statPath: ['Offensive', 'Assists Per Game'],   elite: 28.0, average: 23.0, invert: false },
  },
  MLB: {
    Batting:      { statPath: ['Batting', 'Hits'],                 elite: 1450, average: 1300, invert: false },
    Pitching:     { statPath: ['Pitching', 'ERA'],                 elite: 3.20, average: 4.20, invert: true },
    Speed:        { statPath: ['Batting', 'Stolen Bases'],         elite: 120, average: 70, invert: false },
  },
};

function computeGrades(teamStats, league) {
  const thresholds = GRADE_THRESHOLDS[league];
  if (!thresholds || !teamStats) return [];

  const grades = [];
  for (const [attr, config] of Object.entries(thresholds)) {
    const [catName, statName] = config.statPath;
    const catData = teamStats[catName];
    let rawValue = null;
    let displayValue = '--';

    if (catData) {
      // Try exact match first, then partial match
      const stat = catData[statName] || Object.values(catData).find(s => {
        const key = Object.keys(catData).find(k => catData[k] === s);
        return key && key.toLowerCase().includes(statName.toLowerCase());
      });

      if (stat) {
        rawValue = stat.value;
        displayValue = stat.displayValue;
      } else {
        // Try fuzzy matching on stat names
        for (const [key, val] of Object.entries(catData)) {
          if (key.toLowerCase().replace(/[^a-z]/g, '').includes(statName.toLowerCase().replace(/[^a-z]/g, ''))) {
            rawValue = val.value;
            displayValue = val.displayValue;
            break;
          }
        }
      }
    }

    let grade = 'C';
    let pct = 50;

    if (rawValue !== null) {
      if (config.invert) {
        // Lower is better (e.g., GAA, ERA, Goals Against)
        if (rawValue <= config.elite) { pct = 95; }
        else if (rawValue >= config.average) { pct = 40; }
        else {
          pct = 40 + 55 * ((config.average - rawValue) / (config.average - config.elite));
        }
      } else {
        // Higher is better
        if (rawValue >= config.elite) { pct = 95; }
        else if (rawValue <= config.average) { pct = 40; }
        else {
          pct = 40 + 55 * ((rawValue - config.average) / (config.elite - config.average));
        }
      }
      pct = Math.max(10, Math.min(98, pct));
      grade = pctToGrade(pct);
    }

    grades.push({
      attribute: attr,
      grade,
      pct,
      rawValue,
      displayValue,
    });
  }

  return grades;
}

function pctToGrade(pct) {
  if (pct >= 95) return 'A+';
  if (pct >= 88) return 'A';
  if (pct >= 82) return 'A-';
  if (pct >= 75) return 'B+';
  if (pct >= 68) return 'B';
  if (pct >= 60) return 'B-';
  if (pct >= 52) return 'C+';
  if (pct >= 42) return 'C';
  if (pct >= 30) return 'D+';
  return 'D';
}

function gradeColor(grade) {
  if (grade.startsWith('A')) return '#00c853';
  if (grade.startsWith('B')) return '#448aff';
  if (grade.startsWith('C')) return '#ffd600';
  return '#ff5252';
}

// ─── PAGE BUILDER ───────────────────────────────────────

function buildPage(container, team, leaders, teamStats) {
  injectStyles();

  const grades = computeGrades(teamStats, team.league);

  container.innerHTML = `
    <h2>Power Rankings</h2>
    <p style="color:var(--text-secondary);margin-bottom:var(--space-xl);font-size:0.9rem">
      ${team.league} stat leaders and ${team.name} team attribute grades
    </p>

    <h3 class="section-heading">
      <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
      </svg>
      ${team.league} League Leaders
    </h3>
    <div class="rankings-leaders-section">
      ${buildLeaderCategories(leaders, team)}
    </div>

    <h3 class="section-heading" style="margin-top:var(--space-2xl)">
      <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
      ${team.name} Attribute Grades
    </h3>
    ${grades.length ? `
      <div class="rankings-grades-grid">
        ${grades.map(g => buildGradeCard(g)).join('')}
      </div>
    ` : `
      <div class="card" style="padding:var(--space-xl);text-align:center;color:var(--text-secondary)">
        <p>Team statistics are currently unavailable.</p>
        <p style="font-size:0.85rem;margin-top:var(--space-sm)">ESPN team stats may not be available during the offseason.</p>
      </div>
    `}
  `;
}

function buildLeaderCategories(leaders, team) {
  if (!leaders?.categories?.length) {
    return '<div class="card" style="padding:var(--space-lg);color:var(--text-secondary)">No leader data available.</div>';
  }

  return leaders.categories.map(cat => `
    <div class="rankings-leader-category">
      <h4 class="leader-category-title">${cat.title}</h4>
      <div class="leader-cards-list">
        ${cat.players.map(p => buildLeaderCard(p, team)).join('')}
      </div>
    </div>
  `).join('');
}

function buildLeaderCard(player, team) {
  const isOurs = player.team === team.abbrev;
  const headshotSrc = player.headshot || PLACEHOLDER_IMG;

  return `
    <div class="leader-card ${isOurs ? 'leader-card--ours' : ''}">
      <div class="leader-rank">${player.rank}</div>
      <img class="leader-headshot"
           src="${headshotSrc}"
           alt="${player.name}"
           loading="lazy"
           onerror="this.src='${PLACEHOLDER_IMG}'">
      <div class="leader-info">
        <span class="leader-name">${player.name}</span>
        <span class="leader-meta">${player.team} &middot; ${player.position}</span>
      </div>
      <div class="leader-value">${player.value}</div>
    </div>
  `;
}

function buildGradeCard(gradeData) {
  const color = gradeColor(gradeData.grade);
  const barWidth = Math.max(8, gradeData.pct);

  return `
    <div class="grade-card">
      <div class="grade-card-header">
        <span class="grade-attribute">${gradeData.attribute}</span>
        <span class="grade-badge" style="background:${color};color:#000">${gradeData.grade}</span>
      </div>
      <div class="grade-bar-track">
        <div class="grade-bar" style="width:${barWidth}%;background:${color}"></div>
      </div>
      <div class="grade-raw-value">${gradeData.displayValue}</div>
    </div>
  `;
}

// ─── DYNAMIC STYLES ─────────────────────────────────────

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    /* ── Section headings ── */
    .section-heading {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--white);
      margin-bottom: var(--space-lg);
    }
    .section-icon {
      width: 20px;
      height: 20px;
      color: var(--victory-green-light);
      flex-shrink: 0;
    }

    /* ── Leader categories ── */
    .rankings-leaders-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-xl);
    }
    .rankings-leader-category {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: var(--space-lg);
    }
    .leader-category-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--victory-green-light);
      margin-bottom: var(--space-md);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .leader-cards-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* ── Individual leader card ── */
    .leader-card {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-sm) var(--space-md);
      border-radius: var(--radius-md);
      transition: background 0.15s;
    }
    .leader-card:hover {
      background: var(--card-bg-hover);
    }
    .leader-card--ours {
      background: rgba(0, 179, 113, 0.08);
      border-left: 3px solid var(--victory-green-light);
    }
    .leader-card--ours:hover {
      background: rgba(0, 179, 113, 0.14);
    }
    .leader-rank {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
      background: rgba(255,255,255,0.05);
      border-radius: 50%;
      flex-shrink: 0;
    }
    .leader-card:nth-child(1) .leader-rank {
      background: rgba(255, 215, 0, 0.15);
      color: #ffd700;
    }
    .leader-card:nth-child(2) .leader-rank {
      background: rgba(192, 192, 192, 0.15);
      color: #c0c0c0;
    }
    .leader-card:nth-child(3) .leader-rank {
      background: rgba(205, 127, 50, 0.15);
      color: #cd7f32;
    }
    .leader-headshot {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      background: #222;
      flex-shrink: 0;
    }
    .leader-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    .leader-name {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--white);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .leader-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .leader-value {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--white);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

    /* ── Grade cards grid ── */
    .rankings-grades-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--space-lg);
    }
    .grade-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: var(--space-lg);
      transition: border-color 0.2s, transform 0.15s;
    }
    .grade-card:hover {
      border-color: var(--victory-green-light);
      transform: translateY(-2px);
    }
    .grade-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-md);
    }
    .grade-attribute {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--white);
    }
    .grade-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 38px;
      height: 30px;
      padding: 0 var(--space-sm);
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .grade-bar-track {
      width: 100%;
      height: 8px;
      background: rgba(255,255,255,0.08);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: var(--space-sm);
    }
    .grade-bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s ease-out;
    }
    .grade-raw-value {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      .rankings-grades-grid {
        grid-template-columns: 1fr;
      }
      .leader-card {
        padding: var(--space-xs) var(--space-sm);
        gap: var(--space-sm);
      }
      .leader-headshot {
        width: 30px;
        height: 30px;
      }
      .leader-name {
        font-size: 0.82rem;
      }
      .leader-value {
        font-size: 0.92rem;
      }
    }
  `;
  document.head.appendChild(style);
}
