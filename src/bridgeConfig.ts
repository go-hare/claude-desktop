// Centralized bridge URL resolution. The bridge tries to bind to 30080 but may
// fall back to another port if it's taken. The renderer asks `electronAPI` once
// at startup, then exposes synchronous helpers.

let cachedPort = 30080;
let resolved = false;

function envOverride(): number | null {
  const env = (import.meta as any)?.env;
  if (env && env.VITE_BRIDGE_PORT) {
    const parsed = Number(env.VITE_BRIDGE_PORT);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export async function initBridgePort(): Promise<number> {
  if (resolved) return cachedPort;
  const override = envOverride();
  if (override) {
    cachedPort = override;
    resolved = true;
    return cachedPort;
  }
  const api = (typeof window !== 'undefined' ? (window as any).electronAPI : null);
  if (api?.getBridgePort) {
    try {
      const port = await api.getBridgePort();
      if (Number.isFinite(port) && port > 0) cachedPort = port;
    } catch {
      // ignore — fall back to default
    }
    if (api.onBridgePort) {
      try { api.onBridgePort((port: number) => { if (Number.isFinite(port) && port > 0) cachedPort = port; }); } catch {}
    }
  }
  resolved = true;
  return cachedPort;
}

export function getBridgePort(): number {
  return cachedPort;
}

export function bridgeOrigin(): string {
  return `http://127.0.0.1:${cachedPort}`;
}

export function bridgeApiBase(): string {
  return `${bridgeOrigin()}/api`;
}

export function bridgeWsOrigin(): string {
  return `ws://127.0.0.1:${cachedPort}`;
}

export function bridgePtyUrl(): string {
  return `${bridgeWsOrigin()}/api/pty`;
}
