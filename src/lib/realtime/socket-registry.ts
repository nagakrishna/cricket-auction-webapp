import type { Server as HttpServer } from "node:http";

import { Server as SocketIOServer } from "socket.io";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/realtime/events";

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

export function initializeSocketServer(server: HttpServer) {
  if (io) {
    return io;
  }

  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: process.env.APP_URL ?? "http://localhost:3000",
      credentials: true,
    },
  });

  return io;
}

export function getSocketServer() {
  return io;
}
