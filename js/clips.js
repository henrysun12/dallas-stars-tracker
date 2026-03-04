import { getCurrentTeam } from './teams.js';
import { getTeamSchedule, getGameSummary, formatEspnDate } from './espn-api.js';
import { showLoading, showError } from './utils.js';

// ─── HELPERS ─────────────────────────────────────────

/**
 * Format seconds into m:ss display string.
 */
function formatDuration(secs) {
  if (!secs || secs <= 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Extract completed (post-game) events from a schedule, most recent first.
 * Returns at most `limit` events.
 */
function getRecentCompletedEvents(events, limit = 8) {
  const completed = (events || [])
    .filter(e => {
      const state = e.competitions?.[0]?.status?.type?.state;
      return state === 'post';
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return completed.slice(0, limit);
}

/**
 * Fetch game summaries in parallel with a concurrency limit.
 * Failures are silently skipped and logged to console.
 */
async function fetchSummariesWithLimit(team, eventIds, concurrency = 5) {
  const results = [];
  const queue = [...eventIds];

  async function worker() {
    while (queue.length > 0) {
      const eventId = queue.shift();
      try {
        const summary = await getGameSummary(team, eventId);
        results.push({ eventId, summary });
      } catch (err) {
        console.warn(`Failed to fetch summary for event ${eventId}:`, err);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Extract video objects from a game summary response.
 * Each returned video is enriched with game context (teams, date, eventId).
 */
function extractVideos(summary, eventId) {
  const videos = summary?.videos || [];
  if (!videos.length) return [];

  // Pull game context from the summary header
  const comp = summary?.header?.competitions?.[0];
  const competitors = comp?.competitors || [];
  const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[0];
  const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[1];
  const awayAbbr = awayComp?.team?.abbreviation || '';
  const homeAbbr = homeComp?.team?.abbreviation || '';
  const gameDate = comp?.date || '';

  return videos.map(v => ({
    headline: v.headline || v.title || v.description || 'Highlight',
    description: v.description || '',
    duration: v.duration || 0,
    thumbnail: v.thumbnail || v.posterImages?.[0]?.href || '',
    videoUrl: v.links?.source?.mezzanine?.href || v.links?.source?.HD?.href || v.links?.source?.href || '',
    webUrl: v.links?.web?.href || '',
    awayAbbr,
    homeAbbr,
    gameDate,
    eventId,
  }));
}

/**
 * Build a play-button SVG overlay for thumbnails.
 */
function playButtonSvg() {
  return `<svg class="clip-play-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.8)" stroke-width="2"/>
    <polygon points="26,20 26,44 46,32" fill="rgba(255,255,255,0.9)"/>
  </svg>`;
}

/**
 * Build a fallback gradient thumbnail when no image is available.
 */
function fallbackThumbnailStyle() {
  return 'background:linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%);';
}

// ─── RENDER ──────────────────────────────────────────

export async function renderClips(container) {
  const team = getCurrentTeam();
  showLoading(container);

  try {
    // 1. Fetch team schedule
    const schedData = await getTeamSchedule(team);
    const events = schedData.events || [];

    // 2. Find recent completed games
    const recentGames = getRecentCompletedEvents(events, 8);

    if (!recentGames.length) {
      renderEmpty(container, team);
      return;
    }

    // 3. Fetch game summaries in parallel (max 5 concurrent)
    const eventIds = recentGames.map(e => e.id);
    const summaries = await fetchSummariesWithLimit(team, eventIds, 5);

    // 4. Extract all videos, preserving game order (most recent first)
    const allVideos = [];
    for (const { eventId, summary } of summaries) {
      const vids = extractVideos(summary, eventId);
      allVideos.push(...vids);
    }

    // Filter out videos with no playable URL
    const playableVideos = allVideos.filter(v => v.videoUrl);

    if (!playableVideos.length) {
      renderEmpty(container, team);
      return;
    }

    // 5. Render the page
    renderPage(container, team, playableVideos);
  } catch (err) {
    console.error('Clips error:', err);
    showError(container, 'Unable to load video highlights. Please try again later.');
  }
}

function renderEmpty(container, team) {
  container.innerHTML = `
    <div class="clips-page">
      <h2>Video Highlights</h2>
      <div class="error-card">
        <p>No recent highlights available for ${team.name}.</p>
        <a href="#schedule">View Schedule</a>
      </div>
    </div>`;
}

function renderPage(container, team, videos) {
  const cards = videos.map((v, i) => buildVideoCard(v, i)).join('');

  container.innerHTML = `
    <div class="clips-page">
      <h2>Video Highlights</h2>
      <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);margin-top:calc(-1 * var(--space-sm))">
        Recent game highlights for ${team.name}
      </p>
      <div class="clips-grid">
        ${cards}
      </div>
    </div>`;

  // Attach click handlers for inline video playback
  wireVideoCards(container);
}

function buildVideoCard(video, index) {
  const thumbnailContent = video.thumbnail
    ? `<img src="${video.thumbnail}" alt="${escapeHtml(video.headline)}" loading="lazy">`
    : `<div class="clip-thumbnail-fallback" style="${fallbackThumbnailStyle()}"></div>`;

  const gameContext = video.awayAbbr && video.homeAbbr
    ? `${video.awayAbbr} @ ${video.homeAbbr}`
    : '';

  const dateStr = video.gameDate ? formatEspnDate(video.gameDate) : '';
  const metaParts = [gameContext, dateStr].filter(Boolean).join(' &middot; ');

  const proxyUrl = `/video-proxy?url=${encodeURIComponent(video.videoUrl)}`;

  return `
    <div class="clip-card" data-video-url="${escapeAttr(proxyUrl)}" data-headline="${escapeAttr(video.headline)}" data-index="${index}">
      <div class="clip-thumbnail">
        ${thumbnailContent}
        <div class="clip-play-overlay">
          ${playButtonSvg()}
        </div>
        ${video.duration > 0 ? `<span class="clip-duration">${formatDuration(video.duration)}</span>` : ''}
      </div>
      <div class="clip-info">
        <div class="clip-headline">${escapeHtml(video.headline)}</div>
        ${metaParts ? `<div class="clip-meta">${metaParts}</div>` : ''}
      </div>
    </div>`;
}

function wireVideoCards(container) {
  container.querySelectorAll('.clip-card[data-video-url]').forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('clip-playing')) return;
      const url = card.dataset.videoUrl;
      const headline = card.dataset.headline || '';
      card.classList.add('clip-playing');
      card.innerHTML = `
        <video controls autoplay playsinline style="width:100%;display:block;border-radius:var(--radius-md) var(--radius-md) 0 0">
          <source src="${escapeAttr(url)}" type="video/mp4">
        </video>
        <div class="clip-info"><div class="clip-headline">${escapeHtml(headline)}</div></div>`;
      const videoEl = card.querySelector('video');
      if (videoEl) {
        videoEl.addEventListener('error', () => {
          card.innerHTML = `
            <div class="clip-info" style="padding:var(--space-lg);text-align:center">
              <div class="clip-headline" style="color:var(--text-muted)">Video unavailable</div>
              <div class="clip-meta">${escapeHtml(headline)}</div>
            </div>`;
        });
      }
    });
  });
}

// ─── ESCAPE UTILITIES ────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
