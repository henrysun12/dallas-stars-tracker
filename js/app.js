import { initTooltips } from './tooltips.js';
import { onStaleData } from './api.js';
import { getCurrentTeam, initTeamSelector, onTeamChange } from './teams.js';

// NHL-specific static imports
import { renderDashboard, cleanupDashboard } from './dashboard.js';
import { renderSchedule, cleanupSchedule } from './schedule.js';
import { renderRoster } from './roster.js';
import { renderStandings } from './standings.js';
import { renderGlossary } from './glossary.js';
import { renderHistory } from './history.js';
import { renderScores, cleanupScores } from './scores.js';
import { renderDraft } from './draft.js';
import { renderRankings } from './rankings.js';
import { renderClips } from './clips.js';

const content = document.getElementById('app-content');
const navLinks = document.querySelectorAll('.nav-link');
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');
const staleBanner = document.getElementById('stale-banner');

let currentCleanup = null;

const nhlRoutes = {
  '': { render: renderDashboard, cleanup: cleanupDashboard, nav: '' },
  'schedule': { render: renderSchedule, cleanup: cleanupSchedule, nav: 'schedule' },
  'scores': { render: renderScores, cleanup: cleanupScores, nav: 'scores' },
  'roster': { render: renderRoster, cleanup: null, nav: 'roster' },
  'standings': { render: renderStandings, cleanup: null, nav: 'standings' },
  'glossary': { render: renderGlossary, cleanup: null, nav: 'glossary' },
  'history': { render: renderHistory, cleanup: null, nav: 'history' },
  'draft': { render: renderDraft, cleanup: null, nav: 'draft' },
  'rankings': { render: renderRankings, cleanup: null, nav: 'rankings' },
  'clips': { render: renderClips, cleanup: null, nav: 'clips' },
};

// ESPN modules loaded lazily on first non-NHL team switch
let _espn = null;
async function loadEspnModules() {
  if (_espn) return _espn;
  const [d, sc, ro, st, gl, hi] = await Promise.all([
    import('./espn-dashboard.js'),
    import('./espn-schedule.js'),
    import('./espn-roster.js'),
    import('./espn-standings.js'),
    import('./sport-glossary.js'),
    import('./sport-history.js'),
  ]);
  _espn = { d, sc, ro, st, gl, hi };
  return _espn;
}

async function getEspnRoutes() {
  const m = await loadEspnModules();
  return {
    '': { render: m.d.renderEspnDashboard, cleanup: m.d.cleanupEspnDashboard, nav: '' },
    'schedule': { render: m.sc.renderEspnSchedule, cleanup: null, nav: 'schedule' },
    'scores': { render: renderScores, cleanup: cleanupScores, nav: 'scores' },
    'roster': { render: m.ro.renderEspnRoster, cleanup: null, nav: 'roster' },
    'standings': { render: m.st.renderEspnStandings, cleanup: null, nav: 'standings' },
    'glossary': { render: m.gl.renderSportGlossary, cleanup: null, nav: 'glossary' },
    'history': { render: m.hi.renderSportHistory, cleanup: null, nav: 'history' },
    'draft': { render: renderDraft, cleanup: null, nav: 'draft' },
    'rankings': { render: renderRankings, cleanup: null, nav: 'rankings' },
    'clips': { render: renderClips, cleanup: null, nav: 'clips' },
  };
}

function getRoute() {
  const hash = location.hash.replace('#', '');
  const parts = hash.split('/');
  return { key: parts[0], param: parts[1] || null };
}

async function navigate() {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const { key, param } = getRoute();
  const team = getCurrentTeam();
  const routes = team.useNativeAPI ? nhlRoutes : await getEspnRoutes();
  const route = routes[key];

  // Close mobile nav
  mainNav.classList.remove('nav-open');
  navToggle.setAttribute('aria-expanded', 'false');

  // Update active nav link
  const navKey = route ? route.nav : key;
  navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.route === navKey);
  });

  content.classList.remove('page-enter');
  void content.offsetWidth;
  content.classList.add('page-enter');

  if (route) {
    await route.render(content, param);
    if (route.cleanup) currentCleanup = route.cleanup;
  } else if (key === 'game' && param) {
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.route === 'schedule'));
    // NHL game IDs start with year (2024/2025), ESPN IDs start with 4
    if (team.useNativeAPI && param.startsWith('20')) {
      const { renderGameDetail } = await import('./game.js');
      await renderGameDetail(content, param);
    } else {
      const { renderEspnGame } = await import('./espn-game.js');
      await renderEspnGame(content, param);
    }
  } else if (key === 'matchup' && param) {
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.route === 'schedule'));
    if (team.useNativeAPI && param.startsWith('20')) {
      const { renderMatchupPreview } = await import('./matchup.js');
      await renderMatchupPreview(content, param);
    } else {
      const { renderEspnMatchup } = await import('./espn-matchup.js');
      await renderEspnMatchup(content, param);
    }
  } else if (key === 'live' && param) {
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.route === 'schedule'));
    // NHL game IDs start with year (2024/2025), ESPN IDs start with 4
    if (team.useNativeAPI && param.startsWith('20')) {
      const { renderNHLLive } = await import('./nhl-live.js');
      await renderNHLLive(content, param);
    } else {
      const { renderEspnGame } = await import('./espn-game.js');
      await renderEspnGame(content, param, true);
    }
  } else if (key.startsWith('player')) {
    if (team.useNativeAPI) {
      const { renderPlayerDetail } = await import('./roster.js');
      await renderPlayerDetail(content, param || key.split('/')[1]);
    }
  } else {
    content.innerHTML = '<div class="error-card"><p>Page not found.</p><a href="#">Go to Dashboard</a></div>';
  }

  content.focus({ preventScroll: true });
}

document.addEventListener('DOMContentLoaded', () => {
  initTooltips();
  initTeamSelector();

  onStaleData((isStale) => {
    if (staleBanner) staleBanner.hidden = !isStale;
  });

  navToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  onTeamChange(() => {
    navigate();
  });

  window.addEventListener('hashchange', navigate);
  navigate();
});
