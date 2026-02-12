import { DurableObject } from "cloudflare:workers";

/**
 * mIRC-Style Durable Object Chat Server
 * Roles: Admin (@), Moderator (+), User (None)
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

    // 1. Initialize User State
    const session: SessionData = { 
      name: "Guest" + Math.floor(Math.random() * 1000), 
      level: "user", 
      muted: false 
    };
    this.sessions.set(ws, session);

    // 2. Alert everyone of new join and update sidebar
    this.broadcast({ system: `*** ${session.name} joined the channel.` });
    this.broadcastUserList();

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

        // Apply specific prefixes: Admin=@, Mod=+
        let prefix = "";
        if (currentSession?.level === "admin") prefix = "@";
        else if (currentSession?.level === "op") prefix = "+";

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
      const closingSession = this.sessions.get(ws);
      this.sessions.delete(ws);
      if (closingSession) {
        this.broadcast({ system: `*** ${closingSession.name} left the channel.` });
        this.broadcastUserList();
      }
    });
  }

  async handleCommand(ws: WebSocket, rawText: string) {
    const parts = rawText.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");
    const session = this.sessions.get(ws)!;

    switch (command) {
      case "/identify":
        if (args === this.env.ADMIN_PASSKEY) {
          session.level = "admin";
          ws.send(JSON.stringify({ system: "IDENTIFIED: You are now an Admin (@)." }));
          this.broadcastUserList();
        } else {
          ws.send(JSON.stringify({ system: "Login failed: Invalid passkey." }));
        }
        break;

      case "/nick":
        if (!args) return;
        const oldName = session.name;
        session.name = args.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15); 
        this.broadcast({ system: `*** ${oldName} is now known as ${session.name}` });
        this.broadcastUserList();
        break;

      case "/op":
        if (session.level === "admin") {
          this.findAndModifyUser(args, (targetSess) => {
            targetSess.level = "op"; // Moderator status
            this.broadcast({ system: `*** ${args} was promoted to Moderator (+)` });
            this.broadcastUserList();
          });
        }
        break;

      case "/silent":
        if (session.level === "admin" || session.level === "op") {
          this.findAndModifyUser(args, (targetSess) => {
            targetSess.muted = true;
            this.broadcast({ system: `*** ${args} has been silenced.` });
          });
        }
        break;

      case "/list":
        if (session.level === "admin") {
          // This lists all current users and their roles in this DO instance
          const list = Array.from(this.sessions.values()).map(s => {
             const p = s.level === "admin" ? "@" : (s.level === "op" ? "+" : "");
             return p + s.name;
          });
          ws.send(JSON.stringify({ system: `Current Users: ${list.join(", ")}` }));
        }
        break;

      default:
        ws.send(JSON.stringify({ system: "Unknown command." }));
    }
  }

  // Updates the right-hand sidebar for all connected clients
  private broadcastUserList() {
    const names = Array.from(this.sessions.values()).map(s => {
      let prefix = "";
      if (s.level === "admin") prefix = "@";
      else if (s.level === "op") prefix = "+";
      return prefix + s.name;
    });
    this.broadcast({ userList: names });
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

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("global-mirc-v2");
    const obj = env.CHAT_ROOM.get(id);
    return obj.fetch(request);
  }
};
