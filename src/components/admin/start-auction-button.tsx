"use client";

import { useFormStatus } from "react-dom";

type StartAuctionButtonProps = {
  disabled: boolean;
  startedState: "paused" | "live" | "completed" | null;
};

export function StartAuctionButton({
  disabled,
  startedState,
}: StartAuctionButtonProps) {
  const { pending } = useFormStatus();

  const label = pending
    ? "Creating random owner order..."
    : startedState === "paused"
      ? "Auction paused"
      : startedState === "live"
        ? "Auction is live"
        : startedState === "completed"
          ? "Auction completed"
          : "Start auction";

  return (
    <button
      className="rounded-full bg-turf px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={disabled || pending}
      type="submit"
    >
      {label}
    </button>
  );
}
