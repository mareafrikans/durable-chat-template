const ChatApp = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [topic, setTopic] = useState("Loading topic...");
  // ... other hooks ...

  useEffect(() => {
    // ... socket initialization ...
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.topic) setTopic(data.topic); // Update topic bar live
      if (data.userList) setUsers(data.userList);
      if (data.text || data.system) setMessages((prev) => [...prev, data]);
    };
  }, []);

  return (
    <div className="mirc-container">
      {/* NEW: Persistent Topic Bar */}
      <div className="mirc-topic-bar">
        <span className="topic-label">Topic:</span> {topic}
      </div>
      
      <div className="mirc-main">
        {/* ... chat and sidebar components ... */}
      </div>

      <style>{`
        .mirc-topic-bar { 
          background: #000080; color: #fff; padding: 4px 10px; 
          border-bottom: 1px solid #fff; font-size: 13px; 
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .topic-label { font-weight: bold; color: #ffff00; margin-right: 5px; }
        /* ... existing styles ... */
      `}</style>
    </div>
  );
};
