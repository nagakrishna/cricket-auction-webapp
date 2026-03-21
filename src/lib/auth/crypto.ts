import { createHash, randomBytes } from "node:crypto";

export function createToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function hashToken(input: string) {
  return createHash("sha256").update(input).digest("hex");
}
