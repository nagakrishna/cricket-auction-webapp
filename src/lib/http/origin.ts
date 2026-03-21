import { getEnv } from "@/lib/env/server";

function isInternalHostname(hostname: string) {
  return hostname === "0.0.0.0";
}

export function getRequestOrigin(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new URL(getEnv().APP_URL).origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const requestUrl = new URL(request.url);
  if (!isInternalHostname(requestUrl.hostname)) {
    return requestUrl.origin;
  }

  return new URL(getEnv().APP_URL).origin;
}

export function createRedirectUrl(request: Request, path: string) {
  return new URL(path, getRequestOrigin(request));
}
