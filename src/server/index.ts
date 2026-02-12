import { DurableObject } from "cloudflare:workers";

interface SessionData {
  name: string;
  level: "user" | "op" | "admin";
  muted: boolean;
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, SessionData>();
  private env: any;
  private topic: string = "Welcome to the Durable IRC Network!";
  private rules: string = "1. Be respectful. 2. No spam. 3. Have fun!";

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.env = env;
    // Load persisted topic/rules from storage on startup
    ctx.blockConcurrencyWhile(async () => {
      this.topic = (await this.ctx.storage.get<string>("topic")) || this.topic;
      this.rules = (await this.ctx.storage.get<string>("rules")) || this.rules;
    });
  }

  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair());
    await this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(ws: WebSocket) {
    ws.accept();
    const session: SessionData = { name: "Guest" + Math.floor(Math.random() * 1000), level: "user", muted: false };
    this.sessions.set(ws, session);

    // AUTO-SEND ON JOIN: Send Topic and Rules immediately
    ws.send(JSON.stringify({ topic: this.topic }));
    ws.send(JSON.stringify({ system: "CHANNEL RULES: " + this.rules }));
    
    this.broadcastUserList();

    ws.addEventListener("message", async (msg) => {
      const data = JSON.parse(msg.data as string);
      if (data.text?.startsWith("/")) {
        await this.handleCommand(ws, data.text);
      } else {
        this.broadcastChat(ws, data.text);
      }
    });

    ws.addEventListener("close", () => {
      this.sessions.delete(ws);
      this.broadcastUserList();
    });
  }

  async handleCommand(ws: WebSocket, rawText: string) {
    const parts = rawText.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");
    const session = this.sessions.get(ws)!;

    switch (command) {
      case "/topic":
        // Only Admins (@) or Mods (+) can set topic
        if (session.level === "admin" || session.level === "op") {
          this.topic = args;
          await this.ctx.storage.put("topic", this.topic);
          this.broadcast({ topic: this.topic, system: `*** ${session.name} changed topic to: ${args}` });
        }
        break;

      case "/rules":
        if (session.level === "admin") {
          this.rules = args;
          await this.ctx.storage.put("rules", this.rules);
          ws.send(JSON.stringify({ system: "Channel rules updated." }));
        } else {
          ws.send(JSON.stringify({ system: "Rules: " + this.rules }));
        }
        break;
      
      // ... include previous /identify and /op cases here ...
    }
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data);
    for (const [ws] of this.sessions) ws.send(payload);
  }

  private broadcastUserList() {
    const names = Array.from(this.sessions.values()).map(s => (s.level === "admin" ? "@" : s.level === "op" ? "+" : "") + s.name);
    this.broadcast({ userList: names });
  }

  private broadcastChat(ws: WebSocket, text: string) {
    const s = this.sessions.get(ws)!;
    if (s.muted) return;
    const prefix = s.level === "admin" ? "@" : s.level === "op" ? "+" : "";
    this.broadcast({ name: prefix + s.name, text });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("global-mirc-v3");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
