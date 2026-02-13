import { DurableObject } from "cloudflare:workers";

interface UserInfo {
  nick: string;
  level: string;
}

export class ChatRoom extends DurableObject {
  private silentMode: boolean = false;

  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Initial default state
    const nick = "Guest" + Math.floor(Math.random() * 1000);
    const level = "user";

    this.ctx.acceptWebSocket(server, [nick]);
    // Save metadata to storage associated with this specific WebSocket
    await this.ctx.storage.put(`ws-${nick}`, { nick, level });

    this.broadcast({ system: `* Joins: ${nick}` });
    await this.broadcastUserList();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    const text = data.text?.trim();
    if (!text) return;

    // Get current user data from storage
    const tags = this.ctx.getTags(ws);
    const currentNick = tags[0];
    const userData = await this.ctx.storage.get<UserInfo>(`ws-${currentNick}`) || { nick: currentNick, level: "user" };

    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      switch (cmd) {
        case "/nick":
          const newNick = args.replace(/[^\w]/g, "").substring(0, 12);
          if (newNick && newNick !== userData.nick) {
            const oldNick = userData.nick;
            userData.nick = newNick;
            
            // Update Storage and Tags
            await this.ctx.storage.delete(`ws-${oldNick}`);
            await this.ctx.storage.put(`ws-${newNick}`, userData);
            this.ctx.setTags(ws, [newNick]);
            
            this.broadcast({ system: `* ${oldNick} is now known as ${newNick}` });
            await this.broadcastUserList();
          }
          break;

        case "/op":
          if (args === "7088AB") {
            userData.level = "admin";
            await this.ctx.storage.put(`ws-${userData.nick}`, userData);
            ws.send(JSON.stringify({ system: "You are now @Operator" }));
            await this.broadcastUserList();
          }
          break;

        case "/silent":
          if (userData.level === "admin") {
            this.silentMode = (args === "on");
            this.broadcast({ system: `*** Mode is ${this.silentMode ? "+m (Silent)" : "-m (Open)"}` });
          }
          break;

        case "/help":
          ws.send(JSON.stringify({ system: "mIRC: /nick <name>, /op <pass>, /silent <on/off>, /quit, /topic <text>" }));
          break;

        default:
          ws.send(JSON.stringify({ system: `Unknown command: ${cmd}` }));
      }
      return;
    }

    if (this.silentMode && userData.level !== "admin") {
      ws.send(JSON.stringify({ system: "Channel is +m. Only @ can talk." }));
      return;
    }

    const pfx = userData.level === "admin" ? "@" : "";
    this.broadcast({ user: pfx + userData.nick, text });
  }

  async webSocketClose(ws: WebSocket) {
    const tags = this.ctx.getTags(ws);
    const nick = tags[0];
    await this.ctx.storage.delete(`ws-${nick}`);
    this.broadcast({ system: `* Parts: ${nick}` });
    await this.broadcastUserList();
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data);
    this.ctx.getWebSockets().forEach(ws => {
      try { ws.send(payload); } catch (e) { ws.close(); }
    });
  }

  private async broadcastUserList() {
    const sockets = this.ctx.getWebSockets();
    const userList: string[] = [];
    
    for (const ws of sockets) {
      const tag = this.ctx.getTags(ws)[0];
      const info = await this.ctx.storage.get<UserInfo>(`ws-${tag}`);
      if (info) {
        userList.push((info.level === "admin" ? "@" : "") + info.nick);
      }
    }
    this.broadcast({ userList: userList.sort() });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("mirc-final-v1");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
