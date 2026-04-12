interface Team {
  id: string;
  name: string;
  managerType: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export function StandingsTable({ teams, leagueId }: { teams: Team[]; leagueId: string }) {
  const sorted = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>W</th>
          <th>L</th>
          <th>PF</th>
          <th>PA</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((team, i) => (
          <tr key={team.id}>
            <td>{i + 1}</td>
            <td>
              <a href={`/leagues/${leagueId}/teams/${team.id}`}>
                {team.name}
                {team.managerType === "human" ? " (You)" : ""}
              </a>
            </td>
            <td>{team.wins}</td>
            <td>{team.losses}</td>
            <td>{team.pointsFor.toFixed(1)}</td>
            <td>{team.pointsAgainst.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
