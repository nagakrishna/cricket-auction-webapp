"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ActivityFeed } from "@/components/auction/activity-feed";
import { AuctionLayout } from "@/components/auction/auction-layout";
import { BiddingPanel } from "@/components/auction/bidding-panel";
import { ConfettiOverlay } from "@/components/auction/confetti-overlay";
import { LeaderboardPanel } from "@/components/auction/leaderboard-panel";
import { PlayerPool } from "@/components/auction/player-pool";
import { TeamPicksBoard } from "@/components/auction/team-picks-board";
import { OrderBoard } from "@/components/auction/order-board";
import { useAuctionSoundEffects } from "@/components/auction/use-auction-sound-effects";
import { TeamSummary } from "@/components/auction/team-summary";
import { useAuctionLiveState } from "@/components/auction/use-auction-live-state";
import type { AuctionSnapshot } from "@/lib/realtime/events";

type AuctionRoomProps = {
  initialSnapshot: AuctionSnapshot;
  ownerTeamId: string;
  focus: "auction" | "snake";
};

export function AuctionRoom({
  initialSnapshot,
  ownerTeamId,
  focus,
}: AuctionRoomProps) {
  const {
    snapshot,
    countdown,
    countdownSeconds,
    connectionState,
    currentTurnTeam,
    refreshSnapshot,
  } =
    useAuctionLiveState(initialSnapshot);
  const { soundEnabled, toggleSound } = useAuctionSoundEffects(
    snapshot,
    ownerTeamId,
    countdownSeconds,
  );
  const liveActionsEnabled = snapshot.status === "LIVE";
  const [bidAmount, setBidAmount] = useState(
    initialSnapshot.highestBid
      ? initialSnapshot.highestBid + 1
      : initialSnapshot.settings.startingBidAmount + 1,
  );
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showAllRosters, setShowAllRosters] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showConfetti, setShowConfetti] = useState(initialSnapshot.phase === "COMPLETE");
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);

  const team = useMemo(
    () => snapshot.leaderboard.find((entry) => entry.teamId === ownerTeamId),
    [ownerTeamId, snapshot.leaderboard],
  );
  const previousOwnerTeamStatsRef = useRef({
    players: initialSnapshot.leaderboard.find((entry) => entry.teamId === ownerTeamId)?.players ?? 0,
    biddingWins: initialSnapshot.leaderboard.find((entry) => entry.teamId === ownerTeamId)?.biddingWins ?? 0,
  });
  const highestBidTeam = useMemo(
    () =>
      snapshot.highestBidTeamId
        ? snapshot.leaderboard.find((entry) => entry.teamId === snapshot.highestBidTeamId) ?? null
        : null,
    [snapshot.highestBidTeamId, snapshot.leaderboard],
  );
  const isWinningBidTeam = snapshot.highestBidTeamId === ownerTeamId;
  const isYourTurn = snapshot.currentTurnTeamId === ownerTeamId;
  const isNominationTurn = snapshot.turnType === "BIDDING_NOMINATION";
  const hasPassed = snapshot.passedTeams.some((entry) => entry.teamId === ownerTeamId);
  const canBid =
    liveActionsEnabled &&
    snapshot.turnType === "BIDDING" &&
    (team?.biddingWins ?? 0) < snapshot.settings.auctionPlayers &&
    !isWinningBidTeam &&
    !hasPassed;
  const canPass =
    snapshot.settings.allowPassOnPlayer &&
    canBid &&
    !hasPassed &&
    !isWinningBidTeam &&
    snapshot.highestBid !== null;
  const canNominate =
    liveActionsEnabled &&
    isYourTurn &&
    snapshot.turnType === "BIDDING_NOMINATION";
  const canPick =
    liveActionsEnabled &&
    isYourTurn &&
    snapshot.turnType === "SNAKE_PICK";
  const isSelectionTurn = ["SNAKE_PICK", "MANUAL_RESOLUTION"].includes(snapshot.turnType);
  const isBiddingIntervention =
    snapshot.turnType === "MANUAL_RESOLUTION" && snapshot.phase === "BIDDING";
  const showBiddingPanel =
    snapshot.phase === "BIDDING" ||
    (snapshot.phase === "COMPLETE" && snapshot.turnType === "BIDDING");
  const showSnakeOrder = Boolean(snapshot.snakeOrderPreview);
  const statusPanelOverride =
    isNominationTurn && !isYourTurn
      ? {
          heading: "Nomination Status",
          value: "WAITING",
          caption: currentTurnTeam
            ? `Waiting for ${currentTurnTeam.teamName} to nominate the next player`
            : "Waiting for the next nominating team owner",
        }
      : isNominationTurn && isYourTurn
        ? {
            heading: "Your Nomination Timer",
            value: countdown,
            caption: "Nominate a player before the clock expires",
          }
        : undefined;

  function CollapsibleSupportSection({
    title,
    subtitle,
    isOpen,
    onToggle,
    children,
  }: {
    title: string;
    subtitle: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) {
    return (
      <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Support view
            </p>
            <h3 className="mt-1 text-lg font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
          </div>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onToggle}
            type="button"
          >
            {isOpen ? "Hide" : "Show"}
          </button>
        </div>
        {isOpen ? <div className="mt-4">{children}</div> : null}
      </section>
    );
  }

  const teamOptions = useMemo(
    () =>
      [...new Set(snapshot.availablePlayers.map((player) => player.iplTeam))].sort((left, right) =>
        left.localeCompare(right),
      ),
    [snapshot.availablePlayers],
  );

  const filteredPlayers = useMemo(
    () =>
      snapshot.availablePlayers.filter((player) => {
        const matchesSearch =
          player.name.toLowerCase().includes(search.toLowerCase()) ||
          player.iplTeam.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === "ALL" || player.role === roleFilter;
        const matchesTeam = teamFilter === "ALL" || player.iplTeam === teamFilter;
        return matchesSearch && matchesRole && matchesTeam;
      }),
    [roleFilter, search, snapshot.availablePlayers, teamFilter],
  );

  async function submitBid(amount: number) {
    if (!snapshot.activeRoundId) {
      return;
    }

    const response = await fetch("/api/auction/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundId: snapshot.activeRoundId,
        amount,
      }),
    });

    const data = (await response.json()) as { error?: string };
    setStatusMessage(response.ok ? "Bid submitted." : data.error ?? "Bid failed.");
    if (response.ok) {
      await refreshSnapshot();
    }
  }

  async function submitNomination(playerId: string) {
    if (!snapshot.activeRoundId) {
      return;
    }

    const response = await fetch("/api/auction/nominate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundId: snapshot.activeRoundId,
        playerId,
      }),
    });

    const data = (await response.json()) as { error?: string };
    setStatusMessage(
      response.ok ? "Player nominated for auction." : data.error ?? "Nomination failed.",
    );
    if (response.ok) {
      await refreshSnapshot();
    }
  }

  async function submitPick(playerId: string) {
    if (!snapshot.activeRoundId) {
      return;
    }

    const response = await fetch("/api/auction/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundId: snapshot.activeRoundId,
        playerId,
      }),
    });

    const data = (await response.json()) as { error?: string };
    setStatusMessage(
      response.ok ? "Player picked." : data.error ?? "Pick failed.",
    );
    if (response.ok) {
      await refreshSnapshot();
    }
  }

  async function submitPass() {
    if (!snapshot.activeRoundId) {
      return;
    }

    const response = await fetch("/api/auction/pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundId: snapshot.activeRoundId,
      }),
    });

    const data = (await response.json()) as { error?: string };
    setStatusMessage(
      response.ok ? "You passed on this player." : data.error ?? "Pass failed.",
    );
    if (response.ok) {
      await refreshSnapshot();
    }
  }

  useEffect(() => {
    setBidAmount(
      snapshot.highestBid
        ? snapshot.highestBid + 1
        : snapshot.settings.startingBidAmount + 1,
    );
  }, [snapshot.activeRoundId, snapshot.highestBid, snapshot.settings.startingBidAmount]);

  useEffect(() => {
    if (snapshot.phase !== "COMPLETE") {
      setShowConfetti(false);
      return;
    }

    setConfettiBurstKey((value) => value + 1);
    setShowConfetti(true);
    const timeoutId = window.setTimeout(() => {
      setShowConfetti(false);
    }, 5200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [snapshot.phase]);

  useEffect(() => {
    const previousPlayers = previousOwnerTeamStatsRef.current.players;
    const nextPlayers = team?.players ?? 0;
    const nextBiddingWins = team?.biddingWins ?? 0;

    if (nextPlayers > previousPlayers) {
      setConfettiBurstKey((value) => value + 1);
      setShowConfetti(true);
      const timeoutId = window.setTimeout(() => {
        setShowConfetti(false);
      }, 3600);

      previousOwnerTeamStatsRef.current.players = nextPlayers;
      previousOwnerTeamStatsRef.current.biddingWins = nextBiddingWins;

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    previousOwnerTeamStatsRef.current.players = nextPlayers;
    previousOwnerTeamStatsRef.current.biddingWins = nextBiddingWins;
  }, [team, previousOwnerTeamStatsRef]);

  return (
    <div className="relative">
      {showConfetti ? <ConfettiOverlay key={confettiBurstKey} /> : null}
      <AuctionLayout
        connectionState={connectionState}
        countdown={countdown}
        countdownSeconds={countdownSeconds}
        currentTurnTeamName={currentTurnTeam?.teamName ?? null}
        onToggleSound={toggleSound}
        snapshot={snapshot}
        soundEnabled={soundEnabled}
        statusPanelOverride={statusPanelOverride}
        subtitle={focus === "snake" ? "Snake draft room" : undefined}
        title={focus === "auction" ? "Auction status" : "Draft status"}
      >
        <div className="grid gap-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <section className="grid gap-6">
            {showBiddingPanel ? (
              <BiddingPanel
                bidAmount={bidAmount}
                canBid={canBid}
                canPass={canPass}
                currentHighestBidTeamName={highestBidTeam?.teamName ?? null}
                currentTurnTeamName={currentTurnTeam?.teamName ?? null}
                hasPassed={hasPassed}
                isWinningBidTeam={isWinningBidTeam}
                onPass={() => void submitPass()}
                onSubmit={(amount) => void submitBid(amount)}
                passedTeams={snapshot.passedTeams}
                setBidAmount={setBidAmount}
                snapshot={snapshot}
                statusMessage={statusMessage}
              />
            ) : null}
            <PlayerPool
              actionMode={snapshot.turnType === "BIDDING_NOMINATION" ? "nominate" : "pick"}
              canAct={canNominate || canPick}
              currentTurnLabel={
                isBiddingIntervention
                  ? snapshot.manualReason ?? "This bidding round is waiting for admin intervention."
                  : isNominationTurn
                  ? isYourTurn
                    ? "It is your turn to nominate a player for bidding."
                    : currentTurnTeam
                      ? `Waiting for ${currentTurnTeam.teamName} team owner to nominate a player for auction.`
                      : "Waiting for the next team owner to nominate a player."
                  : isSelectionTurn
                  ? isYourTurn
                    ? "It is your turn to select a player."
                    : currentTurnTeam
                      ? `Waiting for ${currentTurnTeam.teamName} team owner to finish selecting a player.`
                      : "Waiting for the next team owner to begin selecting a player."
                  : "Use this board to follow nominations, browse available players, and prepare for your upcoming turn."
              }
              currentTurnState={
                isBiddingIntervention
                  ? currentTurnTeam
                    ? "waiting"
                    : "idle"
                  : isNominationTurn || isSelectionTurn
                  ? isYourTurn
                    ? "active"
                    : currentTurnTeam
                      ? "waiting"
                      : "idle"
                  : "idle"
              }
              onAct={(playerId) =>
                void (snapshot.turnType === "BIDDING_NOMINATION"
                  ? submitNomination(playerId)
                  : submitPick(playerId))
              }
              onRoleFilter={setRoleFilter}
              onSearch={setSearch}
              onTeamFilter={setTeamFilter}
              players={filteredPlayers}
              roleFilter={roleFilter}
              search={search}
              teamFilter={teamFilter}
              teamOptions={teamOptions}
            />
          </section>
          <aside className="grid gap-6">
            <TeamSummary snapshot={snapshot} teamId={ownerTeamId} />
            <LeaderboardPanel
              highlightedTeamId={
                focus === "snake" ? snapshot.currentTurnTeamId ?? ownerTeamId : ownerTeamId
              }
              leaderboard={snapshot.leaderboard}
              title={focus === "snake" ? "Draft order board" : "Leaderboard"}
            />
          </aside>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <OrderBoard
            highlightedTeamId={snapshot.currentNominatorTeamId}
            ownerTeamId={ownerTeamId}
            order={snapshot.biddingNominationOrder}
            subtitle="Randomized bidding nomination order"
            title="Bidding order"
          />
          {showSnakeOrder ? (
            <OrderBoard
              highlightedTeamId={snapshot.currentTurnTeamId}
              ownerTeamId={ownerTeamId}
              order={snapshot.snakeOrderPreview!}
              subtitle="Spend-based snake order"
              title="Snake order"
            />
          ) : (
            <ActivityFeed items={snapshot.activity.slice(0, 10)} />
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_0.9fr]">
          <CollapsibleSupportSection
            isOpen={showAllRosters}
            onToggle={() => setShowAllRosters((current) => !current)}
            subtitle="Expand to review every roster without crowding the main live room."
            title="All team rosters"
          >
            <TeamPicksBoard
              eyebrow="Rosters"
              highlightedTeamId={ownerTeamId}
              snapshot={snapshot}
              title="All team picks"
            />
          </CollapsibleSupportSection>
          {showSnakeOrder ? (
            <CollapsibleSupportSection
              isOpen={showActivity}
              onToggle={() => setShowActivity((current) => !current)}
              subtitle="Expand to inspect the latest accepted bids, picks, and interventions."
              title="Live activity"
            >
              <ActivityFeed items={snapshot.activity.slice(0, 10)} showHeader={false} />
            </CollapsibleSupportSection>
          ) : null}
        </div>
        </div>
      </AuctionLayout>
    </div>
  );
}
