import { DurableObject } from "cloudflare:workers";

interface SessionData {
  name: string;
  level: "user" | "op" | "admin";
  muted: boolean;
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, SessionData>();
  private topic: string = "Welcome to the Durable IRC Network!";
  private rules: string = "1. Be respectful. 2. No spam. 3. Have fun!";

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    // Load persisted topic/rules from storage on startup
    this.ctx.blockConcurrencyWhile(async () => {
      this.topic = (await this.ctx.storage.get<string>("topic")) || this.topic;
      this.rules = (await this.ctx.storage.get<string>("rules")) || this.rules;
    });
  }

  async fetch(request: Request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    await this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(ws: WebSocket) {
    this.ctx.acceptWebSocket(ws);
    const session: SessionData = { 
      name: "Guest" + Math.floor(Math.random() * 1000), 
      level: "user", 
      muted: false 
    };
    this.sessions.set(ws, session);

    // Initial sync
    ws.send(JSON.stringify({ topic: this.topic }));
    ws.send(JSON.stringify({ system: "WELCOME: Type /help for commands. Current Rules: " + this.rules }));
    
    this.broadcastUserList();
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    try {
      const data = JSON.parse(message);
      const session = this.sessions.get(ws);
      if (!session || !data.text) return;

      if (data.text.startsWith("/")) {
        await this.handleCommand(ws, data.text);
      } else {
        if (session.muted) {
          ws.send(JSON.stringify({ system: "You are currently muted." }));
          return;
        }
        const prefix = session.level === "admin" ? "@" : session.level === "op" ? "+" : "";
        this.broadcast({ user: prefix + session.name, text: data.text });
      }
    } catch (e) {
      console.error("WS Message Error:", e);
    }
  }

  async handleCommand(ws: WebSocket, rawText: string) {
    const parts = rawText.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ").trim();
    const session = this.sessions.get(ws)!;

    switch (command) {
      case "/help":
        ws.send(JSON.stringify({ system: "Available: /nick <name>, /topic <text>, /me <action>, /rules, /identify <pass>" }));
        break;

      case "/nick":
        if (!args || args.length > 15) {
          ws.send(JSON.stringify({ system: "Invalid nickname (max 15 chars)." }));
        } else {
          const oldNick = session.name;
          session.name = args.replace(/[^\w]/g, ""); // Remove symbols
          this.broadcast({ system: `${oldNick} is now known as ${session.name}` });
          this.broadcastUserList();
        }
        break;

      case "/topic":
        if (session.level === "admin" || session.level === "op") {
          this.topic = args;
          await this.ctx.storage.put("topic", this.topic);
          this.broadcast({ topic: this.topic, system: `*** ${session.name} changed topic to: ${args}` });
        } else {
          ws.send(JSON.stringify({ system: "Permission denied." }));
        }
        break;

      case "/identify":
        if (args === this.env.ADMIN_PASSKEY) {
          session.level = "admin";
          ws.send(JSON.stringify({ system: "You are now an ADMIN (@)." }));
          this.broadcastUserList();
        } else {
          ws.send(JSON.stringify({ system: "Incorrect passkey." }));
        }
        break;

      case "/me":
        this.broadcast({ system: `* ${session.name} ${args}` });
        break;

      default:
        ws.send(JSON.stringify({ system: `Unknown command: ${command}. Type /help.` }));
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws);
    this.broadcastUserList();
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data);
    this.sessions.forEach((_, ws) => {
      try { ws.send(payload); } catch (e) { this.sessions.delete(ws); }
    });
  }

  private broadcastUserList() {
    const names = Array.from(this.sessions.values()).map(s => 
      (s.level === "admin" ? "@" : s.level === "op" ? "+" : "") + s.name
    );
    this.broadcast({ userList: names });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("global-mirc-v3");
    const obj = env.CHAT_ROOM.get(id);
    return obj.fetch(request);
  }
};
