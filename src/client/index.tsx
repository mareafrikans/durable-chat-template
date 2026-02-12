import React, { useEffect, useState, useRef } from "react";
import { render } from "react-dom";

interface ChatMessage {
  name?: string;
  text?: string;
  system?: string;
  userList?: string[];
}

const ChatApp = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.onmessage = (event) => {
      const data: ChatMessage = JSON.parse(event.data);
      if (data.userList) {
        setUsers(data.userList);
      } else {
        setMessages((prev) => [...prev, data]);
      }
    };

    socketRef.current = socket;
    return () => socket.close();
  }, []);

  // Live Auto-Scroll Logic
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({ text: input }));
    setInput("");
  };

  return (
    <div className="mirc-container">
      <div className="mirc-main">
        {/* Chat Window */}
        <div className="mirc-chat">
          {messages.map((m, i) => (
            <div key={i} className="mirc-row">
              {m.system ? (
                <span className="mirc-sys">*** {m.system}</span>
              ) : (
                <>
                  <span className={`mirc-nick ${m.name?.startsWith('@') ? 'adm' : m.name?.startsWith('+') ? 'mod' : ''}`}>
                    &lt;{m.name}&gt;
                  </span>
                  <span className="mirc-text">{m.text}</span>
                </>
              )}
            </div>
          ))}
          {/* Scroll Anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Unified Sidebar */}
        <div className="mirc-sidebar">
          <div className="sidebar-title">Names</div>
          {users.map((u, i) => (
            <div key={i} className={`sidebar-user ${u.startsWith('@') ? 'adm' : u.startsWith('+') ? 'mod' : ''}`}>
              {u}
            </div>
          ))}
        </div>
      </div>

      {/* Unified Command Line */}
      <form onSubmit={sendMessage} className="mirc-input-area">
        <div className="mirc-prefix">#chat</div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command or message..."
          autoFocus
        />
      </form>

      <style>{`
        .mirc-container { display: flex; flex-direction: column; height: 100vh; background: #000; color: #fff; font-family: "Courier New", Courier, monospace; }
        .mirc-main { display: flex; flex: 1; overflow: hidden; }
        
        .mirc-chat { flex: 1; overflow-y: auto; padding: 10px; border-right: 1px solid #333; }
        .mirc-sidebar { width: 160px; background: #000; padding: 10px; font-size: 14px; overflow-y: auto; }
        .sidebar-title { color: #888; border-bottom: 1px solid #444; margin-bottom: 8px; padding-bottom: 4px; font-weight: bold; }
        
        .mirc-input-area { display: flex; background: #c0c0c0; padding: 4px; border-top: 1px solid #fff; }
        .mirc-prefix { background: #000080; color: #fff; padding: 2px 10px; margin-right: 5px; display: flex; align-items: center; font-size: 12px; }
        .mirc-input-area input { flex: 1; border: 2px inset #808080; padding: 6px; font-family: inherit; font-size: 16px; outline: none; }

        .mirc-row { margin-bottom: 2px; line-height: 1.2; word-break: break-word; }
        .mirc-nick { font-weight: bold; margin-right: 10px; }
        .mirc-sys { color: #00ffff; }
        .adm { color: #ff0000; } /* Admin @ Red */
        .mod { color: #ffff00; } /* Mod + Yellow */
        .sidebar-user { margin-bottom: 2px; }

        @media (max-width: 768px) {
          .mirc-sidebar { display: none; } /* Hide sidebar on mobile to save space */
          .mirc-prefix { display: none; }
        }
      `}</style>
    </div>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) render(<ChatApp />, rootElement);
