// Inside your Durable Object class (usually 'ChatRoom' or 'Chat')
async onMessage(ws: WebSocket, message: string) {
  const data = JSON.parse(message);
  const msgText = data.text || "";

  // 1. COMMAND PARSER
  if (msgText.startsWith("/")) {
    const parts = msgText.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Get current session state (access level)
    let session = ws.deserializeAttachment(); 

    switch (command) {
      case "/identify":
        // env.ADMIN_PASSKEY should be set in wrangler.json
        if (args[0] === this.env.ADMIN_PASSKEY) {
          session.level = "admin";
          ws.serializeAttachment(session);
          ws.send(JSON.stringify({ system: "IDENTIFIED: You are now an Admin (&)." }));
        }
        return;

      case "/op":
        if (session.level === "admin" || session.level === "op") {
          const target = args[0];
          this.broadcast({ system: `${target} is now a Channel Operator (@)` });
          // Logic to find target's WS and set session.level = "op" goes here
        }
        return;

      case "/list":
        if (session.level === "admin") {
          // Admins see all active sessions in this Durable Object
          const activeUsers = Array.from(this.ctx.getWebSockets()).map(s => s.deserializeAttachment().name);
          ws.send(JSON.stringify({ system: `Active Users: ${activeUsers.join(", ")}` }));
        }
        return;
        
      case "/silent":
        if (session.level === "admin" || session.level === "op") {
          this.broadcast({ system: `Channel is now in SILENT mode.` });
          this.isSilent = true; // Set a class property
        }
        return;
    }
  }

  // 2. BROADCAST WITH PREFIXES
  const session = ws.deserializeAttachment();
  let prefix = "";
  if (session.level === "admin") prefix = "&";
  else if (session.level === "op") prefix = "@";

  this.broadcast({
    name: `${prefix}${session.name}`,
    text: msgText
  });
}
