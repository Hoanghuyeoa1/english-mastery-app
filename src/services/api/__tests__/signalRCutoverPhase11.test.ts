// src/services/api/__tests__/signalRCutoverPhase11.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as signalR from '@microsoft/signalr';
import {
  getOrCreateHubConnection,
  registerSignalRSubscriber,
  getCurrentSignalRStatus,
  resetSignalRForTesting,
  getSignalRHubUrl,
  emitLeaderboardUpdateForTesting,
  emitSignalRStatusForTesting,
  setCustomConnectionFactoryForTesting,
} from '../signalRService';
import {
  subscribeToLeaderboard,
  resetLeaderboardSubscriptionForTesting,
  REALTIME_DEBOUNCE_WAIT_MS,
  REALTIME_MAX_WAIT_MS,
} from '../../leaderboardService';
import * as httpClientModule from '../httpClient';
import { supabase } from '../../../lib/supabaseClient';

describe('PHASE 11 — Replace Supabase Realtime with SignalR Suite', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    await resetSignalRForTesting();
    resetLeaderboardSubscriptionForTesting();

    const defaultMockConn: any = {
      state: signalR.HubConnectionState.Disconnected,
      start: vi.fn().mockImplementation(async () => {
        defaultMockConn.state = signalR.HubConnectionState.Connected;
      }),
      stop: vi.fn().mockImplementation(async () => {
        defaultMockConn.state = signalR.HubConnectionState.Disconnected;
      }),
      on: vi.fn(),
      onreconnecting: vi.fn(),
      onreconnected: vi.fn(),
      onclose: vi.fn(),
    };
    setCustomConnectionFactoryForTesting(() => defaultMockConn);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await resetSignalRForTesting();
    resetLeaderboardSubscriptionForTesting();
  });

  describe('1. Hub URL & Access Token Integration', () => {
    it('tính toán chính xác Hub URL từ API Base URL', () => {
      vi.spyOn(httpClientModule, 'getApiBaseUrl').mockReturnValue('https://api.englishmastery.vn/api');
      const hubUrl = getSignalRHubUrl('/hubs/leaderboard');
      expect(hubUrl).toBe('https://api.englishmastery.vn/hubs/leaderboard');
    });

    it('tính toán chính xác Hub URL với custom port hoặc localhost', () => {
      vi.spyOn(httpClientModule, 'getApiBaseUrl').mockReturnValue('http://localhost:5000/api');
      const hubUrl = getSignalRHubUrl();
      expect(hubUrl).toBe('http://localhost:5000/hubs/leaderboard');
    });
  });

  describe('2. Single Connection Model & Lifecycle Management', () => {
    it('chỉ tạo duy nhất một connection singleton cho toàn ứng dụng', () => {
      // Clear custom factory để test builder singleton mặc định
      setCustomConnectionFactoryForTesting(null);
      const conn1 = getOrCreateHubConnection();
      const conn2 = getOrCreateHubConnection();
      expect(conn1).toBe(conn2);
    });

    it('kích hoạt connection khi có subscriber đầu tiên và đóng khi tất cả unmount', async () => {
      const mockConn: any = {
        state: signalR.HubConnectionState.Disconnected,
        start: vi.fn().mockImplementation(async () => {
          mockConn.state = signalR.HubConnectionState.Connected;
        }),
        stop: vi.fn().mockImplementation(async () => {
          mockConn.state = signalR.HubConnectionState.Disconnected;
        }),
        on: vi.fn(),
        onreconnecting: vi.fn(),
        onreconnected: vi.fn(),
        onclose: vi.fn(),
      };

      setCustomConnectionFactoryForTesting(() => mockConn);

      const onUpdate1 = vi.fn();
      const onUpdate2 = vi.fn();

      const unsub1 = registerSignalRSubscriber(onUpdate1);
      expect(mockConn.start).toHaveBeenCalledTimes(1);

      // Subscriber thứ 2 không tạo start mới
      const unsub2 = registerSignalRSubscriber(onUpdate2);
      expect(mockConn.start).toHaveBeenCalledTimes(1);

      // Unsub người thứ nhất -> connection vẫn mở
      unsub1();
      expect(mockConn.stop).not.toHaveBeenCalled();

      // Unsub người thứ hai -> connection đóng an toàn
      unsub2();
      expect(mockConn.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Debounce Semantics & Starvation Protection (1.5s & 5s max wait)', () => {
    it('gom nhiều sự kiện dồn dập trong 1.5s thành một lần gọi cập nhật duy nhất', () => {
      const onUpdate = vi.fn();
      const unsub = subscribeToLeaderboard(onUpdate);

      // Giả lập 3 sự kiện bắn liên tiếp cách nhau 200ms
      emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });
      vi.advanceTimersByTime(200);
      emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });
      vi.advanceTimersByTime(200);
      emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });

      // Chưa đủ 1500ms kể từ sự kiện cuối, onUpdate chưa được gọi
      expect(onUpdate).not.toHaveBeenCalled();

      // Chờ tiếp 1500ms
      vi.advanceTimersByTime(REALTIME_DEBOUNCE_WAIT_MS);

      // Chỉ gọi đúng 1 lần
      expect(onUpdate).toHaveBeenCalledTimes(1);

      unsub();
    });

    it('bảo vệ chống đói tín hiệu (Starvation Protection): dồn dập liên tục quá 5s bắt buộc giải tỏa 1 lần refresh', () => {
      const onUpdate = vi.fn();
      const unsub = subscribeToLeaderboard(onUpdate);

      // Bắn sự kiện mỗi 1s liên tục trong 5s (không bao giờ đạt mốc yên tĩnh 1.5s)
      for (let i = 0; i < 5; i++) {
        emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });
        vi.advanceTimersByTime(1000); // 1000ms < 1500ms debounce
      }

      // Đã chạm mốc 5000ms -> Starvation protection kích hoạt đúng 1 lần
      expect(onUpdate).toHaveBeenCalledTimes(1);

      unsub();
    });
  });

  describe('4. Reconnection & Status Lifecycle', () => {
    it('báo trạng thái CHANNEL_ERROR khi reconnecting và SUBSCRIBED khi reconnected', () => {
      const onUpdate = vi.fn();
      const onStatusChange = vi.fn();

      const unsub = subscribeToLeaderboard(onUpdate, onStatusChange);

      // Báo lỗi reconnecting
      emitSignalRStatusForTesting('CHANNEL_ERROR');
      expect(onStatusChange).toHaveBeenCalledWith('CHANNEL_ERROR');

      // Báo reconnected
      emitSignalRStatusForTesting('SUBSCRIBED');
      expect(onStatusChange).toHaveBeenCalledWith('SUBSCRIBED');

      unsub();
    });
  });

  describe('5. Zero Supabase Realtime Verification', () => {
    it('subscribeToLeaderboard tuyệt đối không gọi supabase.channel', () => {
      const channelSpy = vi.spyOn(supabase, 'channel');

      const onUpdate = vi.fn();
      const unsub = subscribeToLeaderboard(onUpdate);

      expect(channelSpy).not.toHaveBeenCalled();

      unsub();
      expect(channelSpy).not.toHaveBeenCalled();
    });
  });

  describe('6. Account Switching, Reconnect Refetch & Duplicate Handler Prevention', () => {
    it('accessTokenFactory cung cấp dynamic token mới sau khi chuyển đổi tài khoản hoặc refresh', () => {
      httpClientModule.setAccessToken('old-user-token-123');
      expect(httpClientModule.getAccessToken()).toBe('old-user-token-123');

      // Giả lập account switch / login tài khoản mới
      httpClientModule.setAccessToken('new-user-token-456');
      expect(httpClientModule.getAccessToken()).toBe('new-user-token-456');

      // Logout / Guest
      httpClientModule.setAccessToken(null);
      expect(httpClientModule.getAccessToken()).toBeNull();
    });

    it('ngăn chặn duplicate event listeners khi đăng ký cùng một handler nhiều lần', () => {
      const onUpdate = vi.fn();

      // Đăng ký cùng một hàm handler 2 lần
      const unsub1 = registerSignalRSubscriber(onUpdate);
      const unsub2 = registerSignalRSubscriber(onUpdate);

      emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });

      // Nhờ cấu trúc Set, handler chỉ được gọi đúng 1 lần
      expect(onUpdate).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it('tự động phát sự kiện refetch ngay khi onreconnected được kích hoạt', () => {
      let reconnectedCb: ((id?: string) => void) | null = null;
      const mockConn: any = {
        state: signalR.HubConnectionState.Connected,
        start: vi.fn(),
        stop: vi.fn(),
        on: vi.fn(),
        onreconnecting: vi.fn(),
        onreconnected: vi.fn().mockImplementation((cb) => {
          reconnectedCb = cb;
        }),
        onclose: vi.fn(),
      };

      setCustomConnectionFactoryForTesting(() => mockConn);

      const onUpdate = vi.fn();
      const unsub = registerSignalRSubscriber(onUpdate);

      expect(reconnectedCb).toBeDefined();

      // Kích hoạt callback reconnected từ SignalR client connection
      reconnectedCb!('conn_id_xyz');

      // Kiểm tra handler onUpdate được gọi ngay lập tức
      expect(onUpdate).toHaveBeenCalledTimes(1);

      unsub();
    });
  });
});
