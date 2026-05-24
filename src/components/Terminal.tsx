import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useAppStore } from '../store';

interface TerminalProps {
  className?: string;
  files?: Record<string, string>;
}

export const Terminal: React.FC<TerminalProps> = ({ className, files = {} }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const inputBuffer = useRef<string>('');
  const terminalLogs = useAppStore(state => state.terminalLogs);
  const lastLogIndex = useRef<number>(0);

  useEffect(() => {
    if (xtermRef.current && terminalLogs.length > lastLogIndex.current) {
      for (let i = lastLogIndex.current; i < terminalLogs.length; i++) {
        xtermRef.current.writeln(terminalLogs[i]);
      }
      lastLogIndex.current = terminalLogs.length;
    }
  }, [terminalLogs]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 11,
      fontFamily: '"JetBrains Mono", monospace',
      theme: {
        background: '#0D0D10',
        foreground: '#E0E0E0',
        cursor: '#FFFFFF',
        selectionBackground: 'rgba(255, 255, 255, 0.2)',
        black: '#1E1E22',
        red: '#EF4444',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#3B82F6',
        magenta: '#8B5CF6',
        cyan: '#06B6D4',
        white: '#E0E0E0',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    term.writeln('\x1b[1;37mLOGIC ENGINE [ONLINE]\x1b[0m');
    term.writeln('\x1b[90mConnected to production-cdn.logic.io\x1b[0m');
    term.writeln('');
    term.write('\x1b[1;32mroot\x1b[0m \x1b[1;34m~\x1b[0m # ');

    lastLogIndex.current = 0; // Reset index for new terminal instance
    
    // Initial logs if any
    terminalLogs.forEach(log => term.writeln(log));
    lastLogIndex.current = terminalLogs.length;

    const handleData = (data: string) => {
      const code = data.charCodeAt(0);
      
      if (code === 13) { // Enter
        const command = inputBuffer.current.trim();
        term.write('\r\n');
        executeCommand(command);
        inputBuffer.current = '';
        term.write('\x1b[1;32mweb-shell\x1b[0m \x1b[1;34m~\x1b[0m $ ');
      } else if (code === 127) { // Backspace
        if (inputBuffer.current.length > 0) {
          inputBuffer.current = inputBuffer.current.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data.length === 1 && code >= 32 && code <= 126) { // Printable characters
        inputBuffer.current += data;
        term.write(data);
      }
    };

    const executeCommand = (cmd: string) => {
      const args = cmd.split(' ');
      const command = args[0].toLowerCase();

      switch (command) {
        case '':
          break;
        case 'help':
          term.writeln('Available commands:');
          term.writeln('  \x1b[1;36mhelp\x1b[0m     Display this help message');
          term.writeln('  \x1b[1;36mls\x1b[0m       List files in the current project');
          term.writeln('  \x1b[1;36mclear\x1b[0m    Clear the terminal screen');
          term.writeln('  \x1b[1;36mecho\x1b[0m     Print text to the terminal');
          term.writeln('  \x1b[1;36mwhoami\x1b[0m   Display current user info');
          term.writeln('  \x1b[1;36mdate\x1b[0m     Display current date and time');
          term.writeln('  \x1b[1;36mrun\x1b[0m      Trigger a preview refresh');
          break;
        case 'ls':
          const fileList = Object.keys(files);
          fileList.forEach(f => {
             const name = f.startsWith('/') ? f.slice(1) : f;
             term.writeln(name);
          });
          break;
        case 'clear':
          term.clear();
          break;
        case 'echo':
          term.writeln(args.slice(1).join(' '));
          break;
        case 'whoami':
          term.writeln('ai-builder-user');
          break;
        case 'date':
          term.writeln(new Date().toString());
          break;
        case 'run':
          term.writeln('Refreshing preview...');
          break;
        default:
          term.writeln(`web-shell: command not found: ${command}`);
      }
    };

    const dispose = term.onData(handleData);

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      dispose.dispose();
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [files]);

  return (
    <div className={`w-full h-full p-2 bg-[#0D0D10] ${className}`}>
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
};
