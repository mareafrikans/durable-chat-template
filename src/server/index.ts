import { DurableObject } from "cloudflare:workers";

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, { name: string; level: string }>();
  private silentMode: boolean = false;

  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    // Register the connection for hibernation
    this.ctx.acceptWebSocket(server);
    
    const nick = "Guest" + Math.floor(Math.random() * 1000);
    this.sessions.set(server, { name: nick, level: "user" });
    
    this.broadcast({ system: `* Joins: ${nick}` });
    this.broadcastUserList();
    
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    const session = this.sessions.get(ws);
    if (!session || !data.text) return;

    const text = data.text.trim();

    // Command Logic
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      switch (cmd) {
        case "/nick":
          const old = session.name;
          session.name = args.replace(/[^\w]/g, "").substring(0, 12) || session.name;
          this.broadcast({ system: `* ${old} is now ${session.name}` });
          this.broadcastUserList();
          break;
        case "/msg":
          const [tNick, ...mParts] = args.split(" ");
          // Find target using the sessions map
          const targetEntry = Array.from(this.sessions.entries()).find(([_, s]) => s.name === tNick);
          if (targetEntry) {
            const p = JSON.stringify({ user: `-> *${session.name}*`, text: mParts.join(" "), pvt: true });
            targetEntry[0].send(p); // Send to target WebSocket
            ws.send(p); // Send back to sender
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
            this.broadcast({ system: `*** Channel mode is now ${this.silentMode ? "+m (Silent)" : "-m"}` });
          }
          break;
        case "/help":
          ws.send(JSON.stringify({ system: "Commands: /nick, /msg <nick> <msg>, /op <pass>, /silent <on/off>, /quit" }));
          break;
        case "/quit":
          this.broadcast({ system: `* Quits: ${session.name}` });
          ws.close();
          break;
      }
      return;
    }

    // Standard Broadcast
    if (this.silentMode && session.level === "user") {
        ws.send(JSON.stringify({ system: "Channel is +m. Only @ and + can talk." }));
        return;
    }
    const pfx = session.level === "admin" ? "@" : "";
    this.broadcast({ user: pfx + session.name, text });
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
    // ctx.getWebSockets() is the ONLY way to reach all users in the DO
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
    const id = env.CHAT_ROOM.idFromName("mirc-final-sync");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
