import { DurableObject } from "cloudflare:workers";

interface Session {
  nick: string;
  level: "user" | "admin";
  channels: string[];
  banned?: boolean;
}

export class ChatRoom extends DurableObject {
  private bans = new Set<string>(); // Persistent bans (by nickname)
  private topic: string = "mIRC Durable Network v2026";

  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair());
    const nick = "Guest" + Math.floor(Math.random() * 1000);
    
    // Check if banned
    if (this.bans.has(nick)) return new Response("Banned", { status: 403 });

    // Initial session attachment
    const session: Session = { nick, level: "user", channels: ["#main"] };
    this.ctx.acceptWebSocket(server, [nick]); // Tag for getWebSockets
    server.serializeAttachment(session); // Persistent attachment

    this.broadcast({ system: `* Joins: ${nick}`, channel: "#main" });
    this.broadcastUserList("#main");

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);
    let session = ws.deserializeAttachment() as Session;
    if (!session || this.bans.has(session.nick)) return ws.close(1008, "Banned");

    const text = data.text?.trim();
    const currentChannel = data.channel || "#main";

    // Handle Disappearing Images
    if (data.image) {
      this.broadcast({ 
        user: session.nick, 
        image: data.image, 
        expires: 10, // 10 seconds
        channel: currentChannel 
      });
      return;
    }

    if (text?.startsWith("/")) {
      const [cmd, ...args] = text.split(" ");
      const argStr = args.join(" ");

      switch (cmd.toLowerCase()) {
        case "/nick":
          const oldNick = session.nick;
          const newNick = args[0].replace(/[^\w]/g, "").substring(0, 12);
          session.nick = newNick;
          ws.serializeAttachment(session); // Update permanent attachment
          this.ctx.setTags(ws, [newNick]); // Update tags for lookups
          this.broadcast({ system: `* ${oldNick} is now ${newNick}`, channel: currentChannel });
          this.broadcastUserList(currentChannel);
          break;

        case "/kick":
          if (session.level !== "admin") return;
          const targetWs = this.ctx.getWebSockets(args[0])[0];
          if (targetWs) {
            targetWs.send(JSON.stringify({ system: `Kicked by ${session.nick}: ${args.slice(1).join(" ")}` }));
            targetWs.close(1000, "Kicked");
          }
          break;

        case "/ban":
          if (session.level !== "admin") return;
          this.bans.add(args[0]);
          const banWs = this.ctx.getWebSockets(args[0])[0];
          if (banWs) banWs.close(1008, "Banned");
          this.broadcast({ system: `*** ${args[0]} has been banned by ${session.nick}`, channel: currentChannel });
          break;

        case "/topic":
          if (session.level === "admin") {
            this.topic = argStr;
            this.broadcast({ topic: this.topic, channel: currentChannel });
          }
          break;

        case "/join":
          const newChan = args[0].startsWith("#") ? args[0] : "#" + args[0];
          session.channels.push(newChan);
          ws.serializeAttachment(session);
          ws.send(JSON.stringify({ system: `Joined channel ${newChan}`, joinChannel: newChan }));
          this.broadcastUserList(newChan);
          break;
      }
      return;
    }

    const pfx = session.level === "admin" ? "@" : "";
    this.broadcast({ user: pfx + session.nick, text, channel: currentChannel });
  }

  async webSocketClose(ws: WebSocket) {
    const session = ws.deserializeAttachment() as Session;
    if (session) {
      this.broadcast({ system: `* Parts: ${session.nick}` });
      this.broadcastUserList("#main");
    }
  }

  private broadcast(data: any) {
    const payload = JSON.stringify(data);
    this.ctx.getWebSockets().forEach(ws => ws.send(payload));
  }

  private broadcastUserList(channel: string) {
    const users = this.ctx.getWebSockets().filter(ws => {
      const s = ws.deserializeAttachment() as Session;
      return s?.channels.includes(channel);
    }).map(ws => {
      const s = ws.deserializeAttachment() as Session;
      return (s.level === "admin" ? "@" : "") + s.nick;
    });
    this.broadcast({ userList: users, channel });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.CHAT_ROOM.idFromName("mirc-v2026-final");
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
