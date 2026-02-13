import { DurableObject } from "cloudflare:workers";

interface SessionData {
  name: string;
  level: "user" | "voice" | "admin";
  ws: WebSocket;
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, SessionData>();
  private topic: string = "mIRC Durable Network 2026";
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
    ws.send(JSON.stringify({ topic: this.topic }));
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
        case "/help":
          ws.send(JSON.stringify({ system: "Commands: /nick <name>, /msg <nick> <text>, /silent <on/off>, /voice <nick>, /op <pass>, /quit <msg>, /topic <text>" }));
          break;
        case "/nick":
          const old = session.name;
          session.name = args.replace(/[^\w]/g, "").substring(0, 15) || session.name;
          this.broadcast({ system: `* ${old} is now known as ${session.name}` });
          this.broadcastUserList();
          break;
        case "/msg":
          const [targetNick, ...msgParts] = args.split(" ");
          const target = Array.from(this.sessions.values()).find(s => s.name === targetNick || `@${s.name}` === targetNick || `+${s.name}` === targetNick);
          if (target) {
            const m = msgParts.join(" ");
            target.ws.send(JSON.stringify({ user: `*${session.name}*`, text: m, pvt: true }));
            ws.send(JSON.stringify({ user: `-> *${targetNick}*`, text: m, pvt: true }));
          } else {
            ws.send(JSON.stringify({ system: `Nick ${targetNick} not found.` }));
          }
          break;
        case "/silent":
          if (session.level === "admin") {
            this.silentMode = (args === "on");
            this.broadcast({ system: `*** Channel mode is now ${this.silentMode ? "+m (Silent)" : "-m"}` });
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
          if (session.level === "admin") {
            this.topic = args;
            this.broadcast({ topic: this.topic, system: `*** ${session.name} changes topic to: ${args}` });
          }
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
    if (s) {
      this.broadcast({ system: `* Parts: ${s.name}` });
      this.sessions.delete(ws);
      this.broadcastUserList();
    }
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
    const id = env.CHAT_ROOM.idFromName("mirc-v2026");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
