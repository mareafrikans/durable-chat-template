import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const ChatApp = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/websocket`);
    socketRef.current = socket;
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.userList) setUsers(data.userList);
      if (data.user || data.system) setMessages(p => [...p, data]);
    };
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000', color: '#fff', fontFamily: 'monospace' }}>
      <div style={{ background: '#000080', padding: '5px', border: '1px solid #fff' }}>#mIRC_Channel</div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ color: m.pvt ? '#f0f' : '#fff' }}>
              {m.system ? <span style={{ color: '#0f0' }}>{m.system}</span> : <><b style={{ color: '#ff0' }}>{m.user}</b> {m.text}</>}
            </div>
          ))}
        </div>
        <div style={{ width: '150px', background: '#c0c0c0', color: '#000', padding: '5px', borderLeft: '2px solid #fff' }}>
          <b>Users ({users.length})</b>
          {users.map((u, i) => <div key={i}>{u}</div>)}
        </div>
      </div>
      <div style={{ background: '#c0c0c0', padding: '5px' }}>
        <input 
          style={{ width: '100%' }} 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && (socketRef.current?.send(JSON.stringify({ text: input })), setInput(""))} 
        />
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<ChatApp />);
