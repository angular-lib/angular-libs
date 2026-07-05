import { WebSocketPlugin } from '../socket.types';

/**
 * Creates a standard development console logger plugin.
 */
export function createWebSocketLoggerPlugin(prefix = 'Socket'): WebSocketPlugin {
  return {
    onBeforeConnect: (url: string) => {
      console.log(`[${prefix}] Connecting to: ${url}`);
      return url;
    },
    onStatusChange: (prev, current) => {
      console.log(`[${prefix}] Status changed from "${prev}" to "${current}"`);
    },
    onBeforeSend: (payload) => {
      console.log(`[${prefix}] Sending message:`, payload);
      return payload;
    },
    onMessageReceived: (data) => {
      console.log(`[${prefix}] Received message:`, data);
      return data;
    },
    onError: (err) => {
      console.error(`[${prefix}] Error encountered:`, err);
    }
  };
}
