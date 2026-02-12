import { DurableObject } from "cloudflare:workers";

/**
 * mIRC-Style Durable Object Chat Server
 * Fully documented at: https://developers.cloudflare.com
 */

interface SessionData {
  name: string;
  level: "user" | "op" | "admin";
  muted: boolean;
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, SessionData>();
  private env: any; // Explicitly define env to use in commands

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.env = env; // Essential for /identify to work
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
          ws.send(JSON.stringify({ system: "!!! You are currently silenced and cannot speak." }));
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
        console.error("Durable Object Message Error:", err);
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
        // Correctly pulls from env assigned in constructor
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
        // Basic sanitization
        session.name = args.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15); 
        this.broadcast({ system: `*** ${oldName} is now known as ${session.name}` });
        break;

      case "/op":
        if (session.level === "admin" || session.level === "op") {
          this.findAndModifyUser(args, (targetSess) => {
            targetSess.level = "op";
            this.broadcast({ system: `*** ${args} was opped (@) by ${session.name}` });
          });
        } else {
          ws.send(JSON.stringify({ system: "Permission Denied: You are not an operator." }));
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
        } else {
          ws.send(JSON.stringify({ system: "Permission Denied: Admin only command." }));
        }
        break;

      case "/help":
        ws.send(JSON.stringify({ system: "Available: /nick <name>, /identify <pass>, /list (Admin), /op <user>, /silent <user>" }));
        break;

      default:
        ws.send(JSON.stringify({ system: "Unknown command. Type /help for options." }));
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

// Worker Entry Point (Gateway)
export default {
  async fetch(request: Request, env: any) {
    // Durable Object ID management
    const id = env.CHAT_ROOM.idFromName("global-mirc-v1");
    const obj = env.CHAT_ROOM.get(id);
    return obj.fetch(request);
  }
};
