/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePWA, BeforeInstallPromptEvent } from '../usePWA';

// Mock module virtual:pwa-register/react
const mockSetOfflineReady = vi.fn();
const mockSetNeedRefresh = vi.fn();
const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [false, mockSetOfflineReady],
    needRefresh: [false, mockSetNeedRefresh],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}));

describe('usePWA hook (PWA Lifecycle, Network Status & A2HS Install)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('1. Quản lý trạng thái isOffline chính xác khi bắt sự kiện online và offline', () => {
    const { result } = renderHook(() => usePWA());

    // Mặc định ban đầu navigator.onLine = true -> isOffline = false
    expect(result.current.isOffline).toBe(false);

    // Kích hoạt sự kiện mất kết nối (offline)
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOffline).toBe(true);

    // Kích hoạt sự kiện có mạng trở lại (online)
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOffline).toBe(false);
  });

  it('2. Bắt sự kiện beforeinstallprompt, cập nhật isInstallable và gọi hàm installApp chuẩn xác', async () => {
    const { result } = renderHook(() => usePWA());

    // Ban đầu chưa có sự kiện beforeinstallprompt -> isInstallable = false
    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isInstalled).toBe(false);

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockPreventDefault = vi.fn();
    const fakeInstallPromptEvent = {
      preventDefault: mockPreventDefault,
      prompt: mockPrompt,
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    } as unknown as BeforeInstallPromptEvent;

    // Giả lập trình duyệt bắn event beforeinstallprompt
    act(() => {
      const event = new Event('beforeinstallprompt');
      Object.assign(event, fakeInstallPromptEvent);
      window.dispatchEvent(event);
    });

    expect(result.current.isInstallable).toBe(true);

    // Người dùng nhấn Cài đặt ứng dụng
    let installSuccess = false;
    await act(async () => {
      installSuccess = await result.current.installApp();
    });

    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(installSuccess).toBe(true);
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('3. Khi người dùng từ chối (dismissed), installApp trả về false và không đánh dấu đã cài đặt', async () => {
    const { result } = renderHook(() => usePWA());

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const fakeDismissedPromptEvent = {
      preventDefault: vi.fn(),
      prompt: mockPrompt,
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    } as unknown as BeforeInstallPromptEvent;

    act(() => {
      const event = new Event('beforeinstallprompt');
      Object.assign(event, fakeDismissedPromptEvent);
      window.dispatchEvent(event);
    });

    expect(result.current.isInstallable).toBe(true);

    let installSuccess = true;
    await act(async () => {
      installSuccess = await result.current.installApp();
    });

    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(installSuccess).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('4. Tự động nhận diện đã cài đặt khi có sự kiện appinstalled', () => {
    const { result } = renderHook(() => usePWA());

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('5. Hàm closePrompt gọi setter tắt thông báo cần cập nhật và sẵn sàng offline', () => {
    const { result } = renderHook(() => usePWA());

    act(() => {
      result.current.closePrompt();
    });

    expect(mockSetOfflineReady).toHaveBeenCalledWith(false);
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });
});
