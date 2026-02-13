import { DurableObject } from "cloudflare:workers";

export class ChatRoom extends DurableObject {
  private silentMode: boolean = false;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Register connection with the Hibernation API
    // We store the nick and level directly in the WebSocket "attachment"
    const initialData = { 
      nick: "Guest" + Math.floor(Math.random() * 1000), 
      level: "user" 
    };
    
    this.ctx.acceptWebSocket(server, [initialData.nick, initialData.level]);

    this.broadcast({ system: `* Joins: ${initialData.nick}` });
    this.broadcastUserList();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    // Retrieve the session data from the attachment
    const [nick, level] = this.ctx.getTags(ws);
    const text = data.text?.trim();

    if (!text) return;

    // COMMAND HANDLING
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      switch (cmd) {
        case "/nick":
          const newNick = args.replace(/[^\w]/g, "").substring(0, 12);
          if (newNick) {
            this.broadcast({ system: `* ${nick} is now known as ${newNick}` });
            this.ctx.setTags(ws, [newNick, level]);
            this.broadcastUserList();
          }
          break;

        case "/msg":
          const [targetNick, ...msgParts] = args.split(" ");
          const privateMsg = msgParts.join(" ");
          const targetWs = this.ctx.getWebSockets(targetNick)[0];
          if (targetWs) {
            const payload = JSON.stringify({ user: `*${nick}*`, text: privateMsg, pvt: true });
            targetWs.send(payload);
            ws.send(JSON.stringify({ user: `-> *${targetNick}*`, text: privateMsg, pvt: true }));
          } else {
            ws.send(JSON.stringify({ system: `User ${targetNick} not found.` }));
          }
          break;

        case "/op":
          if (args === "7088AB") {
            this.ctx.setTags(ws, [nick, "admin"]);
            ws.send(JSON.stringify({ system: "You are now @Operator" }));
            this.broadcastUserList();
          }
          break;

        case "/silent":
          if (level === "admin") {
            this.silentMode = (args === "on");
            this.broadcast({ system: `*** Mode is ${this.silentMode ? "+m (Silent)" : "-m (Open)"}` });
          }
          break;

        case "/quit":
          this.broadcast({ system: `* Quits: ${nick} (${args || "Leaving"})` });
          ws.close();
          break;

        case "/help":
          ws.send(JSON.stringify({ system: "mIRC: /nick <name>, /msg <nick> <msg>, /op <pass>, /silent <on/off>, /quit <msg>" }));
          break;

        default:
          ws.send(JSON.stringify({ system: `Unknown command: ${cmd}` }));
      }
      return;
    }

    // CHAT BROADCAST
    if (this.silentMode && level !== "admin") {
      ws.send(JSON.stringify({ system: "Channel is +m. Only @ can talk." }));
      return;
    }

    const prefix = level === "admin" ? "@" : "";
    this.broadcast({ user: prefix + nick, text });
  }

  async webSocketClose(ws: WebSocket) {
    const [nick] = this.ctx.getTags(ws);
    this.broadcast({ system: `* Parts: ${nick}` });
    this.broadcastUserList();
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data);
    // CRITICAL: Send to ALL connected WebSockets
    this.ctx.getWebSockets().forEach(ws => {
      try { ws.send(payload); } catch (e) { ws.close(); }
    });
  }

  private broadcastUserList() {
    const users = this.ctx.getWebSockets().map(ws => {
      const [nick, level] = this.ctx.getTags(ws);
      return (level === "admin" ? "@" : "") + nick;
    });
    this.broadcast({ userList: users });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("mirc-v23-fixed");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
