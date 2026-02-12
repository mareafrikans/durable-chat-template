import { DurableObject } from "cloudflare:workers";

/**
 * mIRC-Style Chat Server
 */
export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, any>();

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  // The main entry point for the Durable Object
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

    // Initial user state
    const session = { 
      name: "Guest" + Math.floor(Math.random() * 1000), 
      level: "user", 
      muted: false 
    };
    this.sessions.set(ws, session);

    ws.addEventListener("message", async (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        const text = data.text || "";

        // COMMAND HANDLER
        if (text.startsWith("/")) {
          const parts = text.split(" ");
          const command = parts[0].toLowerCase();
          const args = parts.slice(1).join(" ");

          // 1. /identify <passkey>
          if (command === "/identify") {
            if (args === this.env.ADMIN_PASSKEY) {
              session.level = "admin";
              ws.send(JSON.stringify({ system: "IDENTIFIED: You are now an Admin (&)." }));
            } else {
              ws.send(JSON.stringify({ system: "Invalid passkey." }));
            }
            return;
          }

          // 2. /op <username>
          if (command === "/op" && (session.level === "admin" || session.level === "op")) {
            this.updateUserLevel(args, "op");
            this.broadcast({ system: `${args} is now an Operator (@)` });
            return;
          }

          // 3. /list (Admins only)
          if (command === "/list" && session.level === "admin") {
            const users = Array.from(this.sessions.values()).map(s => 
              (s.level === "admin" ? "&" : s.level === "op" ? "@" : "") + s.name
            );
            ws.send(JSON.stringify({ system: `Online: ${users.join(", ")}` }));
            return;
          }

          // 4. /silent <username>
          if (command === "/silent" && (session.level === "admin" || session.level === "op")) {
            this.muteUser(args);
            this.broadcast({ system: `${args} has been silenced.` });
            return;
          }
        }

        // CHAT BROADCAST
        if (session.muted) {
          ws.send(JSON.stringify({ system: "You are silenced." }));
          return;
        }

        let prefix = session.level === "admin" ? "&" : session.level === "op" ? "@" : "";
        this.broadcast({
          name: prefix + session.name,
          text: text
        });

      } catch (e) {
        console.error("Message error", e);
      }
    });

    ws.addEventListener("close", () => {
      this.sessions.delete(ws);
    });
  }

  private broadcast(message: any) {
    const data = JSON.stringify(message);
    for (const [ws] of this.sessions) {
      try { ws.send(data); } catch (e) { this.sessions.delete(ws); }
    }
  }

  private updateUserLevel(name: string, level: string) {
    for (const [ws, s] of this.sessions) {
      if (s.name === name) s.level = level;
    }
  }

  private muteUser(name: string) {
    for (const [ws, s] of this.sessions) {
      if (s.name === name) s.muted = true;
    }
  }
}

// Worker code to route requests to the Durable Object
export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("global");
    const obj = env.CHAT_ROOM.get(id);
    return obj.fetch(request);
  }
};
