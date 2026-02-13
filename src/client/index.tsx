import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const ChatApp = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [topic, setTopic] = useState("mIRC Web: Loading...");
  const [input, setInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Determine WebSocket protocol based on page location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/websocket`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.topic) setTopic(data.topic);
      if (data.userList) setUsers(data.userList);
      if (data.text || data.system) setMessages((prev) => [...prev, data]);
    };

    return () => socket.close();
  }, []);

  const sendMessage = () => {
    if (!input || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({ text: input }));
    setInput("");
  };

  return (
    <div className="mirc-container">
      <div className="mirc-topic-bar">
        <span className="topic-label">Topic:</span> {topic}
      </div>
      
      <div className="mirc-main">
        <div className="mirc-chat-window">
          {messages.map((msg, i) => (
            <div key={i} className="message-line">
              {msg.system ? (
                <span className="system-text">*** {msg.system}</span>
              ) : (
                <>
                  <span className="timestamp">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                  <span className="nick">&lt;{msg.user}&gt;</span>
                  <span className="text">{msg.text}</span>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mirc-sidebar">
          <div className="user-count">{users.length} Users</div>
          {users.map((u, i) => <div key={i} className="user-item">@{u}</div>)}
        </div>
      </div>

      <div className="mirc-input-area">
        <span className="status-label">[Status]</span>
        <input 
          autoFocus 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type message..."
        />
      </div>

      <style>{`
        .mirc-container { display: flex; flex-direction: column; height: 100vh; background: #000; font-family: monospace; color: #fff; }
        .mirc-topic-bar { background: #000080; padding: 4px; border: 2px outset #fff; font-weight: bold; }
        .topic-label { color: #ffff00; margin-right: 10px; }
        .mirc-main { display: flex; flex: 1; overflow: hidden; border: 2px inset #fff; }
        .mirc-chat-window { flex: 1; overflow-y: auto; padding: 10px; font-size: 14px; }
        .mirc-sidebar { width: 150px; background: #c0c0c0; color: #000; border-left: 2px outset #fff; padding: 5px; }
        .user-count { font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 5px; }
        .mirc-input-area { display: flex; background: #c0c0c0; padding: 3px; border-top: 2px outset #fff; align-items: center; }
        .status-label { color: #000; font-weight: bold; padding: 0 10px; }
        .mirc-input-area input { flex: 1; border: 2px inset #808080; padding: 4px; outline: none; }
        .system-text { color: #00ff00; }
        .nick { color: #ffff00; font-weight: bold; margin-right: 8px; }
        .timestamp { color: #aaa; margin-right: 5px; }
      `}</style>
    </div>
  );
};

// MANDATORY: The entry point that injects the app into your HTML
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ChatApp />);
}
