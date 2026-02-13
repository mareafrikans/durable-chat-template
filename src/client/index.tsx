  return (
    <div className="mirc-container">
      {/* 1. TOPIC BAR */}
      <div className="mirc-topic-bar">
        <span className="topic-label">Topic:</span> {topic}
      </div>
      
      <div className="mirc-main">
        {/* 2. CHAT WINDOW (The Messages) */}
        <div className="mirc-chat-window">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.system ? 'system' : ''}`}>
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

        {/* 3. USER SIDEBAR */}
        <div className="mirc-sidebar">
          <div className="user-count">{users.length} Users</div>
          {users.map((user, i) => (
            <div key={i} className="user-item">@{user}</div>
          ))}
        </div>
      </div>

      {/* 4. INPUT AREA (The Command Line) */}
      <div className="mirc-input-area">
        <span className="status-nick">[Status: {localStorage.getItem('chat-nick') || 'Guest'}]</span>
        <input 
          type="text" 
          autoFocus
          placeholder="Type message or /command..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = e.currentTarget.value;
              if (!val) return;
              // Add your socket.send(val) logic here
              e.currentTarget.value = '';
            }
          }}
        />
      </div>

      {/* 5. THE CSS (Crucial for the UI to appear) */}
      <style>{`
        .mirc-container { display: flex; flex-direction: column; height: 100vh; background: #000; font-family: "Fixedsys", monospace; }
        .mirc-topic-bar { background: #000080; color: #fff; padding: 4px; border: 2px outset #fff; font-size: 14px; }
        .mirc-main { display: flex; flex: 1; overflow: hidden; border: 2px inset #fff; }
        .mirc-chat-window { flex: 1; overflow-y: auto; padding: 10px; background: #000; color: #fff; line-height: 1.2; }
        .mirc-sidebar { width: 150px; background: #c0c0c0; color: #000; border-left: 2px outset #fff; padding: 5px; overflow-y: auto; }
        .mirc-input-area { display: flex; background: #c0c0c0; padding: 2px; border-top: 2px outset #fff; align-items: center; }
        .status-nick { color: #000; padding: 0 5px; font-weight: bold; font-size: 12px; }
        .mirc-input-area input { flex: 1; background: #fff; border: 2px inset #808080; padding: 4px; outline: none; font-family: inherit; }
        .system-text { color: #00ff00; }
        .nick { color: #ffff00; margin-right: 8px; font-weight: bold; }
        .timestamp { color: #aaa; margin-right: 5px; font-size: 12px; }
      `}</style>
    </div>
  );
