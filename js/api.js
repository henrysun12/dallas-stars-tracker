const API_BASE = '/api';
const TEAM_ABBREV = 'DAL';
const CURRENT_SEASON = '20252026';

const cache = new Map();

const CACHE_TTL = {
  roster: 600000,
  standings: 300000,
  schedule: 300000,
  scores: 30000,
  stats: 300000,
  player: 600000,
};

let staleDataCallback = null;

export function onStaleData(cb) {
  staleDataCallback = cb;
}

async function apiFetch(endpoint, ttlCategory = 'standings') {
  const url = `${API_BASE}${endpoint}`;
  const cached = cache.get(url);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL[ttlCategory]) {
    return cached.data;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    cache.set(url, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    if (cached) {
      if (staleDataCallback) staleDataCallback(true);
      return cached.data;
    }
    throw error;
  }
}

export function getName(obj) {
  return obj?.default || obj || '';
}

export async function getStandings() {
  return apiFetch('/v1/standings/now', 'standings');
}

export async function getRoster() {
  return apiFetch(`/v1/roster/${TEAM_ABBREV}/current`, 'roster');
}

export async function getSeasonSchedule() {
  return apiFetch(`/v1/club-schedule-season/${TEAM_ABBREV}/${CURRENT_SEASON}`, 'schedule');
}

export async function getTodayScores() {
  return apiFetch('/v1/score/now', 'scores');
}

export async function getTeamStats() {
  return apiFetch(`/v1/club-stats/${TEAM_ABBREV}/now`, 'stats');
}

export async function getPlayerDetails(playerId) {
  return apiFetch(`/v1/player/${playerId}/landing`, 'player');
}

export async function getBoxScore(gameId) {
  return apiFetch(`/v1/gamecenter/${gameId}/boxscore`, 'stats');
}

export async function getPlayByPlay(gameId) {
  return apiFetch(`/v1/gamecenter/${gameId}/play-by-play`, 'stats');
}

export async function getNHLInjuries() {
  const url = '/espn/apis/site/v2/sports/hockey/nhl/injuries';
  const cached = cache.get(url);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL.roster) {
    return cached.data;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}

export function getTeamInjuries(injuriesData, teamAbbrevs) {
  if (!injuriesData?.injuries) return [];
  const abbrevSet = new Set(Array.isArray(teamAbbrevs) ? teamAbbrevs : [teamAbbrevs]);
  const results = [];
  for (const team of injuriesData.injuries) {
    for (const inj of (team.injuries || [])) {
      const abbrev = inj.athlete?.team?.abbreviation;
      if (abbrevSet.has(abbrev)) {
        results.push({
          name: inj.athlete?.displayName || '',
          position: inj.athlete?.position?.abbreviation || '',
          headshot: inj.athlete?.headshot?.href || '',
          status: inj.status || '',
          type: inj.details?.type || '',
          detail: inj.details?.detail || '',
          side: inj.details?.side || '',
          shortComment: inj.shortComment || '',
          returnDate: inj.details?.returnDate || '',
          team: abbrev,
          statusType: inj.type?.name || '',
        });
      }
    }
  }
  return results;
}

export async function getClubStats(teamAbbrev) {
  return apiFetch(`/v1/club-stats/${teamAbbrev}/now`, 'stats');
}

export async function getTeamSchedule(teamAbbrev, season) {
  return apiFetch(`/v1/club-schedule-season/${teamAbbrev}/${season || CURRENT_SEASON}`, 'schedule');
}
