// src/services/api/signalRService.ts

import * as signalR from '@microsoft/signalr';
import { getAccessToken, getApiBaseUrl } from './httpClient';

export interface LeaderboardUpdatePayload {
  category?: string;
  weekId?: string;
  updatedAt?: string;
}

export type SignalRStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

export type LeaderboardEventListener = (payload?: LeaderboardUpdatePayload) => void;
export type SignalRStatusListener = (status: SignalRStatus) => void;

export function getSignalRHubUrl(hubPath = '/hubs/leaderboard'): string {
  const baseUrl = getApiBaseUrl();
  // Loại bỏ hậu tố /api nếu có để kết nối tới server root endpoint
  const serverOrigin = baseUrl.replace(/\/api\/?$/, '');
  const cleanPath = hubPath.startsWith('/') ? hubPath : `/${hubPath}`;
  return `${serverOrigin}${cleanPath}`;
}

let hubConnection: signalR.HubConnection | null = null;
let currentStatus: SignalRStatus = 'CLOSED';
let isConnecting = false;

const eventListeners = new Set<LeaderboardEventListener>();
const statusListeners = new Set<SignalRStatusListener>();

type ConnectionFactory = () => signalR.HubConnection;
let customConnectionFactory: ConnectionFactory | null = null;

function notifyStatus(status: SignalRStatus) {
  currentStatus = status;
  for (const listener of statusListeners) {
    try {
      listener(status);
    } catch (err) {
      console.warn('[SignalR] Lỗi listener status:', err);
    }
  }
}

function notifyEvent(payload?: LeaderboardUpdatePayload) {
  for (const listener of eventListeners) {
    try {
      listener(payload);
    } catch (err) {
      console.warn('[SignalR] Lỗi listener event:', err);
    }
  }
}

function setupHubEventListeners(conn: signalR.HubConnection) {
  // Đảm bảo không đăng ký listener trùng
  try {
    conn.off('leaderboard_updated');
  } catch {}

  // Đăng ký nhận sự kiện realtime từ backend
  conn.on('leaderboard_updated', (payload?: LeaderboardUpdatePayload) => {
    notifyEvent(payload);
  });

  // Reconnection handlers
  conn.onreconnecting((error) => {
    console.info('[SignalR] Đang thử kết nối lại tới LeaderboardHub...', error?.message);
    notifyStatus('CHANNEL_ERROR');
  });

  conn.onreconnected((connectionId) => {
    console.info('[SignalR] Đã kết nối lại thành công tới LeaderboardHub:', connectionId);
    notifyStatus('SUBSCRIBED');
    // Khi kết nối lại, kích hoạt refetch ngay để lấy dữ liệu mới nhất bị lỡ trong lúc ngắt kết nối
    notifyEvent();
  });

  conn.onclose((error) => {
    if (error) {
      console.warn('[SignalR] Kết nối LeaderboardHub bị đóng do lỗi:', error.message);
      notifyStatus('CHANNEL_ERROR');
    } else {
      notifyStatus('CLOSED');
    }
  });
}

let networkListenersAttached = false;

function ensureNetworkListenersAttached() {
  if (networkListenersAttached || typeof window === 'undefined') return;
  networkListenersAttached = true;

  window.addEventListener('online', () => {
    if (eventListeners.size > 0) {
      console.info('[SignalR] Mạng phục hồi (online). Khởi tạo lại kết nối Hub...');
      if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
        void startHubConnection();
      } else {
        notifyStatus('SUBSCRIBED');
      }
    }
  });

  window.addEventListener('offline', () => {
    console.info('[SignalR] Mất mạng (offline).');
    notifyStatus('CHANNEL_ERROR');
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && eventListeners.size > 0) {
        if (!hubConnection || hubConnection.state === signalR.HubConnectionState.Disconnected) {
          void startHubConnection();
        }
      }
    });
  }
}

/**
 * Lấy hoặc khởi tạo singleton HubConnection tới /hubs/leaderboard
 */
export function getOrCreateHubConnection(): signalR.HubConnection {
  if (hubConnection) {
    return hubConnection;
  }

  if (customConnectionFactory) {
    hubConnection = customConnectionFactory();
    setupHubEventListeners(hubConnection);
    return hubConnection;
  }

  const hubUrl = getSignalRHubUrl('/hubs/leaderboard');

  hubConnection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => {
        const token = getAccessToken();
        return token || '';
      },
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  setupHubEventListeners(hubConnection);

  return hubConnection;
}

