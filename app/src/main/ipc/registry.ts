/**
 * Central registry of IPC handlers.
 *
 * Methods and stores are keyed by `ns::cls.member`. Anything the preload's
 * REGISTRY exposes but isn't registered here resolves to a NOT_AVAILABLE
 * error — we want the SPA to feature-detect cleanly rather than blow up.
 */

import { BrowserWindow } from 'electron';
import {
  REBUILD_EVENT_CHANNEL,
  RPC_ERROR_CODES,
  type RpcEventMessage,
  type RpcRequest,
  type RpcResponse,
} from '../../shared/ipcProtocol';

export type MethodHandler = (...args: unknown[]) => Promise<unknown> | unknown;

export interface StoreHandler<T = unknown> {
  getState: () => Promise<T> | T;
}

interface RegistryStats {
  methodCount: number;
  storeCount: number;
  unhandledKeys: string[];
}

export class IpcRegistry {
  private methods = new Map<string, MethodHandler>();
  private stores = new Map<string, StoreHandler>();
  private unhandled = new Set<string>();

  method(ns: string, cls: string, name: string, handler: MethodHandler) {
    const key = `${ns}::${cls}.${name}`;
    if (this.methods.has(key)) {
      console.warn('[rebuild:ipc] duplicate method registration', key);
    }
    this.methods.set(key, handler);
  }

  store<T>(ns: string, cls: string, name: string, handler: StoreHandler<T>) {
    const key = `${ns}::${cls}.${name}`;
    this.stores.set(key, handler as StoreHandler);
  }

  /**
   * Push a typed event to every renderer. Handlers call this to drive
   * `onXxx` subscribers in the SPA. No-op if no windows exist.
   */
  broadcastEvent(ns: string, cls: string, event: string, payload: unknown) {
    const msg: RpcEventMessage = { kind: 'event', ns, cls, event, payload };
    this.broadcast(msg);
  }

  broadcastStoreUpdate(ns: string, cls: string, store: string, payload: unknown) {
    const msg: RpcEventMessage = { kind: 'storeUpdate', ns, cls, store, payload };
    this.broadcast(msg);
  }

  private broadcast(msg: RpcEventMessage) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      // webContents can be destroyed independently of the BrowserWindow
      // (e.g., during a reload race). Guard before send().
      const wc = win.webContents;
      if (!wc || wc.isDestroyed()) continue;
      try {
        wc.send(REBUILD_EVENT_CHANNEL, msg);
      } catch (err) {
        // Last-resort defense: even with checks above, send() can throw if
        // the renderer is mid-teardown. Log and move on.
        console.warn('[rebuild:ipc] broadcast failed', err);
      }
    }
  }

  async dispatch(req: RpcRequest): Promise<RpcResponse> {
    try {
      if (req.kind === 'method') {
        const key = `${req.ns}::${req.cls}.${req.method}`;
        const handler = this.methods.get(key);
        if (!handler) {
          this.recordUnhandled(key);
          return {
            ok: false,
            error: `IPC method not implemented: ${key}`,
            code: RPC_ERROR_CODES.NOT_AVAILABLE,
          };
        }
        const value = await handler(...req.args);
        return { ok: true, value };
      }

      const key = `${req.ns}::${req.cls}.${req.store}`;
      const store = this.stores.get(key);
      if (!store) {
        this.recordUnhandled(`${key} (store ${req.action})`);
        return {
          ok: false,
          error: `IPC store not implemented: ${key}`,
          code: RPC_ERROR_CODES.NOT_AVAILABLE,
        };
      }
      if (req.action === 'getStateSync') {
        return {
          ok: false,
          error: `getStateSync not supported for ${key}`,
          code: RPC_ERROR_CODES.NOT_AVAILABLE,
        };
      }
      const value = await store.getState();
      return { ok: true, value };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[rebuild:ipc] handler threw', req, err);
      return { ok: false, error: message, code: RPC_ERROR_CODES.INTERNAL };
    }
  }

  private recordUnhandled(key: string) {
    if (this.unhandled.has(key)) return;
    this.unhandled.add(key);
    console.warn('[rebuild:ipc] unhandled', key);
  }

  stats(): RegistryStats {
    return {
      methodCount: this.methods.size,
      storeCount: this.stores.size,
      unhandledKeys: [...this.unhandled],
    };
  }
}
