import { Link } from "react-router";

export default function HelpPage() {
  return (
    <div>
      <Link to="/" style={{ fontSize: "0.85rem" }}>← Back</Link>
      <h1>Help &amp; Glossary</h1>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2>Match Score Columns</h2>
        <p style={{ color: "var(--ink-light)", fontSize: "0.9rem" }}>
          On a matchup page, each character&apos;s score is broken into these parts.
          The team total at the bottom of each table sums the same columns across the squad.
        </p>
        <dl>
          <dt><strong>Base</strong></dt>
          <dd>
            Raw points awarded per event. A hit is 0.12× damage dealt; a kill is 2 points
            (or 7 for a boss); a heal is 0.1× HP restored; passing a save is +1; failing one
            is −0.5. Penalties for going down (KO −3) or dying (death −5) also land here.
          </dd>

          <dt><strong>Role Pts</strong></dt>
          <dd>
            A multiplier on Base for events that match the character&apos;s role. Core role events
            earn an extra <strong>0.75×</strong>; secondary events earn <strong>0.3×</strong>.
            <ul style={{ marginTop: "0.4rem" }}>
              <li><strong>Tank</strong> — core: block, taunt, damage_taken · secondary: save_pass, intimidate</li>
              <li><strong>Healer</strong> — core: heal, buff, buff_proc, revivify · secondary: save_pass, channel</li>
              <li><strong>DPS</strong> — core: hit, kill, crit, sneak_attack, smite, arcane_surge · secondary: multiattack, rage</li>
              <li><strong>Utility</strong> — core: disarm_trap, find_treasure, persuade, deceive · secondary: buff_proc, dispel</li>
            </ul>
            Penalty events (failed saves, KOs, deaths) are excluded from role amplification.
          </dd>

          <dt><strong>Milestone</strong></dt>
          <dd>
            Run-level bonuses and penalties awarded once per matchup based on what happened.
            <ul style={{ marginTop: "0.4rem" }}>
              <li><strong>Flawless Run</strong> (+3 to everyone) — no KOs or deaths in the entire run</li>
              <li><strong>Total Party Wipe</strong> (−10 to everyone) — every character died</li>
              <li><strong>First Blood</strong> (+1) — first character to land a kill</li>
              <li><strong>Boss Killer</strong> (+5) — character who lands the boss kill</li>
              <li><strong>MVP of Run</strong> (+5) — highest pre-milestone scorer on the team</li>
              <li><strong>Clutch Survivor</strong> (+3) — went down (KO) but didn&apos;t die</li>
              <li><strong>Revivify Save</strong> (+3) — brought back a dead ally</li>
            </ul>
          </dd>

          <dt><strong>Total</strong></dt>
          <dd>
            Sum of Base + Role Pts + Milestone, plus a hidden{" "}
            <strong>Specialty Bonus</strong>: <strong>0.25×</strong> Base on events that match
            the character&apos;s specialty (e.g. a Light Cleric earns the bonus on heal events).
            That&apos;s why Total can be a bit higher than the visible columns add up to.
          </dd>
        </dl>
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2>Roles</h2>
        <dl>
          <dt><strong>Tank</strong></dt>
          <dd>Soaks damage. Scores best when absorbing hits, blocking, and taunting threats.</dd>
          <dt><strong>Healer</strong></dt>
          <dd>Keeps the party alive. Scores on heals, buff casts, charge consumption, and revivifies.</dd>
          <dt><strong>DPS</strong></dt>
          <dd>Damage dealer. Scores on hits, crits, kills, sneak attacks, smites, and arcane surges.</dd>
          <dt><strong>Utility</strong></dt>
          <dd>Skill specialist. Scores on disarming traps, finding treasure, social checks, and dispels.</dd>
        </dl>
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2>Specialties &amp; Abilities</h2>
        <p>
          Each character has a class (e.g. Cleric) and a specialty (e.g. Light Domain) that
          determines their flavor and which events earn the 0.25× Specialty Bonus. As characters
          level up, they unlock ability tiers — these are visible on the character card and in
          the &quot;Details&quot; disclosure on roster cards. Click into a character on your team
          page to see their full kit.
        </p>
      </section>

      <section className="card">
        <h2>Scouting</h2>
        <p>
          Before the draft, every character runs a few exhibition dungeons to produce a scouting
          report: average points per game, specialty proc rate, consistency, and a projected value.
          Visibility (full / partial / hidden) is set in your league settings — partial only shows
          average points, hidden suppresses the report entirely.
        </p>
      </section>
    </div>
  );
}
