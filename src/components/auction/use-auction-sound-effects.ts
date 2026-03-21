"use client";

import { useEffect, useRef, useState } from "react";

import type { AuctionSnapshot } from "@/lib/realtime/events";

type SoundPreset = Array<{
  delayMs: number;
  durationMs: number;
  frequency: number;
  gain: number;
}>;

const SOUND_PRESETS: Record<
  "winning" | "outbid" | "yourTurn" | "attention" | "finalTick" | "hammer",
  SoundPreset
> = {
  winning: [
    { delayMs: 0, durationMs: 100, frequency: 720, gain: 0.04 },
    { delayMs: 120, durationMs: 140, frequency: 880, gain: 0.05 },
  ],
  outbid: [
    { delayMs: 0, durationMs: 120, frequency: 320, gain: 0.05 },
    { delayMs: 160, durationMs: 120, frequency: 240, gain: 0.05 },
  ],
  yourTurn: [
    { delayMs: 0, durationMs: 120, frequency: 660, gain: 0.045 },
    { delayMs: 150, durationMs: 120, frequency: 660, gain: 0.045 },
    { delayMs: 300, durationMs: 180, frequency: 820, gain: 0.05 },
  ],
  attention: [{ delayMs: 0, durationMs: 260, frequency: 420, gain: 0.05 }],
  finalTick: [{ delayMs: 0, durationMs: 90, frequency: 560, gain: 0.045 }],
  hammer: [
    { delayMs: 0, durationMs: 80, frequency: 180, gain: 0.06 },
    { delayMs: 85, durationMs: 120, frequency: 110, gain: 0.04 },
  ],
};

function playToneSequence(
  audioContext: AudioContext,
  preset: SoundPreset,
) {
  const startAt = audioContext.currentTime;

  for (const tone of preset) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const toneStart = startAt + tone.delayMs / 1000;
    const toneEnd = toneStart + tone.durationMs / 1000;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, toneStart);

    gainNode.gain.setValueAtTime(0.0001, toneStart);
    gainNode.gain.exponentialRampToValueAtTime(tone.gain, toneStart + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(toneStart);
    oscillator.stop(toneEnd + 0.03);
  }
}

export function useAuctionSoundEffects(
  snapshot: AuctionSnapshot,
  ownerTeamId: string,
  countdownSeconds: number | null,
) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousSnapshotRef = useRef<AuctionSnapshot | null>(null);
  const previousCountdownSecondsRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const AudioContextCtor =
      window.AudioContext ||
      ("webkitAudioContext" in window
        ? (window as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : undefined);

    if (!AudioContextCtor) {
      return;
    }

    const audioContext = new AudioContextCtor();
    audioContextRef.current = audioContext;

    async function unlockAudio() {
      if (audioContext.state !== "running") {
        await audioContext.resume();
      }
      setSoundReady(audioContext.state === "running");
    }

    const unlockHandler = () => {
      void unlockAudio();
    };

    window.addEventListener("pointerdown", unlockHandler, { passive: true });
    window.addEventListener("keydown", unlockHandler);

    return () => {
      window.removeEventListener("pointerdown", unlockHandler);
      window.removeEventListener("keydown", unlockHandler);
      void audioContext.close();
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const previousSnapshot = previousSnapshotRef.current;
    previousSnapshotRef.current = snapshot;

    const audioContext = audioContextRef.current;

    if (!previousSnapshot || !audioContext || !soundEnabled || !soundReady) {
      return;
    }

    if (
      previousSnapshot.currentTurnTeamId !== ownerTeamId &&
      snapshot.currentTurnTeamId === ownerTeamId
    ) {
      playToneSequence(audioContext, SOUND_PRESETS.yourTurn);
      return;
    }

    if (
      previousSnapshot.highestBidTeamId === ownerTeamId &&
      snapshot.highestBidTeamId &&
      snapshot.highestBidTeamId !== ownerTeamId &&
      snapshot.turnType === "BIDDING"
    ) {
      playToneSequence(audioContext, SOUND_PRESETS.outbid);
      return;
    }

    if (
      previousSnapshot.highestBidTeamId !== ownerTeamId &&
      snapshot.highestBidTeamId === ownerTeamId &&
      snapshot.turnType === "BIDDING"
    ) {
      playToneSequence(audioContext, SOUND_PRESETS.winning);
      return;
    }

    if (
      previousSnapshot.turnType !== "MANUAL_RESOLUTION" &&
      snapshot.turnType === "MANUAL_RESOLUTION"
    ) {
      playToneSequence(audioContext, SOUND_PRESETS.attention);
    }
  }, [ownerTeamId, snapshot, soundEnabled, soundReady]);

  useEffect(() => {
    const audioContext = audioContextRef.current;
    const previousCountdownSeconds = previousCountdownSecondsRef.current;
    previousCountdownSecondsRef.current = countdownSeconds;

    if (!audioContext || !soundEnabled || !soundReady) {
      return;
    }

    if (!snapshot.finalCallActive || countdownSeconds === null) {
      return;
    }

    if (previousCountdownSeconds === countdownSeconds) {
      return;
    }

    if (countdownSeconds > 0 && countdownSeconds <= 3) {
      playToneSequence(audioContext, SOUND_PRESETS.finalTick);
      return;
    }

    if (countdownSeconds === 0) {
      playToneSequence(audioContext, SOUND_PRESETS.hammer);
    }
  }, [countdownSeconds, snapshot.finalCallActive, soundEnabled, soundReady]);

  return {
    soundEnabled,
    soundReady,
    async toggleSound() {
      const nextValue = !soundEnabled;
      setSoundEnabled(nextValue);

      if (nextValue && audioContextRef.current) {
        if (audioContextRef.current.state !== "running") {
          await audioContextRef.current.resume();
        }

        setSoundReady(audioContextRef.current.state === "running");
      }
    },
  };
}
