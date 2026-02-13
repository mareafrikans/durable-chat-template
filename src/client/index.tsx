import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const ChatApp = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [activeChannel, setActiveChannel] = useState("#main");
  const [users, setUsers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/websocket`);
    socketRef.current = socket;
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.userList) setUsers(data.userList);
      if (data.joinChannel) setActiveChannel(data.joinChannel);
      if (data.user || data.system || data.image) {
        setMessages(prev => [...prev, data]);
      }
    };
  }, []);

  // Component for Self-Destructing Image
  const SelfDestructImage = ({ src, seconds }: { src: string, seconds: number }) => {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
      const timer = setTimeout(() => setVisible(false), seconds * 1000);
      return () => clearTimeout(timer);
    }, []);
    return visible ? <img src={src} className="destruct-img" /> : <span className="expired">[Image Expired]</span>;
  };

  return (
    <div className="mirc-window">
      <div className="mirc-title">#DurableIRC Network - {activeChannel}</div>
      <div className="mirc-container">
        <div className="chat-window">
          {messages.map((m, i) => (
            <div key={i} className="line">
              {m.system ? <span className="sys">*** {m.system}</span> : 
               m.image ? <><span className="nick">&lt;{m.user}&gt;</span> <SelfDestructImage src={m.image} seconds={10} /></> :
               <><span className="nick">&lt;{m.user}&gt;</span> {m.text}</>}
            </div>
          ))}
        </div>
        <div className="sidebar">
          <b>Names</b>
          {users.map((u, i) => <div key={i}>{u}</div>)}
        </div>
      </div>
      <div className="input-bar">
        <input 
          autoFocus 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (socketRef.current?.send(JSON.stringify({ text: input, channel: activeChannel })), setInput(""))}
          placeholder="Type command /help or message..."
        />
      </div>
      <style>{`
        .mirc-window { display: flex; flex-direction: column; height: 100vh; background: #000; color: #fff; font-family: monospace; }
        .mirc-container { display: flex; flex: 1; overflow: hidden; }
        .chat-window { flex: 1; overflow-y: auto; padding: 10px; }
        .sidebar { width: 140px; background: #c0c0c0; color: #000; padding: 5px; }
        .input-bar { background: #c0c0c0; padding: 4px; }
        .input-bar input { width: 100%; border: 2px inset #808080; padding: 6px; }
        .nick { color: #ffff00; font-weight: bold; }
        .sys { color: #00ff00; }
        .destruct-img { max-width: 200px; border: 2px solid red; display: block; margin: 5px 0; }
        .expired { font-style: italic; color: #888; }
        @media (max-width: 600px) { .sidebar { display: none; } }
      `}</style>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<ChatApp />);
