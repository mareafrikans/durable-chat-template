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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({ text: input }));
    setInput("");
  };

  return (
    <div className="mirc-window">
      <div className="mirc-title">#DurableIRC: {users.length} users online</div>
      <div className="mirc-main">
        <div className="chat-window" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className="line">
              {m.system ? (
                <span className="system-txt">*** {m.system}</span>
              ) : (
                <>
                  <span className="nick" style={{ color: m.pvt ? '#ff00ff' : '#ffff00' }}>
                    &lt;{m.user}&gt;
                  </span>{' '}
                  <span className="text">{m.text}</span>
                </>
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
        <span className="status-lbl">Status</span>
        <input 
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type /help for mIRC commands..."
        />
      </div>
      <style>{`
        .mirc-window { display: flex; flex-direction: column; height: 100vh; background: #000; color: #fff; font-family: monospace; }
        .mirc-title { background: #000080; padding: 4px; border: 2px outset #fff; font-weight: bold; }
        .mirc-main { display: flex; flex: 1; overflow: hidden; border: 2px inset #fff; }
        .chat-window { flex: 1; overflow-y: auto; padding: 10px; font-size: 14px; background: #000; }
        .sidebar { width: 160px; background: #c0c0c0; color: #000; border-left: 2px outset #fff; padding: 5px; overflow-y: auto; }
        .input-bar { display: flex; background: #c0c0c0; padding: 3px; border-top: 2px outset #fff; align-items: center; }
        .status-lbl { color: #000; font-weight: bold; padding: 0 10px; font-size: 12px; }
        .input-bar input { flex: 1; border: 2px inset #808080; padding: 5px; outline: none; }
        .nick { font-weight: bold; margin-right: 8px; }
        .system-txt { color: #00ff00; }
        .sb-header { font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 5px; }
        @media (max-width: 600px) {
          .sidebar { width: 100px; font-size: 12px; }
          .chat-window { font-size: 12px; }
        }
      `}</style>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<ChatApp />);
