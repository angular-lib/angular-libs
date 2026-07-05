/// <reference types="bun-types" />

/**
 * High-performance, zero-dependency Bun WebSocket server.
 * Supports real-time room subscribes, message broadcasts, and periodic heartbeats.
 * Run with: `bun run server/server.ts` or `npm run server`
 */

console.log("Starting WebStream Live Test Server via Bun... 📡");

const server = Bun.serve<{ room: string }>({
  port: 8080,
  fetch(req, server) {
    const url = new URL(req.url);
    
    // Parse room parameter from path, e.g., /rooms/general
    const pathParts = url.pathname.split("/");
    const room = pathParts[2] || "general";

    const upgraded = server.upgrade(req, {
      data: { room }
    });

    if (upgraded) {
      return undefined; // Handled by websocket
    }

    return new Response("Bun server holds the active backend. Connect via WebSocket! 📡", {
      headers: { "Content-Type": "text/plain" }
    });
  },
  websocket: {
    open(ws) {
      const {room} = ws.data;
      ws.subscribe(room);
      
      console.log(`[Server] Socket joined channel: #${room}`);

      // Send greeting
      ws.send(JSON.stringify({
        sender: "📢 Server Broker",
        text: `Connected successfully to #${room}! (Live Bun backend active)`,
        time: new Date().toLocaleTimeString()
      }));
    },
    message(ws, message) {
      const {room} = ws.data;
      const msgStr = typeof message === "string" ? message : new TextDecoder().decode(message);

      // Handle heartbeat manual ping-pong if client sends it as absolute string
      if (msgStr === "ping" || msgStr === '"ping"') {
        ws.send("ping");
        return;
      }

      console.log(`[Server] Message on #${room}:`, msgStr);

      try {
        const payload = JSON.parse(msgStr);
        
        // Broadcast payload to all other participants in the room
        ws.publish(room, JSON.stringify({
          sender: payload.sender || "Anonymous",
          text: payload.text,
          time: new Date().toLocaleTimeString()
        }));
      } catch (err) {
        // Fallback simple broadcast if not valid JSON
        ws.publish(room, JSON.stringify({
          sender: "📢 Announcement",
          text: msgStr,
          time: new Date().toLocaleTimeString()
        }));
      }
    },
    close(ws) {
      const room = ws.data.room;
      ws.unsubscribe(room);
      console.log(`[Server] Socket left channel: #${room}`);
    }
  }
});

console.log(`Server listening on ws://localhost:${server.port} 🚀`);
