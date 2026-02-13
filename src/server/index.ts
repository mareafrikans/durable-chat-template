import { DurableObject } from "cloudflare:workers";

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, { name: string; level: string }>();
  private topic: string = "mIRC Durable Network v2026";
  private silentMode: boolean = false;

  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    // Modern DO WebSocket Hibernation API
    this.ctx.acceptWebSocket(server);
    
    const nick = "Guest" + Math.floor(Math.random() * 1000);
    this.sessions.set(server, { name: nick, level: "user" });
    
    this.broadcast({ system: `* Joins: ${nick}` });
    this.broadcastUserList();
    
    return new Response(null, { status: 101, webSocket: client });
  }

  // FIXED: Modern entry point for messages
  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    const session = this.sessions.get(ws);
    if (!session || !data.text) return;

    const text = data.text.trim();

    // COMMAND HANDLING
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      switch (cmd) {
        case "/help":
          ws.send(JSON.stringify({ system: "Commands: /nick <name>, /msg <nick> <msg>, /op <pass>, /silent <on/off>, /quit" }));
          break;
        case "/nick":
          const old = session.name;
          session.name = args.replace(/[^\w]/g, "").substring(0, 12) || session.name;
          this.broadcast({ system: `* ${old} is now ${session.name}` });
          this.broadcastUserList();
          break;
        case "/msg":
          const [tNick, ...mParts] = args.split(" ");
          const mText = mParts.join(" ");
          const targetEntry = Array.from(this.sessions.entries()).find(([_, s]) => s.name === tNick);
          if (targetEntry) {
            const p = JSON.stringify({ user: `-> *${session.name}*`, text: mText, pvt: true });
            targetEntry[0].send(p); // Send to target
            ws.send(p); // Send to sender
          }
          break;
        case "/op":
          if (args === "7088AB") { 
            session.level = "admin"; 
            ws.send(JSON.stringify({ system: "You are now @Operator" }));
            this.broadcastUserList(); 
          }
          break;
        case "/silent":
          if (session.level === "admin") {
            this.silentMode = (args === "on");
            this.broadcast({ system: `*** Channel is now ${this.silentMode ? "SILENT (+m)" : "OPEN (-m)"}` });
          }
          break;
        case "/quit":
          this.broadcast({ system: `* Quits: ${session.name}` });
          ws.close();
          break;
      }
      return;
    }

    // BROADCAST LOGIC
    if (this.silentMode && session.level === "user") {
      ws.send(JSON.stringify({ system: "Channel is +m. Only @ can talk." }));
      return;
    }

    const prefix = session.level === "admin" ? "@" : "";
    this.broadcast({ user: prefix + session.name, text });
  }

  async webSocketClose(ws: WebSocket) {
    const s = this.sessions.get(ws);
    if (s) {
      this.broadcast({ system: `* Parts: ${s.name}` });
      this.sessions.delete(ws);
      this.broadcastUserList();
    }
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data);
    // Correct way to broadcast to all connected DO WebSockets
    this.ctx.getWebSockets().forEach(ws => {
      try { ws.send(payload); } catch (e) {}
    });
  }

  private broadcastUserList() {
    const users = Array.from(this.sessions.values()).map(s => (s.level === "admin" ? "@" : "") + s.name);
    this.broadcast({ userList: users });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("mirc-broadcast-fixed");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
