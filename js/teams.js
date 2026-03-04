export const TEAMS = {
  stars: {
    key: 'stars',
    name: 'Dallas Stars',
    short: 'Stars Tracker',
    abbrev: 'DAL',
    sport: 'nhl',
    league: 'NHL',
    espnSport: 'hockey/nhl',
    espnTeamId: 9,
    color: '#006847',
    colorLight: '#00b371',
    colorDark: '#005538',
    logo: 'img/star-logo.svg',
    useNativeAPI: true,
  },
  cowboys: {
    key: 'cowboys',
    name: 'Dallas Cowboys',
    short: 'Cowboys Tracker',
    abbrev: 'DAL',
    sport: 'nfl',
    league: 'NFL',
    espnSport: 'football/nfl',
    espnTeamId: 6,
    color: '#003594',
    colorLight: '#5b8fd4',
    colorDark: '#002244',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
    useNativeAPI: false,
  },
  mavs: {
    key: 'mavs',
    name: 'Dallas Mavericks',
    short: 'Mavs Tracker',
    abbrev: 'DAL',
    sport: 'nba',
    league: 'NBA',
    espnSport: 'basketball/nba',
    espnTeamId: 6,
    color: '#00538C',
    colorLight: '#4da3d4',
    colorDark: '#002B5E',
    logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    useNativeAPI: false,
  },
  rangers: {
    key: 'rangers',
    name: 'Texas Rangers',
    short: 'Rangers Tracker',
    abbrev: 'TEX',
    sport: 'mlb',
    league: 'MLB',
    espnSport: 'baseball/mlb',
    espnTeamId: 13,
    color: '#003278',
    colorLight: '#5b8fd4',
    colorDark: '#001E4D',
    logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png',
    useNativeAPI: false,
  },
};

let currentTeamKey = localStorage.getItem('selectedTeam') || 'stars';
let changeCallbacks = [];

export function getCurrentTeam() {
  return TEAMS[currentTeamKey] || TEAMS.stars;
}

export function setCurrentTeam(key) {
  if (!TEAMS[key]) return;
  currentTeamKey = key;
  localStorage.setItem('selectedTeam', key);
  applyTeamTheme(TEAMS[key]);
  changeCallbacks.forEach(cb => cb(TEAMS[key]));
}

export function onTeamChange(cb) {
  changeCallbacks.push(cb);
}

export function applyTeamTheme(team) {
  const root = document.documentElement;
  root.style.setProperty('--victory-green', team.color);
  root.style.setProperty('--victory-green-light', team.colorLight);
  root.style.setProperty('--victory-green-dark', team.colorDark);

  const logo = document.getElementById('brand-logo');
  const name = document.getElementById('brand-name');
  if (logo) logo.src = team.logo;
  if (name) name.textContent = team.short;

  document.title = team.short;
}

export function initTeamSelector() {
  applyTeamTheme(getCurrentTeam());

  const btn = document.getElementById('team-selector-btn');
  const dropdown = document.getElementById('team-dropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });

  dropdown.querySelectorAll('.team-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const key = opt.dataset.team;
      dropdown.classList.remove('open');

      dropdown.querySelectorAll('.team-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');

      setCurrentTeam(key);
      location.hash = '';
    });
  });

  // Mark initial active
  dropdown.querySelectorAll('.team-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.team === currentTeamKey);
  });
}
