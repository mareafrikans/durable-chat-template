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

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair());
    await this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(ws: WebSocket) {
    this.ctx.acceptWebSocket(ws);
    const nick = "Guest" + Math.floor(Math.random() * 1000);
    const session: SessionData = { name: nick, level: "user", ws };
    this.sessions.set(ws, session);

    // Join Message
    this.broadcast({ system: `* Joins: ${nick} (user@durable-network)` });
    ws.send(JSON.stringify({ topic: this.topic }));
    this.broadcastUserList();
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    const session = this.sessions.get(ws)!;
    const text = data.text?.trim();
    if (!text) return;

    // COMMAND PARSING
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      switch (cmd) {
        case "/help":
          ws.send(JSON.stringify({ system: "Commands: /nick, /msg <nick> <msg>, /me, /topic, /silent <on/off>, /voice <nick>, /op <pass>, /quit [msg]" }));
          break;

        case "/nick":
          const old = session.name;
          session.name = args.split(" ")[0].replace(/[^\w]/g, "");
          this.broadcast({ system: `* ${old} is now known as ${session.name}` });
          this.broadcastUserList();
          break;

        case "/msg": // Private Message
          const [targetNick, ...msgParts] = args.split(" ");
          const privateMsg = msgParts.join(" ");
          const target = Array.from(this.sessions.values()).find(s => s.name === targetNick);
          if (target) {
            const payload = JSON.stringify({ user: `-> *${targetNick}*`, text: privateMsg, pvt: true });
            ws.send(payload);
            target.ws.send(JSON.stringify({ user: `*${session.name}*`, text: privateMsg, pvt: true }));
          } else {
            ws.send(JSON.stringify({ system: `Nickname ${targetNick} not found.` }));
          }
          break;

        case "/silent":
          if (session.level === "admin") {
            this.silentMode = args === "on";
            this.broadcast({ system: `*** Channel mode is now ${this.silentMode ? "+m (Muted/Silent)" : "-m (Unmuted)"}` });
          }
          break;

        case "/voice": // Grant + level
          if (session.level === "admin") {
            const vTarget = Array.from(this.sessions.values()).find(s => s.name === args);
            if (vTarget) {
              vTarget.level = "voice";
              this.broadcast({ system: `*** ${session.name} sets mode +v ${args}` });
              this.broadcastUserList();
            }
          }
          break;

        case "/op": // /op <passkey>
          if (args === "7088AB") { // Simplified for demo
            session.level = "admin";
            this.broadcast({ system: `*** ${session.name} is now a Channel Operator (@)` });
            this.broadcastUserList();
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

        default:
          ws.send(JSON.stringify({ system: "Unknown command. Type /help" }));
      }
      return;
    }

    // MAIN CHANNEL CHAT
    if (this.silentMode && session.level === "user") {
      ws.send(JSON.stringify({ system: "Channel is +m (Silent). Only @ and + can speak." }));
      return;
    }

    const prefix = session.level === "admin" ? "@" : session.level === "voice" ? "+" : "";
    this.broadcast({ user: prefix + session.name, text: text });
  }

  async webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    if (session) {
      this.broadcast({ system: `* Parts: ${session.name}` });
      this.sessions.delete(ws);
      this.broadcastUserList();
    }
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data);
    this.sessions.forEach((_, ws) => ws.send(payload));
  }

  private broadcastUserList() {
    const users = Array.from(this.sessions.values()).map(s => {
      const p = s.level === "admin" ? "@" : s.level === "voice" ? "+" : "";
      return p + s.name;
    });
    this.broadcast({ userList: users });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("mirc-v5");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
