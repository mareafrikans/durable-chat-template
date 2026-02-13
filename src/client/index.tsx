import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const ChatApp = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [topic, setTopic] = useState("mIRC Durable Network");
  const [input, setInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/websocket`);
    socketRef.current = socket;
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.topic) setTopic(data.topic);
      if (data.userList) setUsers(data.userList);
      if (data.user || data.system) setMessages(p => [...p, data]);
    };
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!input) return;
    socketRef.current?.send(JSON.stringify({ text: input }));
    setInput("");
  };

  return (
    <div className="mirc-window">
      <div className="mirc-title">#Channel: {topic}</div>
      <div className="mirc-container">
        <div className="chat-area" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className="line">
              {m.system ? <span className="sys">{m.system}</span> : <><span className="nick" style={{color: m.pvt ? '#ff00ff' : '#ffff00'}}>{m.user}</span> {m.text}</>}
            </div>
          ))}
        </div>
        <div className="sidebar">
          <div className="sb-head">{users.length} Users</div>
          {users.map((u, i) => <div key={i} className="sb-user">{u}</div>)}
        </div>
      </div>
      <div className="input-bar">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type /help..." />
      </div>
      <style>{`
        .mirc-window { display: flex; flex-direction: column; height: 100vh; background: #000; color: #fff; font-family: monospace; }
        .mirc-title { background: #000080; padding: 5px; border: 2px outset #fff; }
        .mirc-container { display: flex; flex: 1; overflow: hidden; border: 2px inset #fff; }
        .chat-area { flex: 1; overflow-y: auto; padding: 10px; font-size: 14px; }
        .sidebar { width: 140px; background: #c0c0c0; color: #000; border-left: 2px outset #fff; padding: 5px; overflow-y: auto; }
        .input-bar { background: #c0c0c0; padding: 4px; border-top: 2px outset #fff; }
        .input-bar input { width: 100%; border: 2px inset #808080; padding: 5px; outline: none; }
        .nick { font-weight: bold; margin-right: 8px; }
        .sys { color: #00ff00; }
        .sb-user { font-size: 13px; }
        @media (max-width: 600px) { .sidebar { width: 80px; font-size: 11px; } .chat-area { font-size: 12px; } }
      `}</style>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<ChatApp />);
