export const AUCTION_SOCKET_EVENTS = {
  systemConnected: "system:connected",
  auctionSnapshot: "auction:snapshot",
  auctionEvent: "auction:event",
  auctionJoin: "auction:join",
  auctionLeave: "auction:leave",
} as const;

export const SOCKET_CONNECTION_EVENTS = {
  connect: "connect",
  disconnect: "disconnect",
} as const;

export function getAuctionRoomName(auctionId: string) {
  return `auction:${auctionId}`;
}
