import { DurableObject } from "cloudflare:workers";

/**
 * mIRC-Style Durable Object Chat Server
 * Handles Access Levels: Admin (&), Operator (@), and User
 */

interface SessionData {
  name: string;
  level: "user" | "op" | "admin";
  muted: boolean;
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, SessionData>();
  private env: any;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.env = env;
  }

  async fetch(request: Request) {
    const webSocketPair = new Array(2);
    const [client, server] = Object.values(new WebSocketPair());

    await this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(ws: WebSocket) {
    ws.accept();
    
    // Default session state
    const session: SessionData = { name: "Guest" + Math.floor(Math.random() * 1000), level: "user", muted: false };
    this.sessions.set(ws, session);

    ws.addEventListener("message", async (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        const text = data.text || "";

        // 1. COMMAND PARSING LOGIC
        if (text.startsWith("/")) {
          await this.handleCommand(ws, text);
          return;
        }

        // 2. MESSAGE BROADCASTING
        const currentSession = this.sessions.get(ws);
        if (currentSession?.muted) {
          ws.send(JSON.stringify({ system: "You are silenced and cannot speak." }));
          return;
        }

        let prefix = "";
        if (currentSession?.level === "admin") prefix = "&";
        else if (currentSession?.level === "op") prefix = "@";

        this.broadcast({
          name: `${prefix}${currentSession?.name}`,
          text: text,
          level: currentSession?.level
        });

      } catch (err) {
        ws.send(JSON.stringify({ error: "Failed to process message" }));
      }
    });

    ws.addEventListener("close", () => {
      this.sessions.delete(ws);
    });
  }

  async handleCommand(ws: WebSocket, rawText: string) {
    const parts = rawText.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const session = this.sessions.get(ws)!;

    switch (command) {
      case "/identify":
        // Set ADMIN_PASSKEY in your wrangler.json or Cloudflare Dashboard
        if (args[0] === this.env.ADMIN_PASSKEY) {
          session.level = "admin";
          ws.send(JSON.stringify({ system: "IDENTIFIED: You are now an Admin (&)." }));
        } else {
          ws.send(JSON.stringify({ system: "Invalid passkey." }));
        }
        break;

      case "/nick":
        const oldName = session.name;
        session.name = args[0] || oldName;
        this.broadcast({ system: `${oldName} is now known as ${session.name}` });
        break;

      case "/op":
        if (session.level === "admin" || session.level === "op") {
          this.applyToUser(args[0], (targetMsg, targetSess) => {
            targetSess.level = "op";
            this.broadcast({ system: `${args[0]} was opped (@) by ${session.name}` });
          });
        }
        break;

      case "/silent":
        if (session.level === "admin" || session.level === "op") {
          this.applyToUser(args[0], (targetMsg, targetSess) => {
            targetSess.muted = true;
            this.broadcast({ system: `${args[0]} has been silenced.` });
          });
        }
        break;

      case "/list":
        if (session.level === "admin") {
          const users = Array.from(this.sessions.values()).map(s => `${s.level === 'admin' ? '&' : (s.level === 'op' ? '@' : '')}${s.name}`);
          ws.send(JSON.stringify({ system: `Online Users: ${users.join(", ")}` }));
        }
        break;

      default:
        ws.send(JSON.stringify({ system: "Unknown command." }));
    }
  }

  private applyToUser(name: string, callback: (ws: WebSocket, session: SessionData) => void) {
    for (const [ws, session] of this.sessions.entries()) {
      if (session.name === name) {
        callback(ws, session);
        break;
      }
    }
  }

  broadcast(data: any) {
    const payload = JSON.stringify(data);
    for (const ws of this.sessions.keys()) {
      ws.send(payload);
    }
  }
}

// Worker Entry Point
export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("global-chat"); // Or parse from URL for multi-channel
    const obj = env.CHAT_ROOM.get(id);
    return obj.fetch(request);
  }
};
