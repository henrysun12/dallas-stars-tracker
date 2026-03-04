const ESPN_BASE = '/espn';
const cache = new Map();

async function espnFetch(path, ttl = 300000) {
  const url = `${ESPN_BASE}${path}`;
  const cached = cache.get(url);
  if (cached && (Date.now() - cached.ts) < ttl) return cached.data;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ESPN ${resp.status}`);
  const data = await resp.json();
  cache.set(url, { data, ts: Date.now() });
  return data;
}

export function getTeamInfo(team) {
  return espnFetch(`/apis/site/v2/sports/${team.espnSport}/teams/${team.espnTeamId}`);
}

export function getTeamSchedule(team) {
  return espnFetch(`/apis/site/v2/sports/${team.espnSport}/teams/${team.espnTeamId}/schedule`);
}

export function getTeamRoster(team) {
  return espnFetch(`/apis/site/v2/sports/${team.espnSport}/teams/${team.espnTeamId}/roster`, 600000);
}

export function getStandings(team) {
  return espnFetch(`/apis/v2/sports/${team.espnSport}/standings`);
}

export function getInjuries(team) {
  return espnFetch(`/apis/site/v2/sports/${team.espnSport}/injuries`, 600000);
}

export function getGameSummary(team, eventId) {
  return espnFetch(`/apis/site/v2/sports/${team.espnSport}/summary?event=${eventId}`, 15000);
}

export function getScoreboard(team, date) {
  const dateStr = date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return espnFetch(`/apis/site/v2/sports/${team.espnSport}/scoreboard?dates=${dateStr}`, 30000);
}

// ─── HELPERS ─────────────────────────────────────────

export function getTeamInjuries(injData, teamAbbrev) {
  if (!injData?.injuries) return [];
  const results = [];
  for (const team of injData.injuries) {
    for (const inj of (team.injuries || [])) {
      if (inj.athlete?.team?.abbreviation === teamAbbrev) {
        results.push({
          name: inj.athlete?.displayName || '',
          position: inj.athlete?.position?.abbreviation || '',
          headshot: inj.athlete?.headshot?.href || '',
          status: inj.status || '',
          type: inj.details?.type || '',
          detail: inj.details?.detail || '',
          shortComment: inj.shortComment || '',
          statusType: inj.type?.name || '',
        });
      }
    }
  }
  return results;
}

export function findOurTeam(competitors, teamId) {
  return competitors?.find(c => String(c.team?.id) === String(teamId));
}

export function findOppTeam(competitors, teamId) {
  return competitors?.find(c => String(c.team?.id) !== String(teamId));
}

export function getCompScore(comp) {
  return comp?.score?.displayValue || comp?.score?.value || '0';
}

export function getEventState(event) {
  return event?.competitions?.[0]?.status?.type?.state || 'pre';
}

export function getEventStatus(event) {
  return event?.competitions?.[0]?.status?.type?.detail || '';
}

export function didWeWin(event, teamId) {
  const us = findOurTeam(event?.competitions?.[0]?.competitors, teamId);
  return us?.winner === true;
}

export function formatEspnDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatEspnTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function getStatValue(stats, name) {
  const s = stats?.find(st => st.name === name);
  return s?.displayValue ?? s?.value ?? null;
}
