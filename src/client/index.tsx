import React, { useEffect, useState, useRef } from "react";
import { render } from "react-dom";

/**
 * mIRC-Style Client Logic
 */

const ChatApp = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Determine WebSocket protocol (ws or wss)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.host;
    const socket = new WebSocket(`${protocol}//${hostname}/ws`);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, data]);
    };

    socketRef.current = socket;

    return () => socket.close();
  }, []);

  // Auto-scroll to bottom like mIRC
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;

    // CRITICAL: Send as JSON so the server's JSON.parse() works
    const payload = JSON.stringify({ text: input });
    socketRef.current.send(payload);

    setInput("");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages Area */}
      <div 
        ref={chatWindowRef}
        style={{ flex: 1, overflowY: 'auto', padding: '10px' }}
      >
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.system ? 'system' : ''}`}>
            {m.system ? (
              <span style={{ color: '#00ffff' }}>*** {m.system}</span>
            ) : (
              <>
                <span className={m.name?.startsWith('&') ? 'admin' : m.name?.startsWith('@') ? 'op' : ''} 
                      style={{ 
                        fontWeight: 'bold', 
                        color: m.name?.startsWith('&') ? '#ff00ff' : m.name?.startsWith('@') ? '#ff0000' : '#00ff00' 
                      }}>
                  &lt;{m.name}&gt;
                </span>
                <span style={{ marginLeft: '8px' }}>{m.text}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <form onSubmit={sendMessage} style={{ display: 'flex', background: '#c0c0c0', padding: '2px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            flex: 1,
            background: '#fff',
            color: '#000',
            border: '2px inset #808080',
            padding: '4px',
            fontFamily: '"Fixedsys", "Courier New", monospace'
          }}
          placeholder="Type a message or command (/identify, /nick, etc.)..."
          autoFocus
        />
      </form>
    </div>
  );
};

// Target the 'root' div from your index.html
const rootElement = document.getElementById("root");
if (rootElement) {
  render(<ChatApp />, rootElement);
}
