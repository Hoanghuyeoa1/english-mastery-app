// src/services/api/authApi.ts
import { fetchApi, setAccessToken, setRefreshHandler } from './httpClient';

export interface UserDto {
  id: string; // Canonical Guid
  email: string;
  displayName: string;
  roles?: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
  user: UserDto;
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  displayName: string;
  level: number;
  xp: number;
  streak: number;
  equippedFrame?: string | null;
  createdAt: string;
  roles?: string[];
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await fetchApi<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipAutoRefresh: true,
    });
    setAccessToken(res.accessToken);
    return res;
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await fetchApi<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipAutoRefresh: true,
    });
    setAccessToken(res.accessToken);
    return res;
  },

  async refresh(refreshToken?: string): Promise<AuthResponse> {
    const res = await fetchApi<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refreshToken || null }),
      skipAuth: true,
      skipAutoRefresh: true,
    });
    setAccessToken(res.accessToken);
    return res;
  },

  async logout(refreshToken?: string): Promise<void> {
    try {
      await fetchApi<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refreshToken || null }),
        skipAutoRefresh: true,
      });
    } finally {
      setAccessToken(null);
    }
  },

  async getMe(): Promise<CurrentUserResponse> {
    return await fetchApi<CurrentUserResponse>('/auth/me', {
      method: 'GET',
    });
  },

  async getGoogleAuthUrl(returnUrl?: string): Promise<{ authorizationUrl: string; state: string; nonce: string; codeChallenge: string }> {
    const url = `/auth/google/initiate?json=true${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`;
    return await fetchApi<{ authorizationUrl: string; state: string; nonce: string; codeChallenge: string }>(url, {
      method: 'GET',
      skipAuth: true,
    });
  },

  async exchangeGoogleCode(exchangeCode: string): Promise<AuthResponse> {
    const res = await fetchApi<AuthResponse>('/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ exchangeCode }),
      skipAuth: true,
      skipAutoRefresh: true,
    });
    setAccessToken(res.accessToken);
    return res;
  },

  async directGoogleCallback(code: string, state: string): Promise<AuthResponse> {
    const res = await fetchApi<AuthResponse>('/auth/google/direct-callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
      skipAuth: true,
      skipAutoRefresh: true,
    });
    setAccessToken(res.accessToken);
    return res;
  },

  async linkGoogle(payload: { code?: string; state?: string; idToken?: string }): Promise<void> {
    await fetchApi<void>('/auth/google/link', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async linkGoogleWithCredentials(payload: { email: string; password: string; code?: string; state?: string; idToken?: string }): Promise<AuthResponse> {
    const res = await fetchApi<AuthResponse>('/auth/google/link-with-credentials', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipAutoRefresh: true,
    });
    setAccessToken(res.accessToken);
    return res;
  },

  async unlinkGoogle(): Promise<void> {
    await fetchApi<void>('/auth/google/unlink', {
      method: 'POST',
    });
  },

  async getGoogleStatus(): Promise<{ isLinked: boolean; googleEmail?: string; hasPassword: boolean }> {
    return await fetchApi<{ isLinked: boolean; googleEmail?: string; hasPassword: boolean }>('/auth/google/status', {
      method: 'GET',
    });
  },
};

// Wire up automatic refresh handler in httpClient
setRefreshHandler(async () => {
  try {
    const res = await authApi.refresh();
    return res.accessToken;
  } catch {
    return null;
  }
});
