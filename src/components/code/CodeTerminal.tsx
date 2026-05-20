import { useEffect, useMemo, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

type Props = {
  cwd?: string | null;
};

const PTY_WS_URL = 'ws://127.0.0.1:30080/api/pty';

export default function CodeTerminal({ cwd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;

  const theme = useMemo(() => ({
    background: '#1f1f1f',
    foreground: '#eeeeee',
    cursor: '#eeeeee',
    selectionBackground: 'rgba(255,255,255,0.18)',
    black: '#1f1f1f',
    red: '#ff6b6b',
    green: '#9bdb74',
    yellow: '#f0c674',
    blue: '#7eb8da',
    magenta: '#c693cc',
    cyan: '#7fdbca',
    white: '#cccccc',
    brightBlack: '#666666',
    brightRed: '#ff8a8a',
    brightGreen: '#bbe080',
    brightYellow: '#ffd966',
    brightBlue: '#9fcdea',
    brightMagenta: '#d9a4d9',
    brightCyan: '#9be7d7',
    brightWhite: '#ffffff',
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      cursorBlink: true,
      convertEol: true,
      allowProposedApi: true,
      theme,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    try { fit.fit(); } catch (_) {}
    termRef.current = term;
    fitRef.current = fit;

    const ws = new WebSocket(PTY_WS_URL);
    wsRef.current = ws;

    let opened = false;
    ws.addEventListener('open', () => {
      opened = true;
      try { fit.fit(); } catch (_) {}
      const cols = term.cols || 80;
      const rows = term.rows || 24;
      ws.send(JSON.stringify({ type: 'spawn', cwd: cwdRef.current || undefined, cols, rows }));
    });

    ws.addEventListener('message', (event) => {
      let frame: any;
      try { frame = JSON.parse(typeof event.data === 'string' ? event.data : ''); } catch { return; }
      if (!frame || typeof frame !== 'object') return;
      if (frame.type === 'data' && typeof frame.data === 'string') {
        term.write(frame.data);
      } else if (frame.type === 'exit') {
        term.write(`\r\n\x1b[33m[process exited${typeof frame.exitCode === 'number' ? ` code=${frame.exitCode}` : ''}]\x1b[0m\r\n`);
      } else if (frame.type === 'error' && typeof frame.message === 'string') {
        term.write(`\r\n\x1b[31m[pty error] ${frame.message}\x1b[0m\r\n`);
      }
    });

    ws.addEventListener('close', () => {
      if (!opened) term.write('\r\n\x1b[31m[failed to connect to PTY service]\x1b[0m\r\n');
    });

    const dataDisp = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const sendResize = () => {
      try { fit.fit(); } catch (_) {}
      if (ws.readyState !== WebSocket.OPEN) return;
      const cols = term.cols || 80;
      const rows = term.rows || 24;
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    const ro = new ResizeObserver(() => sendResize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      dataDisp.dispose();
      try { ws.close(); } catch (_) {}
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
  }, [theme]);

  return (
    <div className="h-full w-full bg-[#1f1f1f] p-[8px]">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
