import { DurableObject } from "cloudflare:workers";

/**
 * mIRC-Style Durable Object Chat
 * Supports: /identify, /op, /silent, /list, /nick
 */

interface SessionData {
  name: string;
  level: "user" | "op" | "admin";
  muted: boolean;
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, SessionData>();

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    await this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(ws: WebSocket) {
    ws.accept();

    // Default User State
    const session: SessionData = { 
      name: "Guest" + Math.floor(Math.random() * 1000), 
      level: "user", 
      muted: false 
    };
    this.sessions.set(ws, session);

    ws.addEventListener("message", async (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        const text = data.text || "";

        // --- COMMAND PARSER ---
        if (text.startsWith("/")) {
          await this.handleCommand(ws, text);
          return;
        }

        // --- CHAT LOGIC ---
        const currentSession = this.sessions.get(ws);
        if (currentSession?.muted) {
          ws.send(JSON.stringify({ system: "!!! You are currently silenced." }));
          return;
        }

        // Apply mIRC Prefixes
        let prefix = "";
        if (currentSession?.level === "admin") prefix = "&";
        else if (currentSession?.level === "op") prefix = "@";

        this.broadcast({
          name: `${prefix}${currentSession?.name}`,
          text: text,
          level: currentSession?.level
        });

      } catch (err) {
        console.error("DO Message Error:", err);
      }
    });

    ws.addEventListener("close", () => {
      this.sessions.delete(ws);
    });
  }

  async handleCommand(ws: WebSocket, rawText: string) {
    const parts = rawText.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");
    const session = this.sessions.get(ws)!;

    switch (command) {
      case "/identify":
        // env.ADMIN_PASSKEY is pulled from wrangler.json (7088AB)
        if (args === this.env.ADMIN_PASSKEY) {
          session.level = "admin";
          ws.send(JSON.stringify({ system: "IDENTIFIED: You are now an Admin (&)." }));
        } else {
          ws.send(JSON.stringify({ system: "Login failed: Invalid passkey." }));
        }
        break;

      case "/nick":
        if (!args) return;
        const oldName = session.name;
        session.name = args.substring(0, 15); // Limit length
        this.broadcast({ system: `*** ${oldName} is now known as ${session.name}` });
        break;

      case "/op":
        if (session.level === "admin" || session.level === "op") {
          this.findAndModifyUser(args, (targetSess) => {
            targetSess.level = "op";
            this.broadcast({ system: `*** ${args} was opped (@) by ${session.name}` });
          });
        }
        break;

      case "/silent":
        if (session.level === "admin" || session.level === "op") {
          this.findAndModifyUser(args, (targetSess) => {
            targetSess.muted = true;
            this.broadcast({ system: `*** ${args} has been silenced by ${session.name}` });
          });
        }
        break;

      case "/list":
        if (session.level === "admin") {
          const userList = Array.from(this.sessions.values()).map(s => {
            const p = s.level === "admin" ? "&" : (s.level === "op" ? "@" : "");
            return p + s.name;
          });
          ws.send(JSON.stringify({ system: `Online Users: ${userList.join(", ")}` }));
        }
        break;

      default:
        ws.send(JSON.stringify({ system: "Unknown command. Try /nick, /identify, or /list." }));
    }
  }

  private findAndModifyUser(name: string, callback: (session: SessionData) => void) {
    for (const s of this.sessions.values()) {
      if (s.name === name) {
        callback(s);
        break;
      }
    }
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data);
    for (const [ws] of this.sessions) {
      try {
        ws.send(payload);
      } catch (e) {
        this.sessions.delete(ws);
      }
    }
  }
}

// Worker Gateway
export default {
  async fetch(request: Request, env: any) {
    // Routes all traffic to a single global chat instance
    const id = env.CHAT_ROOM.idFromName("global-mirc");
    const obj = env.CHAT_ROOM.get(id);
    return obj.fetch(request);
  }
};
