"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getAuctionSocket } from "@/lib/realtime/client";
import {
  AUCTION_SOCKET_EVENTS,
  SOCKET_CONNECTION_EVENTS,
} from "@/lib/realtime/contracts";
import type { AuctionSnapshot } from "@/lib/realtime/events";

function formatCountdown(deadlineAt: string | null) {
  if (!deadlineAt) {
    return "--:--";
  }

  const diff = Math.max(0, new Date(deadlineAt).getTime() - Date.now());
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function useAuctionLiveState(initialSnapshot: AuctionSnapshot) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [countdown, setCountdown] = useState("--:--");
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState<"connected" | "reconnecting">("connected");
  const syncSnapshotRef = useRef<null | (() => Promise<void>)>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const previousStatusRef = useRef(initialSnapshot.status);

  useEffect(() => {
    const socket = getAuctionSocket();
    const auctionId = initialSnapshot.auctionId;

    async function syncSnapshotFromServer() {
      if (syncInFlightRef.current) {
        return syncInFlightRef.current;
      }

      const run = (async () => {
        const response = await fetch("/api/auction/snapshot", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { snapshot: AuctionSnapshot };
        setSnapshot(data.snapshot);
      })().finally(() => {
        syncInFlightRef.current = null;
      });

      syncInFlightRef.current = run;

      return run;
    }

    syncSnapshotRef.current = syncSnapshotFromServer;

    function joinAuctionRoom() {
      socket.emit(AUCTION_SOCKET_EVENTS.auctionJoin, { auctionId });
    }

    function handleSnapshot(nextSnapshot: AuctionSnapshot) {
      setSnapshot(nextSnapshot);
      setConnectionState("connected");
    }

    function handleAuctionEvent() {
      void syncSnapshotFromServer();
    }

    function handleConnect() {
      setConnectionState("connected");
      joinAuctionRoom();
      // Re-fetch after reconnect so the UI catches up even if socket events were missed.
      void syncSnapshotFromServer();
    }

    function handleDisconnect() {
      setConnectionState("reconnecting");
    }

    function handleWindowFocus() {
      void syncSnapshotFromServer();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncSnapshotFromServer();
      }
    }

    function handleNetworkOnline() {
      void syncSnapshotFromServer();
    }

    socket.connect();
    joinAuctionRoom();
    socket.on(AUCTION_SOCKET_EVENTS.auctionSnapshot, handleSnapshot);
    socket.on(AUCTION_SOCKET_EVENTS.auctionEvent, handleAuctionEvent);
    socket.on(SOCKET_CONNECTION_EVENTS.connect, handleConnect);
    socket.on(SOCKET_CONNECTION_EVENTS.disconnect, handleDisconnect);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleNetworkOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      syncSnapshotRef.current = null;
      socket.emit(AUCTION_SOCKET_EVENTS.auctionLeave, { auctionId });
      socket.off(AUCTION_SOCKET_EVENTS.auctionSnapshot, handleSnapshot);
      socket.off(AUCTION_SOCKET_EVENTS.auctionEvent, handleAuctionEvent);
      socket.off(SOCKET_CONNECTION_EVENTS.connect, handleConnect);
      socket.off(SOCKET_CONNECTION_EVENTS.disconnect, handleDisconnect);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleNetworkOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialSnapshot.auctionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void syncSnapshotRef.current?.();
    }, 2000);

    return () => window.clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const wasPaused = previousStatusRef.current === "PAUSED";
    previousStatusRef.current = snapshot.status;

    if (snapshot.status === "PAUSED") {
      if (!wasPaused) {
        setCountdown(formatCountdown(snapshot.deadlineAt));
        setCountdownSeconds(
          snapshot.deadlineAt
            ? Math.max(0, Math.ceil((new Date(snapshot.deadlineAt).getTime() - Date.now()) / 1000))
            : null,
        );
      }
      return;
    }

    setCountdown(formatCountdown(snapshot.deadlineAt));
    setCountdownSeconds(
      snapshot.deadlineAt
        ? Math.max(0, Math.ceil((new Date(snapshot.deadlineAt).getTime() - Date.now()) / 1000))
        : null,
    );
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(snapshot.deadlineAt));
      setCountdownSeconds(
        snapshot.deadlineAt
          ? Math.max(0, Math.ceil((new Date(snapshot.deadlineAt).getTime() - Date.now()) / 1000))
          : null,
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [snapshot.deadlineAt, snapshot.status]);

  const currentTurnTeam = useMemo(
    () =>
      snapshot.currentTurnTeamId
        ? snapshot.leaderboard.find((entry) => entry.teamId === snapshot.currentTurnTeamId) ?? null
        : null,
    [snapshot.currentTurnTeamId, snapshot.leaderboard],
  );

  return {
    snapshot,
    countdown,
    countdownSeconds,
    connectionState,
    currentTurnTeam,
    refreshSnapshot: () => syncSnapshotRef.current?.() ?? Promise.resolve(),
  };
}
