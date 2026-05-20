// Lightweight PTY service: spawns local shells via node-pty and proxies them
// to the renderer over a WebSocket on /api/pty.
//
// Wire format (text JSON frames from client -> server):
//   { type: 'spawn', cwd?, shell?, cols?, rows?, env? }
//   { type: 'input', data }
//   { type: 'resize', cols, rows }
//   { type: 'close' }
//
// Server -> client frames:
//   { type: 'ready', pid }
//   { type: 'data', data }
//   { type: 'exit', exitCode, signal }
//   { type: 'error', message }
//
// Each WS connection owns exactly one pty.

const path = require('path');
const fs = require('fs');
const os = require('os');

let nodePty = null;
let nodePtyError = null;
try {
    nodePty = require('node-pty');
} catch (err) {
    nodePtyError = err;
    console.error('[PTY] node-pty failed to load:', err && err.message);
}

function pickShell() {
    if (process.platform === 'win32') {
        const gitBash = process.env.CLAUDE_CODE_GIT_BASH_PATH;
        if (gitBash && fs.existsSync(gitBash)) return { file: gitBash, args: ['-i', '-l'] };
        const psh = process.env.SystemRoot
            ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
            : 'powershell.exe';
        return { file: psh, args: [] };
    }
    if (process.platform === 'darwin') return { file: process.env.SHELL || '/bin/zsh', args: ['-il'] };
    return { file: process.env.SHELL || '/bin/bash', args: ['-il'] };
}

function safeCwd(input) {
    if (!input || typeof input !== 'string') return os.homedir();
    try {
        const stat = fs.statSync(input);
        if (stat.isDirectory()) return input;
    } catch (_) {}
    return os.homedir();
}

function attachPtyWebSocket(httpServer) {
    let WebSocketServer;
    try {
        ({ WebSocketServer } = require('ws'));
    } catch (err) {
        console.error('[PTY] ws module not available:', err && err.message);
        return;
    }

    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (req, socket, head) => {
        const url = req.url || '';
        if (!url.startsWith('/api/pty')) return; // let other handlers process other paths
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', (ws) => {
        if (!nodePty) {
            try { ws.send(JSON.stringify({ type: 'error', message: nodePtyError ? `node-pty unavailable: ${nodePtyError.message}` : 'node-pty unavailable' })); } catch (_) {}
            try { ws.close(); } catch (_) {}
            return;
        }

        let pty = null;
        let closed = false;

        const send = (frame) => {
            if (closed) return;
            try { ws.send(JSON.stringify(frame)); } catch (_) {}
        };

        const tryStart = (msg) => {
            if (pty) return;
            const cwd = safeCwd(msg.cwd);
            const cols = Math.max(20, Math.min(500, msg.cols || 80));
            const rows = Math.max(5, Math.min(200, msg.rows || 24));
            const requestedShell = typeof msg.shell === 'string' && msg.shell ? { file: msg.shell, args: [] } : pickShell();
            const env = { ...process.env, ...(msg.env && typeof msg.env === 'object' ? msg.env : {}), TERM: 'xterm-256color' };
            try {
                pty = nodePty.spawn(requestedShell.file, requestedShell.args, {
                    name: 'xterm-256color',
                    cols,
                    rows,
                    cwd,
                    env,
                });
            } catch (err) {
                send({ type: 'error', message: `spawn failed: ${err && err.message}` });
                try { ws.close(); } catch (_) {}
                return;
            }
            send({ type: 'ready', pid: pty.pid, shell: requestedShell.file, cwd });
            pty.onData((data) => send({ type: 'data', data }));
            pty.onExit(({ exitCode, signal }) => {
                send({ type: 'exit', exitCode, signal });
                try { ws.close(); } catch (_) {}
            });
        };

        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw.toString('utf8')); } catch (_) { return; }
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'spawn') return tryStart(msg);
            if (!pty) return;
            if (msg.type === 'input' && typeof msg.data === 'string') {
                try { pty.write(msg.data); } catch (_) {}
            } else if (msg.type === 'resize') {
                const cols = Math.max(20, Math.min(500, msg.cols || 80));
                const rows = Math.max(5, Math.min(200, msg.rows || 24));
                try { pty.resize(cols, rows); } catch (_) {}
            } else if (msg.type === 'close') {
                try { pty.kill(); } catch (_) {}
            }
        });

        const cleanup = () => {
            if (closed) return;
            closed = true;
            if (pty) {
                try { pty.kill(); } catch (_) {}
                pty = null;
            }
        };
        ws.on('close', cleanup);
        ws.on('error', cleanup);
    });

    console.log('[PTY] WebSocket attached at /api/pty');
}

module.exports = { attachPtyWebSocket };
