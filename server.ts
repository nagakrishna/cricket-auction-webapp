import { createServer } from "node:http";

import next from "next";

import {
  AUCTION_SOCKET_EVENTS,
  getAuctionRoomName,
} from "@/lib/realtime/contracts";
import { getAuctionSnapshot, processExpiredTimers } from "@/server/auction/auction-service";
import { initializeSocketServer } from "@/lib/realtime/socket-registry";
import {
  getSessionTokenFromCookieHeader,
  markRealtimeDisconnected,
  registerRealtimeConnection,
} from "@/server/realtime/connection-service";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

async function bootstrap() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = initializeSocketServer(httpServer);

  io.on("connection", (socket) => {
    socket.emit(AUCTION_SOCKET_EVENTS.systemConnected, {
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
    });

    socket.on(AUCTION_SOCKET_EVENTS.auctionJoin, async ({ auctionId }) => {
      try {
        const sessionToken = getSessionTokenFromCookieHeader(
          socket.handshake.headers.cookie,
        );

        if (sessionToken) {
          await registerRealtimeConnection({
            sessionToken,
            socketId: socket.id,
            auctionId,
          });
        }

        socket.join(getAuctionRoomName(auctionId));
        const snapshot = await getAuctionSnapshot();
        socket.emit(AUCTION_SOCKET_EVENTS.auctionSnapshot, snapshot);
      } catch (_error) {
        // The auction may not be configured yet during initial setup.
      }
    });

    socket.on(AUCTION_SOCKET_EVENTS.auctionLeave, async ({ auctionId }) => {
      socket.leave(getAuctionRoomName(auctionId));
    });

    socket.on("disconnect", () => {
      void markRealtimeDisconnected(socket.id);
    });
  });

  setInterval(() => {
    void processExpiredTimers();
  }, 1000);

  httpServer.listen(port, hostname, () => {
    process.stdout.write(
      `> Server listening at http://${hostname}:${port}\n`,
    );
  });
}

bootstrap().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exit(1);
});
