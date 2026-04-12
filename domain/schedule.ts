export interface ScheduleMatchup {
  home: string;
  away: string;
}

export function generateRegularSeason(teamIds: string[]): ScheduleMatchup[][] {
  const n = teamIds.length;
  const rounds: ScheduleMatchup[][] = [];

  const teams = [...teamIds];
  if (n % 2 !== 0) teams.push("BYE");
  const count = teams.length;
  const fixed = teams[0];
  const rotating = teams.slice(1);

  for (let round = 0; round < count - 1; round++) {
    const week: ScheduleMatchup[] = [];
    const current = [fixed, ...rotating];

    for (let i = 0; i < count / 2; i++) {
      const home = current[i];
      const away = current[count - 1 - i];
      if (home !== "BYE" && away !== "BYE") {
        week.push({ home, away });
      }
    }

    rounds.push(week);
    rotating.push(rotating.shift()!);
  }

  return rounds;
}

export function generatePlayoffMatchups(
  rankedTeamIds: string[],
  round: "semifinal" | "final",
): ScheduleMatchup[] {
  if (round === "final") {
    return [{ home: rankedTeamIds[0], away: rankedTeamIds[1] }];
  }

  const top4 = rankedTeamIds.slice(0, 4);
  return [
    { home: top4[0], away: top4[3] },
    { home: top4[1], away: top4[2] },
  ];
}
