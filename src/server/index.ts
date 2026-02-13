import { DurableObject } from "cloudflare:workers";

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, { name: string; level: string; ws: WebSocket }>();
  private topic: string = "mIRC Durable Network v2026";
  private silentMode: boolean = false;

  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    await this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(ws: WebSocket) {
    this.ctx.acceptWebSocket(ws);
    const nick = "Guest" + Math.floor(Math.random() * 1000);
    this.sessions.set(ws, { name: nick, level: "user", ws });
    this.broadcast({ system: `* Joins: ${nick}` });
    this.broadcastUserList();
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    const session = this.sessions.get(ws)!;
    const text = data.text?.trim();
    if (!text) return;

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
          const target = Array.from(this.sessions.values()).find(s => s.name === tNick);
          if (target) {
            const p = JSON.stringify({ user: `-> *${session.name}*`, text: mParts.join(" "), pvt: true });
            target.ws.send(p); ws.send(p);
          }
          break;
        case "/op":
          if (args === "7088AB") { session.level = "admin"; this.broadcastUserList(); }
          break;
        case "/silent":
          if (session.level === "admin") { 
            this.silentMode = (args === "on"); 
            this.broadcast({ system: `*** Channel mode is now ${this.silentMode ? "+m (Silent)" : "-m"}` }); 
          }
          break;
        case "/help":
          ws.send(JSON.stringify({ system: "Commands: /nick <nick>, /msg <nick> <msg>, /op <pass>, /silent <on/off>, /quit" }));
          break;
        case "/quit":
          this.broadcast({ system: `* Quits: ${session.name} (${args || "Leaving"})` });
          ws.close();
          break;
      }
      return;
    }

    if (this.silentMode && session.level === "user") {
        ws.send(JSON.stringify({ system: "Channel is +m. Only @ and + can talk." }));
        return;
    }
    const prefix = session.level === "admin" ? "@" : "";
    this.broadcast({ user: prefix + session.name, text });
  }

  async webSocketClose(ws: WebSocket) {
    const s = this.sessions.get(ws);
    if (s) { this.broadcast({ system: `* Parts: ${s.name}` }); this.sessions.delete(ws); this.broadcastUserList(); }
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data);
    this.sessions.forEach((_, ws) => ws.send(payload));
  }

  private broadcastUserList() {
    const users = Array.from(this.sessions.values()).map(s => (s.level === "admin" ? "@" : "") + s.name);
    this.broadcast({ userList: users });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("mirc-final");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