/**
 * Bắt đầu kết nối SignalR nếu chưa kết nối.
 */
export async function startHubConnection(): Promise<void> {
  const connection = getOrCreateHubConnection();

  if (connection.state === signalR.HubConnectionState.Connected) {
    notifyStatus('SUBSCRIBED');
    return;
  }

  if (
    connection.state === signalR.HubConnectionState.Connecting ||
    connection.state === signalR.HubConnectionState.Reconnecting ||
    isConnecting
  ) {
    return;
  }

  isConnecting = true;
  try {
    await connection.start();
    isConnecting = false;
    notifyStatus('SUBSCRIBED');
  } catch (err: unknown) {
    isConnecting = false;
    console.warn('[SignalR] Không thể kết nối tới LeaderboardHub:', err);
    notifyStatus('CHANNEL_ERROR');
  }
}

/**
 * Đóng kết nối SignalR an toàn
 */
export async function stopHubConnection(): Promise<void> {
  if (!hubConnection) {
    notifyStatus('CLOSED');
    return;
  }

  try {
    if (hubConnection.state !== signalR.HubConnectionState.Disconnected) {
      await hubConnection.stop();
    }
  } catch (err) {
    console.warn('[SignalR] Lỗi khi đóng kết nối:', err);
  } finally {
    hubConnection = null;
    notifyStatus('CLOSED');
  }
}

/**
 * Khởi động lại connection nếu đang có subscriber hoạt động.
 * Dùng khi chuyển đổi tài khoản, đăng nhập hoặc đăng xuất.
 */
export async function restartHubConnectionIfActive(): Promise<void> {
  if (hubConnection) {
    try {
      if (hubConnection.state !== signalR.HubConnectionState.Disconnected) {
        await hubConnection.stop();
      }
    } catch (err) {
      console.warn('[SignalR] Lỗi dừng connection khi restart:', err);
    }
    hubConnection = null;
  }

  if (eventListeners.size > 0) {
    void startHubConnection();
  }
}

/**
 * Đăng ký lắng nghe sự kiện leaderboard_updated và trạng thái kết nối SignalR.
 * Tự động quản lý lifecycle: kích hoạt single connection khi có subscriber đầu tiên,
 * và ngắt kết nối khi tất cả subscriber unmount.
 */
export function registerSignalRSubscriber(
  onUpdate: LeaderboardEventListener,
  onStatusChange?: SignalRStatusListener
): () => void {
  ensureNetworkListenersAttached();
  eventListeners.add(onUpdate);
  if (onStatusChange) {
    statusListeners.add(onStatusChange);
    // Gửi ngay status hiện tại nếu connection đã có trạng thái
    if (currentStatus !== 'CLOSED') {
      try {
        onStatusChange(currentStatus);
      } catch {}
    }
  }

  // Kết nối nếu đây là subscriber đầu tiên
  if (eventListeners.size === 1) {
    void startHubConnection();
  }

  // Hàm cleanup unmount
  return () => {
    eventListeners.delete(onUpdate);
    if (onStatusChange) {
      statusListeners.delete(onStatusChange);
    }

    // Nếu không còn subscriber nào, dọn dẹp và đóng kết nối
    if (eventListeners.size === 0) {
      void stopHubConnection();
    }
  };
}

export function getCurrentSignalRStatus(): SignalRStatus {
  return currentStatus;
}

/**
 * Test helper: phát sự kiện leaderboard_updated giả lập
 */
export function emitLeaderboardUpdateForTesting(payload?: LeaderboardUpdatePayload): void {
  notifyEvent(payload);
}

/**
 * Test helper: phát sự kiện trạng thái SignalR giả lập
 */
export function emitSignalRStatusForTesting(status: SignalRStatus): void {
  notifyStatus(status);
}

/**
 * Test helper: gán factory mock HubConnection
 */
export function setCustomConnectionFactoryForTesting(factory: ConnectionFactory | null): void {
  customConnectionFactory = factory;
}

/**
 * Helper cho testing: reset hoàn toàn state và đóng connection.
 */
export async function resetSignalRForTesting(): Promise<void> {
  eventListeners.clear();
  statusListeners.clear();
  isConnecting = false;
  currentStatus = 'CLOSED';
  customConnectionFactory = null;

  if (hubConnection) {
    try {
      if (hubConnection.state !== signalR.HubConnectionState.Disconnected) {
        await hubConnection.stop();
      }
    } catch {}
    hubConnection = null;
  }
}
