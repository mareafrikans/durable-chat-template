import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const ChatApp = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [topic, setTopic] = useState("Connecting...");
  const [input, setInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/websocket`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.topic) setTopic(data.topic);
      if (data.userList) setUsers(data.userList);
      if (data.user || data.text || data.system) {
        setMessages((prev) => [...prev, data]);
      }
    };

    return () => socket.close();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    socketRef.current?.send(JSON.stringify({ text: input }));
    setInput("");
  };

  return (
    <div className="mirc-container">
      <div className="mirc-header">
        <span className="topic-tag">Topic:</span> {topic}
      </div>
      
      <div className="mirc-body">
        <div className="mirc-chat" ref={scrollRef}>
          {messages.map((msg, i) => (
            <div key={i} className="line">
              {msg.system ? (
                <span className="sys">*** {msg.system}</span>
              ) : (
                <>
                  <span className="nick">&lt;{msg.user}&gt;</span>
                  <span className="text">{msg.text}</span>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="mirc-sidebar">
          <div className="sidebar-count">{users.length} Users</div>
          {users.map((u, i) => <div key={i} className="user">@{u}</div>)}
        </div>
      </div>

      <div className="mirc-footer">
        <span className="status-label">Status</span>
        <input 
          autoFocus 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type /help for list of commands..."
        />
      </div>

      <style>{`
        * { box-sizing: border-box; }
        .mirc-container { display: flex; flex-direction: column; height: 100vh; background: #000; color: #fff; font-family: "Fixedsys", monospace; }
        .mirc-header { background: #000080; border: 2px outset #fff; padding: 5px; font-weight: bold; white-space: nowrap; overflow: hidden; }
        .topic-tag { color: #ffff00; margin-right: 10px; }
        .mirc-body { display: flex; flex: 1; overflow: hidden; border: 2px inset #fff; }
        .mirc-chat { flex: 1; overflow-y: auto; padding: 10px; font-size: 14px; background: #000; }
        .mirc-sidebar { width: 150px; background: #c0c0c0; color: #000; border-left: 2px outset #fff; padding: 5px; overflow-y: auto; }
        .mirc-footer { display: flex; background: #c0c0c0; padding: 3px; border-top: 2px outset #fff; align-items: center; }
        .status-label { color: #000; padding: 0 10px; font-weight: bold; font-size: 12px; }
        .mirc-footer input { flex: 1; border: 2px inset #808080; padding: 6px; outline: none; font-size: 14px; }
        
        .line { margin-bottom: 2px; line-height: 1.2; word-break: break-word; }
        .sys { color: #00ff00; }
        .nick { color: #ffff00; font-weight: bold; margin-right: 8px; }
        .sidebar-count { border-bottom: 1px solid #000; margin-bottom: 5px; font-weight: bold; }

        /* MOBILE OPTIMIZATION */
        @media (max-width: 768px) {
          .mirc-sidebar { display: none; } /* Hide user list on mobile to maximize chat space */
          .mirc-footer input { font-size: 16px; } /* Prevent iOS zoom */
          .status-label { display: none; }
          .mirc-header { font-size: 12px; }
        }
      `}</style>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<ChatApp />);
