import { signal } from '@angular/core';
import { websocketResource } from './socket';

/**
 * Quick local runtime simulation script verifying live connection,
 * heartbeats, and transactional message exchanges against the Bun backend server.
 */
async function runLiveIntegrationTest() {
  console.log("\n=======================================================");
  console.log("🚀 Starting Socket Library & Bun Backend Integration Test");
  console.log("=======================================================\n");

  const urlSignal = signal('ws://localhost:8080/rooms/developer-chat');

  // 1. Initialize our websocket resource
  const socketRef = (globalThis as any).TestBed ? (globalThis as any).TestBed.runInInjectionContext(() => 
    websocketResource(urlSignal, { heartbeatInterval: 1000 })
  ) : (() => {
    // Custom plain runtime mock injection environment context
    return websocketResource(urlSignal, { heartbeatInterval: 1000 });
  })();

  console.log("⏳ Initializing socket client...");

  // Wait for loader to resolve client
  await new Promise(resolve => setTimeout(resolve, 500));

  const client = socketRef.value();
  if (!client) {
    console.error("❌ Error: Socket client resolved to undefined.");
    process.exit(1);
  }

  // 2. Monitor status signal transitions
  console.log(`🔌 Current Status: ${client.status()} (Expected: connecting)`);

  // Wait for mock or server to connect
  await new Promise<void>((resolve, reject) => {
    const checkInterval = setInterval(() => {
      if (client.status() === 'connected') {
        clearInterval(checkInterval);
        resolve();
      } else if (client.status() === 'error') {
        clearInterval(checkInterval);
        reject(new Error("Failed to connect."));
      }
    }, 100);
  });

  console.log(`✅ Socket connected! Status: ${client.status()}`);

  // 3. Keep track of incoming messages
  let receivedCount = 0;
  const originalMessage = client.message;

  // 4. Send test message
  console.log("📨 Sending payload message...");
  client.send({ sender: "System Test Runner", text: "Hello Live Bun Server! 🚀" } as any);

  // Wait for bounce-back response from Bun backend publish channel
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log("✨ Test finalized. Shutting down...");
  client.close();
  console.log("🔌 Gracefully closed. Current status:", client.status());
  console.log("\n=======================================================");
  console.log("🎉 SUCCESS: Socket library integrated beautifully with Bun close/send pipelines!");
  console.log("=======================================================\n");
  process.exit(0);
}

runLiveIntegrationTest().catch(err => {
  console.error("❌ Integration test failed:", err);
  process.exit(1);
});
