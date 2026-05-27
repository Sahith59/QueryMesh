import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { ScanProgressEvent, ViolationAlert } from '../types';

export function createStompClient(
  onProgress: (event: ScanProgressEvent) => void,
  onViolation: (alert: ViolationAlert) => void,
  onConnect?: () => void,
  onDisconnect?: () => void
): Client {
  const client = new Client({
    // SockJS handles WebSocket upgrade + polling fallback automatically
    webSocketFactory: () => new SockJS('http://localhost:8080/ws-sockjs'),
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    onConnect: () => {
      client.subscribe('/topic/scan-progress', (message) => {
        const event: ScanProgressEvent = JSON.parse(message.body);
        onProgress(event);
      });

      client.subscribe('/topic/violations', (message) => {
        const alert: ViolationAlert = JSON.parse(message.body);
        onViolation(alert);
      });

      onConnect?.();
    },
    onDisconnect: () => {
      onDisconnect?.();
    },
    onStompError: (frame) => {
      console.error('STOMP error:', frame);
    },
  });

  return client;
}
