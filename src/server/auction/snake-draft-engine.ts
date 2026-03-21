import type {
  AuctionPlayer,
  AuctionSettings,
  Player,
  Team,
  TeamRosterEntry,
} from "@prisma/client";

import { validateRosterPick } from "@/server/auction/rules";

type TeamSpendSummary = {
  teamId: string;
  teamName: string;
  spend: number;
  reachedAt: Date;
};

export type SnakeDraftOrderRow = {
  teamId: string;
  cycleNumber: number;
  slotIndex: number;
  reversed: boolean;
};

export type AuctionOrderTeam = Pick<Team, "id" | "name" | "shortCode">;

export function shuffleTeamOrder<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function getSnakeDraftCycleNumber(
  totalSnakePicksCompleted: number,
  teamsInAuction: number,
) {
  return Math.floor(totalSnakePicksCompleted / teamsInAuction) + 1;
}

export function buildSnakeDraftInitialOrder(
  teams: Pick<Team, "id" | "name">[],
  biddingEntries: Array<Pick<TeamRosterEntry, "teamId" | "amount" | "createdAt">>,
) {
  const summary = new Map<string, TeamSpendSummary>();

  for (const team of teams) {
    summary.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      spend: 0,
      reachedAt: new Date(0),
    });
  }

  for (const entry of biddingEntries) {
    const team = summary.get(entry.teamId);

    if (!team) {
      continue;
    }

    team.spend += entry.amount;
    team.reachedAt = entry.createdAt;
  }

  return [...summary.values()]
    .sort((left, right) => {
      if (right.spend !== left.spend) {
        return right.spend - left.spend;
      }

      return left.reachedAt.getTime() - right.reachedAt.getTime();
    })
    .map((row) => row.teamId);
}

export function getBiddingNominationTurn(
  baseOrder: string[],
  completedBiddingAssignments: number,
  teamsInAuction: number,
) {
  return getSnakeDraftTurn(baseOrder, completedBiddingAssignments, teamsInAuction);
}

export function getNextEligibleBiddingNominationTurn(
  baseOrder: string[],
  completedBiddingAssignments: number,
  teamsInAuction: number,
  biddingWinsByTeam: Map<string, number>,
  maxBiddingWins: number,
) {
  const maxOffsetsToInspect = Math.max(teamsInAuction * 2, teamsInAuction);

  // Snake order can repeat the same team at cycle boundaries (for example with
  // two teams: A, B, B, A, A, B ...). We therefore scan beyond a single
  // cycle so a maxed-out team at the boundary does not hide the next eligible
  // nominating team.
  for (let offset = 0; offset < maxOffsetsToInspect; offset += 1) {
    const candidate = getBiddingNominationTurn(
      baseOrder,
      completedBiddingAssignments + offset,
      teamsInAuction,
    );
    const biddingWins = biddingWinsByTeam.get(candidate.teamId) ?? 0;

    if (biddingWins < maxBiddingWins) {
      return candidate;
    }
  }

  return null;
}

export function getSnakeDraftTurn(
  initialOrder: string[],
  totalSnakePicksCompleted: number,
  teamsInAuction: number,
): SnakeDraftOrderRow {
  const cycleNumber = getSnakeDraftCycleNumber(
    totalSnakePicksCompleted,
    teamsInAuction,
  );
  const slotIndex = totalSnakePicksCompleted % teamsInAuction;
  const reversed = cycleNumber % 2 === 0;

  return {
    teamId: reversed
      ? initialOrder[initialOrder.length - 1 - slotIndex]
      : initialOrder[slotIndex],
    cycleNumber,
    slotIndex,
    reversed,
  };
}

export function findHighestRankedValidAutoPick(
  settings: AuctionSettings,
  rosterEntries: Array<TeamRosterEntry & { player: Pick<Player, "role"> }>,
  availablePlayers: Array<AuctionPlayer & { player: Player }>,
) {
  for (const availablePlayer of availablePlayers) {
    const validity = validateRosterPick(
      settings,
      rosterEntries,
      availablePlayer.player.role,
    );

    if (validity.valid) {
      return {
        playerId: availablePlayer.playerId,
        reason: null,
      };
    }
  }

  // If no valid player exists, the draft is boxed into an impossible roster state
  // and the engine must hand control back to admin instead of violating constraints.
  return {
    playerId: null,
    reason: "Snake auto-pick could not find a roster-valid available player.",
  };
}
