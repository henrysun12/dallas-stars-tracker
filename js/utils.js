import { getName } from './api.js';

export function formatRecord(w, l, otl) {
  return `${w}-${l}-${otl}`;
}

export function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateLong(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatTime(utcString) {
  const d = new Date(utcString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatCountdown(targetDate) {
  const now = Date.now();
  const diff = targetDate - now;
  if (diff <= 0) return 'Starting soon!';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

export function formatPctg(decimal, decimals = 1) {
  return (decimal * 100).toFixed(decimals) + '%';
}

export function formatSavePctg(decimal) {
  return '.' + (decimal * 1000).toFixed(0);
}

export function formatGAA(value) {
  return Number(value).toFixed(2);
}

export function positionName(code) {
  const map = { C: 'Center', L: 'Left Wing', R: 'Right Wing', D: 'Defenseman', G: 'Goalie' };
  return map[code] || code;
}

export function formatHeight(inches) {
  if (!inches) return '--';
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

export function statLabel(abbr) {
  return `<abbr class="stat-tip" data-tip="${abbr}">${abbr}</abbr>`;
}

export function didDallasWin(game) {
  const dal = game.homeTeam?.abbrev === 'DAL' ? game.homeTeam : game.awayTeam;
  const opp = game.homeTeam?.abbrev === 'DAL' ? game.awayTeam : game.homeTeam;
  return (dal?.score ?? 0) > (opp?.score ?? 0);
}

export function getOpponent(game) {
  const isHome = game.homeTeam?.abbrev === 'DAL';
  const opp = isHome ? game.awayTeam : game.homeTeam;
  return {
    name: getName(opp?.placeName) + ' ' + getName(opp?.commonName || opp?.teamName),
    abbrev: opp?.abbrev || '',
    logo: opp?.logo || '',
    isHome,
  };
}

export function getDallasTeam(game) {
  return game.homeTeam?.abbrev === 'DAL' ? game.homeTeam : game.awayTeam;
}

export function isGameComplete(game) {
  return !!game.gameOutcome || game.gameState === 'FINAL';
}

export function isGameFuture(game) {
  return game.gameState === 'FUT' || (game.gameState === 'OFF' && !game.gameOutcome);
}

export function getGameResult(game) {
  if (!isGameComplete(game)) return null;
  const won = didDallasWin(game);
  if (won) return 'W';
  const lastPeriod = game.gameOutcome?.lastPeriodType;
  if (lastPeriod === 'OT' || lastPeriod === 'SO') return 'OTL';
  return 'L';
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function showLoading(container) {
  container.innerHTML = `
    <div class="skeleton-grid">
      <div class="skeleton-card"><div class="skeleton-line wide"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
      <div class="skeleton-card"><div class="skeleton-line wide"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
      <div class="skeleton-card"><div class="skeleton-line wide"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
      <div class="skeleton-card"><div class="skeleton-line wide"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
    </div>`;
}

export function showError(container, message = 'Unable to load data. The NHL API might be temporarily unavailable.') {
  container.innerHTML = `
    <div class="error-card">
      <p>${message}</p>
      <button onclick="location.reload()">Try Again</button>
    </div>`;
}
