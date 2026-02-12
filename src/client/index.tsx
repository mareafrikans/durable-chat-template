import React, { useEffect, useState, useRef } from "react";
import { render } from "react-dom";

interface ChatMessage {
  name?: string;
  text?: string;
  system?: string;
  userList?: string[]; // Server will send this to update the sidebar
}

const ChatApp = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.onmessage = (event) => {
      const data: ChatMessage = JSON.parse(event.data);
      
      // If the message contains a userList update, handle it
      if (data.userList) {
        setUsers(data.userList);
      } else {
        setMessages((prev) => [...prev, data]);
      }
    };

    socketRef.current = socket;
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({ text: input }));
    setInput("");
  };

  return (
    <div className="mirc-wrapper">
      <div className="main-layout">
        {/* Chat Window */}
        <div className="chat-area" ref={chatWindowRef}>
          {messages.map((m, i) => (
            <div key={i} className="msg-row">
              {m.system ? (
                <span className="system-msg">*** {m.system}</span>
              ) : (
                <>
                  <span className={`nick ${m.name?.startsWith('@') ? 'admin-nick' : m.name?.startsWith('+') ? 'mod-nick' : ''}`}>
                    &lt;{m.name}&gt;
                  </span>
                  <span className="text-msg">{m.text}</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* User List Sidebar */}
        <div className="user-sidebar">
          <div className="sidebar-header">Users ({users.length})</div>
          {users.map((u, i) => (
            <div key={i} className={`user-item ${u.startsWith('@') ? 'admin-text' : u.startsWith('+') ? 'mod-text' : ''}`}>
              {u}
            </div>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <form onSubmit={sendMessage} className="input-form">
        <div className="status-indicator">#mIRC</div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type message or command (/identify, /nick, /op)..."
          autoFocus
        />
      </form>

      <style>{`
        .mirc-wrapper { display: flex; flex-direction: column; height: 100vh; background: #000; color: #fff; font-family: "Courier New", monospace; }
        .main-layout { display: flex; flex: 1; overflow: hidden; }
        
        /* Responsive Chat Area */
        .chat-area { flex: 1; overflow-y: auto; padding: 10px; border-right: 1px solid #333; }
        
        /* User Sidebar */
        .user-sidebar { width: 150px; background: #000; border-left: 1px solid #333; padding: 10px; font-size: 0.9em; }
        .sidebar-header { border-bottom: 1px solid #444; margin-bottom: 5px; color: #aaa; padding-bottom: 3px; }
        
        /* Input Bar */
        .input-form { display: flex; background: #c0c0c0; padding: 3px; border-top: 2px solid #808080; }
        .status-indicator { background: #000080; color: #fff; padding: 2px 8px; margin-right: 4px; font-size: 12px; display: flex; align-items: center; }
        .input-form input { flex: 1; border: 2px inset #808080; padding: 5px; outline: none; font-family: inherit; }

        /* Nickname Colors */
        .msg-row { margin-bottom: 3px; word-wrap: break-word; }
        .nick { font-weight: bold; margin-right: 8px; }
        .admin-nick, .admin-text { color: #ff0000; } /* @ Admin = Red */
        .mod-nick, .mod-text { color: #ffff00; }   /* + Mod = Yellow */
        .system-msg { color: #00ffff; }            /* System = Cyan */
        .text-msg { color: #ffffff; }

        /* Responsive Breakpoints */
        @media (max-width: 600px) {
          .main-layout { flex-direction: column; }
          .user-sidebar { width: 100%; height: 100px; border-left: 0; border-top: 1px solid #333; }
          .status-indicator { display: none; }
        }
      `}</style>
    </div>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) render(<ChatApp />, rootElement);
