const TOOLTIP_DEFS = {
  'GP': 'Games Played \u2014 total games this season',
  'G': 'Goals \u2014 total goals scored',
  'A': 'Assists \u2014 passes leading directly to a goal',
  'PTS': 'Points \u2014 Goals + Assists combined',
  '+/-': 'Plus/Minus \u2014 on-ice goal differential at even strength',
  'PIM': 'Penalty Minutes \u2014 time spent in the penalty box',
  'PPG': 'Power Play Goals \u2014 scored with a man advantage',
  'SHG': 'Shorthanded Goals \u2014 scored while a player down',
  'SOG': 'Shots on Goal \u2014 shots that required a save',
  'SH%': 'Shooting % \u2014 goals divided by shots on goal',
  'TOI': 'Time on Ice \u2014 average minutes per game',
  'FO%': 'Face-off Win % \u2014 percentage of face-offs won',
  'W': 'Wins',
  'L': 'Losses (regulation only)',
  'OTL': 'Overtime Losses \u2014 lost in OT/SO, still earns 1 point',
  'GAA': 'Goals Against Avg \u2014 goals allowed per 60 min, lower is better',
  'SV%': 'Save Percentage \u2014 .920+ is excellent',
  'SO': 'Shutouts \u2014 games with zero goals allowed',
  'SV': 'Saves \u2014 total shots stopped',
  'GS': 'Games Started',
  'PP': 'Power Play \u2014 team has extra player from opponent penalty',
  'PK': 'Penalty Kill \u2014 playing shorthanded due to own penalty',
  'PP%': 'Power Play % \u2014 how often the team scores on power plays',
  'PK%': 'Penalty Kill % \u2014 how often the team prevents PP goals',
  'GF': 'Goals For \u2014 total goals scored by the team',
  'GA': 'Goals Against \u2014 total goals allowed',
  'DIFF': 'Goal Differential \u2014 GF minus GA',
  'PTS%': 'Points % \u2014 points earned / max possible points',
  'L10': 'Record in last 10 games',
  'STK': 'Current win/loss streak',
  'OT': 'Overtime \u2014 5-min sudden death after a tie',
  'EN': 'Empty Net \u2014 goalie pulled for extra skater',
  'GWG': 'Game-Winning Goal',
  'ROW': 'Regulation + Overtime Wins (excludes shootout wins)',
  'P': 'Period',
};

const tooltipEl = document.getElementById('tooltip');
let activeTarget = null;

function showTooltip(target) {
  const key = target.dataset.tip;
  const text = TOOLTIP_DEFS[key];
  if (!text) return;

  activeTarget = target;
  tooltipEl.textContent = text;
  tooltipEl.classList.add('visible');
  tooltipEl.setAttribute('aria-hidden', 'false');
  positionTooltip(target);
}

function hideTooltip() {
  activeTarget = null;
  tooltipEl.classList.remove('visible');
  tooltipEl.setAttribute('aria-hidden', 'true');
}

function positionTooltip(target) {
  const rect = target.getBoundingClientRect();
  const tipRect = tooltipEl.getBoundingClientRect();

  let top = rect.top - tipRect.height - 8;
  let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

  if (top < 4) top = rect.bottom + 8;
  if (left < 4) left = 4;
  if (left + tipRect.width > window.innerWidth - 4) {
    left = window.innerWidth - tipRect.width - 4;
  }

  tooltipEl.style.top = top + 'px';
  tooltipEl.style.left = left + 'px';
}

export function initTooltips() {
  document.body.addEventListener('mouseenter', (e) => {
    const tip = e.target.closest('.stat-tip');
    if (tip) showTooltip(tip);
  }, true);

  document.body.addEventListener('mouseleave', (e) => {
    const tip = e.target.closest('.stat-tip');
    if (tip && tip === activeTarget) hideTooltip();
  }, true);

  document.body.addEventListener('touchstart', (e) => {
    const tip = e.target.closest('.stat-tip');
    if (tip) {
      e.preventDefault();
      if (activeTarget === tip) {
        hideTooltip();
      } else {
        showTooltip(tip);
      }
    } else if (activeTarget) {
      hideTooltip();
    }
  }, { passive: false });
}
