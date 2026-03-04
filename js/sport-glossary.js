import { getCurrentTeam } from './teams.js';
import { debounce } from './utils.js';

const GLOSSARIES = {
  nfl: [
    { term: 'Touchdown (TD)', def: 'Scoring play worth 6 points, achieved by carrying or catching the ball in the opponent\'s end zone.' },
    { term: 'Field Goal (FG)', def: 'A kick through the uprights worth 3 points, usually attempted on 4th down.' },
    { term: 'Extra Point (PAT)', def: 'A kick after a touchdown worth 1 point, or a 2-point conversion attempt from the 2-yard line.' },
    { term: 'First Down', def: 'The offense gets 4 attempts (downs) to advance 10 yards. Gaining 10 yards resets to 1st down.' },
    { term: 'Sack', def: 'When a defensive player tackles the quarterback behind the line of scrimmage.' },
    { term: 'Interception (INT)', def: 'A pass caught by a defensive player instead of the intended receiver.' },
    { term: 'Fumble', def: 'When a player carrying the ball drops it. Either team can recover it.' },
    { term: 'Punt', def: 'Kicking the ball to the other team, usually on 4th down when too far to attempt a field goal.' },
    { term: 'Red Zone', def: 'The area inside the opponent\'s 20-yard line. Scoring efficiency here is a key stat.' },
    { term: 'Blitz', def: 'When extra defensive players rush the quarterback beyond the normal pass rush.' },
    { term: 'Yards After Catch (YAC)', def: 'Yards gained by a receiver after catching the ball.' },
    { term: 'Passer Rating (QBR)', def: 'A formula-based rating of quarterback performance (scale 0-158.3 for traditional, 0-100 for ESPN QBR).' },
    { term: 'Offensive Line', def: 'The 5 players who block for the quarterback and running backs: Center, Guards, and Tackles.' },
    { term: 'Snap', def: 'The center hiking the ball to the quarterback to start a play.' },
    { term: 'Play Action', def: 'A fake handoff to the running back before throwing a pass, designed to fool the defense.' },
    { term: 'Two-Minute Warning', def: 'An automatic timeout at the 2-minute mark of each half. The clock stops.' },
    { term: 'Salary Cap', def: 'A league-wide limit on what each team can spend on player salaries, promoting competitive balance.' },
    { term: 'Franchise Tag', def: 'A team can designate one player, guaranteeing a high salary to keep them for one more year.' },
    { term: 'Draft Pick', def: 'Teams select college players in the annual NFL Draft. Worst teams pick first to promote parity.' },
    { term: 'Wild Card', def: 'The top non-division-winning teams in each conference that make the playoffs (3 per conference).' },
  ],
  nba: [
    { term: 'Three-Pointer (3PT)', def: 'A shot made from beyond the three-point arc, worth 3 points instead of 2.' },
    { term: 'Free Throw (FT)', def: 'Uncontested shots from the free-throw line, worth 1 point each. Awarded after certain fouls.' },
    { term: 'Rebound (REB)', def: 'Grabbing the ball after a missed shot. Offensive rebounds give your team another chance; defensive rebounds end the opponent\'s possession.' },
    { term: 'Assist (AST)', def: 'A pass that directly leads to a made basket by a teammate.' },
    { term: 'Steal (STL)', def: 'Taking the ball away from an opponent through a deflection or interception.' },
    { term: 'Block (BLK)', def: 'Deflecting an opponent\'s shot attempt. Must be on the way up, not on the way down.' },
    { term: 'Turnover (TO)', def: 'Losing possession of the ball to the other team (bad pass, steal, out of bounds, etc.).' },
    { term: 'Double-Double', def: 'Recording 10+ in two statistical categories (e.g., 20 points and 12 rebounds).' },
    { term: 'Triple-Double', def: 'Recording 10+ in three statistical categories. A rare and impressive feat.' },
    { term: 'Pick and Roll', def: 'An offensive play where a player sets a screen (pick) for the ball handler then rolls to the basket.' },
    { term: 'Fast Break', def: 'A quick offensive attack before the defense can set up, often after a steal or rebound.' },
    { term: 'Flagrant Foul', def: 'An excessive or unnecessary contact foul. Results in free throws and possession.' },
    { term: 'Technical Foul', def: 'A foul for unsportsmanlike conduct (arguing, taunting). Results in a free throw for the opponent.' },
    { term: 'Player Efficiency Rating (PER)', def: 'An all-in-one stat measuring a player\'s overall contribution. League average is 15.' },
    { term: 'True Shooting % (TS%)', def: 'A shooting efficiency stat that accounts for 2-pointers, 3-pointers, and free throws.' },
    { term: 'Plus/Minus (+/-)', def: 'The point differential when a player is on the court. Positive means the team outscored opponents.' },
    { term: 'Salary Cap', def: 'A limit on total team payroll. Teams over the "luxury tax" threshold pay a penalty.' },
    { term: 'Lottery', def: 'The draft lottery determines pick order for the 14 non-playoff teams. Worst record has best odds for #1.' },
    { term: 'Play-In Tournament', def: 'The 7th-10th seeds in each conference play for the final two playoff spots.' },
  ],
  mlb: [
    { term: 'Earned Run Average (ERA)', def: 'Average runs a pitcher allows per 9 innings, excluding errors. Lower is better. Under 3.00 is elite.' },
    { term: 'Batting Average (AVG)', def: 'Hits divided by at-bats. .300+ is excellent. The league average is around .250.' },
    { term: 'On-Base Percentage (OBP)', def: 'How often a batter reaches base (hits + walks + hit-by-pitch). .350+ is very good.' },
    { term: 'Slugging Percentage (SLG)', def: 'Total bases divided by at-bats. Measures power hitting. .500+ is excellent.' },
    { term: 'OPS', def: 'On-base Plus Slugging. A combined measure of getting on base and hitting for power. .900+ is elite.' },
    { term: 'WAR', def: 'Wins Above Replacement. Estimates how many wins a player adds over a replacement-level player. 5+ is All-Star level.' },
    { term: 'Strikeout (K)', def: 'When a batter gets 3 strikes. For pitchers, more Ks are good. A backward K means called third strike.' },
    { term: 'Walk (BB)', def: 'A batter reaches first base after 4 balls (pitches outside the strike zone).' },
    { term: 'RBI', def: 'Runs Batted In. Credited when a batter\'s action causes a run to score.' },
    { term: 'Home Run (HR)', def: 'Hitting the ball over the outfield fence in fair territory. All runners score.' },
    { term: 'Double Play', def: 'The defense records two outs on a single play, often a ground ball turned 6-4-3 (SS to 2B to 1B).' },
    { term: 'Bullpen', def: 'The group of relief pitchers on a team, and the area where they warm up.' },
    { term: 'Closer', def: 'A relief pitcher who specializes in getting the final outs to preserve a lead (gets the "save").' },
    { term: 'Save (SV)', def: 'Credited to a relief pitcher who finishes a close game while protecting the lead.' },
    { term: 'WHIP', def: 'Walks + Hits per Inning Pitched. Measures how many baserunners a pitcher allows. Under 1.10 is excellent.' },
    { term: 'DH (Designated Hitter)', def: 'A player who bats in place of the pitcher but doesn\'t play in the field.' },
    { term: 'Balk', def: 'An illegal motion by the pitcher that deceives baserunners. All runners advance one base.' },
    { term: 'Wild Card', def: 'The top non-division-winning teams that make the playoffs. MLB expanded to 3 wild cards per league.' },
    { term: 'Magic Number', def: 'The combination of wins by your team and losses by the trailing team needed to clinch a playoff spot.' },
  ],
};

