import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const ChatApp = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/websocket`);
    socketRef.current = socket;

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.userList) setUsers(data.userList);
      if (data.user || data.system || data.text) {
        setMessages((prev) => [...prev, data]);
      }
    };
    return () => socket.close();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    socketRef.current?.send(JSON.stringify({ text: input }));
    setInput("");
  };

  return (
    <div className="mirc-window">
      <div className="mirc-title">#DurableChannel [{users.length}]</div>
      
      <div className="mirc-container">
        <div className="chat-window" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className="line">
              {m.system ? (
                <span className="system-txt">*** {m.system}</span>
              ) : (
                <><span className="nick">&lt;{m.user}&gt;</span> {m.text}</>
              )}
            </div>
          ))}
        </div>
        
        <div className="sidebar">
          <div className="sb-header">Names</div>
          {users.map((u, i) => <div key={i} className="sb-user">{u}</div>)}
        </div>
      </div>

      <div className="input-bar">
        <input 
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type command or message..."
        />
        <button onClick={handleSend} className="send-btn">Send</button>
      </div>

      <style>{`
        .mirc-window { display: flex; flex-direction: column; height: 100vh; background: #000; color: #fff; font-family: "Fixedsys", monospace; overflow: hidden; }
        .mirc-title { background: #000080; padding: 6px; border: 2px outset #fff; font-weight: bold; font-size: 14px; }
        .mirc-container { display: flex; flex: 1; overflow: hidden; border: 2px inset #fff; }
        
        .chat-window { flex: 1; overflow-y: auto; padding: 10px; font-size: 14px; line-height: 1.2; }
        .sidebar { width: 140px; background: #c0c0c0; color: #000; border-left: 2px outset #fff; padding: 5px; overflow-y: auto; }
        
        .input-bar { display: flex; background: #c0c0c0; padding: 4px; border-top: 2px outset #fff; gap: 4px; }
        .input-bar input { flex: 1; border: 2px inset #808080; padding: 8px; outline: none; font-size: 16px; font-family: inherit; }
        .send-btn { background: #c0c0c0; border: 2px outset #fff; padding: 0 15px; font-weight: bold; cursor: pointer; }

        .line { margin-bottom: 2px; word-break: break-all; }
        .nick { color: #ffff00; font-weight: bold; margin-right: 8px; }
        .system-txt { color: #00ff00; }
        .sb-header { font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 5px; font-size: 12px; }
        .sb-user { font-size: 13px; margin-bottom: 2px; }

        /* RESPONSIVE FIXES */
        @media (max-width: 600px) {
          .sidebar { width: 80px; font-size: 11px; }
          .sb-header { font-size: 10px; }
          .chat-window { font-size: 13px; }
          .send-btn { display: none; } /* Hide send button to save width, use Enter */
        }
      `}</style>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<ChatApp />);
