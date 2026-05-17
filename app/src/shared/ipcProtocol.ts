/**
 * Shared IPC protocol between main process and ion-dist preload.
 *
 * Wire shape: a single Electron channel `REBUILD_RPC_CHANNEL` carries every
 * call. Payload tells the main router which service / method / store action
 * to dispatch. The preload exposes `globalThis["claude.web"]` etc. as plain
 * objects whose methods translate into messages on this channel — ion-dist
 * never sees the channel name.
 *
 * Why not match the official `$eipc_message$_<UID>_$_<ns>_$_<class>_$_<method>`
 * format? Electron `ipcMain.handle` requires a literal channel string and
 * doesn't support wildcards, so registering 600+ channels would be tedious
 * and would couple us to the official build's UUID. Going through one
 * channel keeps the router central and the preload simple.
 */

export const REBUILD_RPC_CHANNEL = 'rebuild:rpc';
export const REBUILD_EVENT_CHANNEL = 'rebuild:event';

export type RpcRequest =
  | {
      kind: 'method';
      ns: string;
      cls: string;
      method: string;
      args: unknown[];
    }
  | {
      kind: 'store';
      ns: string;
      cls: string;
      store: string;
      action: 'getState' | 'getStateSync';
    };

export type RpcResponse<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string; code?: string };

/** Stable error codes used by the registry's default fallback. */
export const RPC_ERROR_CODES = {
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  INVALID_ARGS: 'INVALID_ARGS',
  INTERNAL: 'INTERNAL',
} as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES];

/** Message envelope for events / store updates pushed from main to renderer. */
export type RpcEventMessage =
  | {
      kind: 'event';
      ns: string;
      cls: string;
      event: string;
      payload: unknown;
    }
  | {
      kind: 'storeUpdate';
      ns: string;
      cls: string;
      store: string;
      payload: unknown;
    };

export function eventChannelKey(ns: string, cls: string, event: string) {
  return `${ns}::${cls}.${event}`;
}

export function storeUpdateKey(ns: string, cls: string, store: string) {
  return `${ns}::${cls}.${store}.update`;
}