export function renderSportGlossary(container) {
  const team = getCurrentTeam();
  const sport = team.sport;
  const terms = GLOSSARIES[sport] || [];
  const leagueName = team.league;

  if (!terms.length) {
    container.innerHTML = `<h2>${leagueName} Glossary</h2><p style="color:var(--text-secondary)">No glossary available for this sport yet.</p>`;
    return;
  }

  let searchTerm = '';

  function render() {
    const filtered = searchTerm
      ? terms.filter(t => t.term.toLowerCase().includes(searchTerm) || t.def.toLowerCase().includes(searchTerm))
      : terms;

    const termHtml = filtered.map(t => `
      <div class="glossary-term">
        <span class="term-name">${t.term}</span>
        <div class="term-def">${t.def}</div>
      </div>`).join('');

    container.innerHTML = `
      <h2>${leagueName} Glossary</h2>
      <p style="color:var(--text-secondary);margin-bottom:var(--space-md);font-size:0.9rem">Key terms and stats explained for ${leagueName} newcomers.</p>
      <input type="text" class="glossary-search" placeholder="Search terms..." id="glossary-search" value="${searchTerm}">
      <div>${termHtml || '<p style="color:var(--text-muted);padding:var(--space-lg)">No matching terms</p>'}</div>
    `;

    const input = container.querySelector('#glossary-search');
    input?.addEventListener('input', debounce(e => {
      searchTerm = e.target.value.toLowerCase();
      render();
    }, 200));
    input?.focus();
  }

  render();
}
