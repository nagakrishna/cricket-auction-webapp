"use client";

import { io, type Socket } from "socket.io-client";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/realtime/events";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getAuctionSocket() {
  if (!socket) {
    socket = io({
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 10000,
    });
  }

  return socket;
}
