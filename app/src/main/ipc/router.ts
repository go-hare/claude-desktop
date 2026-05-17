/**
 * Wires the registry to Electron IPC. Single channel, central dispatch.
 */

import { ipcMain } from 'electron';
import { REBUILD_RPC_CHANNEL, type RpcRequest, type RpcResponse } from '../../shared/ipcProtocol';
import { IpcRegistry } from './registry';
import { registerAllHandlers } from './handlers';

let installed = false;
let registry: IpcRegistry | null = null;

export function installIpcRouter(): IpcRegistry {
  if (installed) {
    return registry!;
  }
  installed = true;

  registry = new IpcRegistry();
  registerAllHandlers(registry);

  ipcMain.handle(REBUILD_RPC_CHANNEL, async (_event, req: RpcRequest): Promise<RpcResponse> => {
    if (!req || typeof req !== 'object' || typeof (req as { kind?: unknown }).kind !== 'string') {
      return { ok: false, error: 'Malformed RPC request' };
    }
    return registry!.dispatch(req);
  });

  const stats = registry.stats();
  console.log(
    `[rebuild:ipc] router installed: ${stats.methodCount} methods, ${stats.storeCount} stores`,
  );

  return registry;
}

export function getIpcRegistry(): IpcRegistry {
  if (!registry) {
    throw new Error('IPC router not installed yet — call installIpcRouter() first');
  }
  return registry;
}
