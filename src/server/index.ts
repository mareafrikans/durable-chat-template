import { DurableObject } from "cloudflare:workers";

interface SessionData {
  name: string;
  level: "user" | "voice" | "admin";
  ws: WebSocket;
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, SessionData>();
  private topic: string = "Welcome to the mIRC Network";
  private silentMode: boolean = false;

  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair());
    await this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(ws: WebSocket) {
    this.ctx.acceptWebSocket(ws);
    const nick = "Guest" + Math.floor(Math.random() * 1000);
    this.sessions.set(ws, { name: nick, level: "user", ws });
    this.broadcast({ system: `* Joins: ${nick} (user@durable-network)` });
    this.broadcastUserList();
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    const session = this.sessions.get(ws)!;
    const text = data.text?.trim();
    if (!text) return;

    if (text.startsWith("/")) {
      const [cmd, ...argsArr] = text.split(" ");
      const args = argsArr.join(" ");

      switch (cmd.toLowerCase()) {
        case "/help":
          ws.send(JSON.stringify({ system: "Commands: /nick <name>, /msg <nick> <text>, /silent <on/off>, /voice <nick>, /op <pass>, /quit <msg>, /topic <text>" }));
          break;
        case "/nick":
          const old = session.name;
          session.name = args.replace(/[^\w]/g, "").substring(0, 15);
          this.broadcast({ system: `* ${old} is now known as ${session.name}` });
          this.broadcastUserList();
          break;
        case "/msg":
          const [targetNick, ...msgParts] = args.split(" ");
          const target = Array.from(this.sessions.values()).find(s => s.name === targetNick);
          if (target) {
            target.ws.send(JSON.stringify({ user: `-> *${session.name}*`, text: msgParts.join(" "), pvt: true }));
            ws.send(JSON.stringify({ user: `-> *${targetNick}*`, text: msgParts.join(" "), pvt: true }));
          }
          break;
        case "/silent":
          if (session.level === "admin") {
            this.silentMode = args === "on";
            this.broadcast({ system: `*** Mode is now ${this.silentMode ? "+m" : "-m"}` });
          }
          break;
        case "/op":
          if (args === "7088AB") {
            session.level = "admin";
            this.broadcast({ system: `*** ${session.name} is now Operator (@)` });
            this.broadcastUserList();
          }
          break;
        case "/voice":
          if (session.level === "admin") {
            const v = Array.from(this.sessions.values()).find(s => s.name === args);
            if (v) { v.level = "voice"; this.broadcastUserList(); }
          }
          break;
        case "/quit":
          this.broadcast({ system: `* Quits: ${session.name} (${args || "Leaving"})` });
          ws.close();
          break;
        case "/topic":
          if (session.level === "admin") { this.topic = args; this.broadcast({ topic: this.topic }); }
          break;
      }
      return;
    }

    if (this.silentMode && session.level === "user") {
      ws.send(JSON.stringify({ system: "Channel is +m (Silent). Only @ and + can speak." }));
      return;
    }

    const prefix = session.level === "admin" ? "@" : session.level === "voice" ? "+" : "";
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
    const users = Array.from(this.sessions.values()).map(s => (s.level === "admin" ? "@" : s.level === "voice" ? "+" : "") + s.name);
    this.broadcast({ userList: users });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("mirc-v1");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
