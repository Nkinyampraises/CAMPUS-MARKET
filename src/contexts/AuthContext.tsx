import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  university: string;
  studentId?: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isApproved: boolean;
  isBanned?: boolean;
  role: 'student' | 'admin';
  userType: 'buyer' | 'seller';
  createdAt?: string;
  subscriptionStatus?: string;
  subscriptionEndDate?: string;
  profilePicture?: string;
  avatar?: string;
  notificationPreferences?: {
    messages: boolean;
    orders: boolean;
    payments: boolean;
    rentals: boolean;
  };
  privacyOptions?: {
    showPhone: boolean;
    showEmail: boolean;
    profileVisibility: 'public' | 'private';
  };
}

interface AuthContextType {
  currentUser: User | null;
  accessToken: string | null;
  refreshAuthToken: (tokenOverride?: string | null) => Promise<string | null>;
  login: (email: string, password: string, options?: { rememberDevice?: boolean }) => Promise<LoginResult>;
  verifyTwoFactorCode: (token: string, code: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  resendTwoFactorCode: (token: string) => Promise<{ success: boolean; error?: string; message?: string; verificationCode?: string }>;
  resendConfirmationEmail: (email: string) => Promise<{ success: boolean; error?: string; message?: string; confirmationLink?: string; verificationCode?: string }>;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string; message?: string; confirmationLink?: string; requiresEmailConfirmation?: boolean; verificationMethod?: 'code' | 'link'; email?: string; verificationCode?: string }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  getSecurityStatus: () => Promise<SecurityStatus | null>;
  setupTotp: () => Promise<{ success: boolean; error?: string; secret?: string; otpauthUri?: string }>;
  enableTotp: (code: string) => Promise<{ success: boolean; error?: string; backupCodes?: string[] }>;
  disableTotp: (challengeCode?: string) => Promise<ChallengeResult>;
  regenerateBackupCodes: (challengeCode?: string) => Promise<ChallengeResult & { backupCodes?: string[] }>;
  changeEmail: (newEmail: string, currentPassword: string, challengeCode?: string) => Promise<ChallengeResult & { email?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

interface LoginResult {
  success: boolean;
  error?: string;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
  challengeType?: 'totp' | 'email';
  newDevice?: boolean;
  message?: string;
  verificationCode?: string;
  user?: User;
}

interface SecurityStatus {
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorMethod: 'totp' | 'email' | 'none';
  hasTotp: boolean;
  backupCodesRemaining: number;
}

// Shape returned by step-up gated endpoints (change password/email, disable 2FA).
interface ChallengeResult {
  success: boolean;
  error?: string;
  message?: string;
  requiresChallenge?: boolean;
  challengeType?: 'totp' | 'email';
  verificationCode?: string;
  [key: string]: unknown;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone: string;
  university: string;
  studentId?: string;
  userType?: 'buyer' | 'seller';
  profilePicture?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { API_URL, resolveClientAssetUrl } from '@/lib/api';

// Stable per-browser identifier used by the server for new-device detection.
// Persisted in localStorage so the same browser is recognized across sessions.
const DEVICE_ID_KEY = 'cm_device_id';
const getDeviceId = (): string => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
};

// Common JSON headers including the device id (and optional bearer token).
const buildAuthHeaders = (token?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-device-id': getDeviceId(),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const normalizeUser = (user: any): User => {
  const userType = user?.userType === 'seller' ? 'seller' : 'buyer';
  const profilePicture = resolveClientAssetUrl(
    typeof user?.profilePicture === 'string'
      ? user.profilePicture
      : (typeof user?.avatar === 'string' ? user.avatar : ''),
  );

  return {
    ...user,
    userType,
    profilePicture,
    avatar: profilePicture,
  } as User;
};

const normalizeStoredToken = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  let normalized = value.trim().replace(/^"(.*)"$/, '$1').trim();
  // Self-heal legacy stored values like "Bearer <token>".
  for (let i = 0; i < 2; i += 1) {
    if (!/^bearer\s+/i.test(normalized)) break;
    normalized = normalized.replace(/^bearer\s+/i, '').trim();
  }
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return normalized;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const AUTH_REMEMBER_KEY = 'authRememberDevice';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);
  const refreshBlockedRef = useRef(false);
  const pendingRememberDeviceRef = useRef(false);
  const sessionModeRef = useRef<'local' | 'session'>('local');

  const getStorage = (mode: 'local' | 'session') => (mode === 'local' ? localStorage : sessionStorage);
  const clearStorage = (storage: Storage) => {
    storage.removeItem('currentUser');
    storage.removeItem('accessToken');
    storage.removeItem('refreshToken');
    storage.removeItem(AUTH_REMEMBER_KEY);
  };
  const clearStoredSession = () => {
    clearStorage(localStorage);
    clearStorage(sessionStorage);
  };
  const persistSession = (
    user: User,
    token: string,
    nextRefreshToken: string | null,
    mode: 'local' | 'session',
  ) => {
    const normalizedAccessToken = normalizeStoredToken(token);
    const normalizedRefreshToken = normalizeStoredToken(nextRefreshToken);
    if (!normalizedAccessToken) {
      return;
    }
    const activeStorage = getStorage(mode);
    const inactiveStorage = getStorage(mode === 'local' ? 'session' : 'local');
    activeStorage.setItem('currentUser', JSON.stringify(user));
    activeStorage.setItem('accessToken', normalizedAccessToken);
    activeStorage.setItem(AUTH_REMEMBER_KEY, mode === 'local' ? 'true' : 'false');
    if (normalizedRefreshToken) {
      activeStorage.setItem('refreshToken', normalizedRefreshToken);
    } else {
      activeStorage.removeItem('refreshToken');
    }
    clearStorage(inactiveStorage);
    sessionModeRef.current = mode;
  };
  const persistUserOnly = (user: User, mode: 'local' | 'session' = sessionModeRef.current) => {
    const activeStorage = getStorage(mode);
    const inactiveStorage = getStorage(mode === 'local' ? 'session' : 'local');
    activeStorage.setItem('currentUser', JSON.stringify(user));
    inactiveStorage.removeItem('currentUser');
  };

  const applyAuthenticatedSession = (data: any, options?: { rememberDevice?: boolean }) => {
    const normalizedUser = normalizeUser(data.user);
    const nextAccessToken = normalizeStoredToken(data?.accessToken);
    const nextRefreshToken = normalizeStoredToken(data?.refreshToken);
    const storageMode: 'local' | 'session' = options?.rememberDevice ? 'local' : 'session';

    if (!normalizedUser || !nextAccessToken) {
      return false;
    }

    setCurrentUser(normalizedUser);
    setAccessToken(nextAccessToken);
    setRefreshToken(nextRefreshToken);
    refreshBlockedRef.current = false;
    persistSession(normalizedUser, nextAccessToken, nextRefreshToken, storageMode);

    return true;
  };

  // Check persisted session on mount and validate token before treating
  // the user as authenticated.
  useEffect(() => {
    let isMounted = true;

    const readStoredSession = (mode: 'local' | 'session') => {
      const storage = getStorage(mode);
      const storedUser = storage.getItem('currentUser');
      const storedToken = normalizeStoredToken(storage.getItem('accessToken'));
      const storedRefreshToken = normalizeStoredToken(storage.getItem('refreshToken'));
      const rememberFlag = storage.getItem(AUTH_REMEMBER_KEY);

      if (storedUser && !storedToken) {
        // Session payload without a valid access token is stale/invalid.
        clearStorage(storage);
        return null;
      }
      if (!storedUser || !storedToken) return null;
      if (mode === 'local' && rememberFlag !== 'true') {
        // Legacy sessions (before remember-me wiring) are cleared once to avoid forced auto-login.
        clearStorage(storage);
        return null;
      }
      try {
        const parsedUser = normalizeUser(JSON.parse(storedUser));
        return {
          mode,
          user: parsedUser,
          token: storedToken,
          refreshToken: storedRefreshToken,
        };
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        clearStorage(storage);
        return null;
      }
    };

    const bootstrapSession = async () => {
      const storedSession = readStoredSession('local') || readStoredSession('session');
      if (!storedSession) {
        if (isMounted) setLoading(false);
        return;
      }

      sessionModeRef.current = storedSession.mode;
      refreshBlockedRef.current = false;
      setAccessToken(storedSession.token);
      setRefreshToken(storedSession.refreshToken);
      await refreshUserData(storedSession.token, storedSession.refreshToken, storedSession.mode);
      if (isMounted) setLoading(false);
    };

    void bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshUserData = async (
    token: string,
    fallbackRefreshToken?: string | null,
    storageMode: 'local' | 'session' = sessionModeRef.current,
  ) => {
    const refreshTokenForHeader =
      normalizeStoredToken(fallbackRefreshToken) ||
      normalizeStoredToken(refreshToken) ||
      normalizeStoredToken(getStorage(storageMode).getItem('refreshToken')) ||
      normalizeStoredToken(localStorage.getItem('refreshToken')) ||
      normalizeStoredToken(sessionStorage.getItem('refreshToken'));

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(refreshTokenForHeader ? { 'x-refresh-token': refreshTokenForHeader } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        const normalizedUser = normalizeUser(data.user);
        const activeToken = getStorage(storageMode).getItem('accessToken') || accessToken;
        if (activeToken && activeToken !== token) {
          return;
        }
        setCurrentUser(normalizedUser);
        persistUserOnly(normalizedUser, storageMode);
      } else if (response.status === 401) {
        const nextToken = await refreshAuthToken(fallbackRefreshToken || null);
        if (!nextToken) {
          // Startup session is invalid and cannot be refreshed: clear it to avoid
          // repeated unauthorized polling loops in authenticated pages.
          logout();
          return;
        }

        const retryResponse = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${nextToken}`,
            ...(refreshTokenForHeader ? { 'x-refresh-token': refreshTokenForHeader } : {}),
          },
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const normalizedUser = normalizeUser(retryData.user);
          const activeToken = getStorage(storageMode).getItem('accessToken') || accessToken;
          if (activeToken && activeToken !== nextToken) {
            return;
          }
          setCurrentUser(normalizedUser);
          persistUserOnly(normalizedUser, storageMode);
        }
        // If retryResponse not ok, keep existing user data - access token may still work
      } else {
        // Preserve local session on non-auth errors (e.g., API misconfig or temporary outage).
        console.warn('Auth refresh failed with status:', response.status);
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const refreshUser = async () => {
    if (accessToken) {
      await refreshUserData(accessToken);
    }
  };

  const refreshAuthToken = async (tokenOverride?: string | null): Promise<string | null> => {
    if (refreshBlockedRef.current) {
      return null;
    }
    if (refreshInFlightRef.current) {
      return await refreshInFlightRef.current;
    }

    const tokenToUse =
      [
        tokenOverride,
        refreshToken,
        getStorage(sessionModeRef.current).getItem('refreshToken'),
        localStorage.getItem('refreshToken'),
        sessionStorage.getItem('refreshToken'),
      ]
        .map((candidate) => normalizeStoredToken(candidate) || '')
        .find(Boolean) || '';
    if (!tokenToUse) {
      return null;
    }

    const runRefresh = async (): Promise<string | null> => {
      const activeStorage = getStorage(sessionModeRef.current);
      const inactiveStorage = getStorage(sessionModeRef.current === 'local' ? 'session' : 'local');

      const refreshWithToken = async (token: string) => {
        const normalizedToken = token.trim();
        return await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-refresh-token': normalizedToken,
          },
          body: JSON.stringify({ refreshToken: normalizedToken }),
        });
      };

      try {
        let response = await refreshWithToken(tokenToUse);
        let usedToken = tokenToUse;

        // Another request/tab may have already rotated tokens; retry once with the latest token.
        if (!response.ok && response.status === 401) {
          const latestToken =
            (
              normalizeStoredToken(getStorage(sessionModeRef.current).getItem('refreshToken')) ||
              normalizeStoredToken(localStorage.getItem('refreshToken')) ||
              normalizeStoredToken(sessionStorage.getItem('refreshToken')) ||
              ''
            );
          if (latestToken && latestToken !== tokenToUse) {
            response = await refreshWithToken(latestToken);
            usedToken = latestToken;
          }
        }

        if (!response.ok) {
          if (response.status === 401) {
            refreshBlockedRef.current = true;
            setRefreshToken(null);
            setAccessToken(null);
            activeStorage.removeItem('refreshToken');
            activeStorage.removeItem('accessToken');
            inactiveStorage.removeItem('refreshToken');
            inactiveStorage.removeItem('accessToken');
          }
          return null;
        }

        const data = await response.json();
        const nextAccessToken = normalizeStoredToken(data?.accessToken);
        const nextRefreshToken = normalizeStoredToken(data?.refreshToken) || normalizeStoredToken(usedToken);

        if (!nextAccessToken || !nextRefreshToken) {
          return null;
        }

        setAccessToken(nextAccessToken);
        setRefreshToken(nextRefreshToken);
        activeStorage.setItem('accessToken', nextAccessToken);
        activeStorage.setItem('refreshToken', nextRefreshToken);
        activeStorage.setItem(
          AUTH_REMEMBER_KEY,
          sessionModeRef.current === 'local' ? 'true' : 'false',
        );
        inactiveStorage.removeItem('accessToken');
        inactiveStorage.removeItem('refreshToken');
        return nextAccessToken;
      } catch (error) {
        console.error('Token refresh error:', error);
        return null;
      } finally {
        refreshInFlightRef.current = null;
      }
    };

    refreshInFlightRef.current = runRefresh();
    const refreshed = await refreshInFlightRef.current;
    if (!refreshed && accessToken) {
      // Only log out if we couldn't refresh and there's no access token to fall back on
      // But first try using whatever access token we have one more time
      try {
        const verifyResponse = await fetch(`${API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (verifyResponse.ok) {
          // Access token is still valid, just don't refresh
          return accessToken;
        }
      } catch (e) {
        // ignore
      }
      logout();
    }
    return refreshed;
  };

  const login = async (
    email: string,
    password: string,
    options?: { rememberDevice?: boolean },
  ): Promise<LoginResult> => {
    pendingRememberDeviceRef.current = options?.rememberDevice === true;
    // Ensure stale sessions don't bleed into the next login.
    clearStoredSession();
    refreshBlockedRef.current = false;
    setCurrentUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    try {
      const response = await fetch(`${API_URL}/signin`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({ email, password, rememberDevice: options?.rememberDevice === true }),
      });

      const data = await response.json();

      if (!response.ok) {
        pendingRememberDeviceRef.current = false;
        return { success: false, error: data.error || 'Login failed' };
      }

      if (data?.requiresTwoFactor && typeof data?.twoFactorToken === 'string') {
        return {
          success: false,
          requiresTwoFactor: true,
          twoFactorToken: data.twoFactorToken,
          challengeType: data?.challengeType === 'totp' ? 'totp' : 'email',
          newDevice: data?.newDevice === true,
          message: typeof data?.message === 'string' ? data.message : 'Enter the verification code to continue.',
          verificationCode: typeof data?.verificationCode === 'string' ? data.verificationCode : undefined,
        };
      }

      const applied = applyAuthenticatedSession(data, {
        rememberDevice: pendingRememberDeviceRef.current,
      });
      pendingRememberDeviceRef.current = false;
      if (!applied) {
        return { success: false, error: 'Login response was incomplete. Please try again.' };
      }

      return { success: true, user: normalizeUser(data.user) };
    } catch (error) {
      pendingRememberDeviceRef.current = false;
      console.error('Login error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'An error occurred during login' };
    }
  };

  const verifyTwoFactorCode = async (token: string, code: string): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const response = await fetch(`${API_URL}/auth/verify-2fa`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({ token, code }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { success: false, error: data.error || 'Invalid verification code' };
      }

      const applied = applyAuthenticatedSession(data, {
        rememberDevice: pendingRememberDeviceRef.current,
      });
      pendingRememberDeviceRef.current = false;
      if (!applied) {
        return { success: false, error: 'Could not complete sign in. Please try again.' };
      }

      return { success: true, user: normalizeUser(data.user) };
    } catch (error) {
      pendingRememberDeviceRef.current = false;
      console.error('Two-factor verification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify code',
      };
    }
  };

  const resendTwoFactorCode = async (
    token: string,
  ): Promise<{ success: boolean; error?: string; message?: string; verificationCode?: string }> => {
    try {
      const response = await fetch(`${API_URL}/auth/resend-2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to resend verification code' };
      }

      return {
        success: true,
        message: typeof data?.message === 'string' ? data.message : 'A new verification code was sent.',
        verificationCode: typeof data?.verificationCode === 'string' ? data.verificationCode : undefined,
      };
    } catch (error) {
      console.error('Two-factor resend error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend verification code',
      };
    }
  };

  const resendConfirmationEmail = async (
    email: string,
  ): Promise<{ success: boolean; error?: string; message?: string; confirmationLink?: string; verificationCode?: string }> => {
    try {
      const response = await fetch(`${API_URL}/auth/resend-confirmation`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to resend confirmation email' };
      }

      return {
        success: true,
        message: typeof data?.message === 'string' ? data.message : 'Confirmation email sent.',
        confirmationLink: typeof data?.confirmationLink === 'string' ? data.confirmationLink : undefined,
        verificationCode: typeof data?.verificationCode === 'string' ? data.verificationCode : undefined,
      };
    } catch (error) {
      console.error('Resend confirmation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend confirmation email',
      };
    }
  };

  const register = async (userData: RegisterData): Promise<{ success: boolean; error?: string; message?: string; confirmationLink?: string; requiresEmailConfirmation?: boolean; verificationMethod?: 'code' | 'link'; email?: string; verificationCode?: string }> => {
    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          phone: userData.phone,
          university: userData.university,
          studentId: userData.studentId,
          userType: userData.userType || 'buyer',
          profilePicture: userData.profilePicture || '',
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          error:
            data.error ||
            data.message ||
            response.statusText ||
            `Registration failed (${response.status})`,
        };
      }

      return {
        success: true,
        message: typeof data?.message === 'string' ? data.message : undefined,
        confirmationLink: typeof data?.confirmationLink === 'string' ? data.confirmationLink : undefined,
        requiresEmailConfirmation: Boolean(data?.requiresEmailConfirmation),
        verificationMethod: data?.verificationMethod === 'code' ? 'code' : data?.verificationMethod === 'link' ? 'link' : undefined,
        email: typeof data?.email === 'string' ? data.email : undefined,
        verificationCode: typeof data?.verificationCode === 'string' ? data.verificationCode : undefined,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'An error occurred during registration' };
    }
  };

  const logout = () => {
    refreshBlockedRef.current = true;
    setCurrentUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    pendingRememberDeviceRef.current = false;
    clearStoredSession();
  };

  const updateProfile = async (data: Partial<User>): Promise<{ success: boolean; error?: string }> => {
    const token =
      accessToken ||
      getStorage(sessionModeRef.current).getItem('accessToken') ||
      localStorage.getItem('accessToken') ||
      sessionStorage.getItem('accessToken');
    if (!token) {
      return { success: false, error: 'Please log in again and try once more.' };
    }

    try {
      const makeRequest = (authToken: string) =>
        fetch(`${API_URL}/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify(data),
        });

      let response = await makeRequest(token);
      let result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        const refreshedToken = await refreshAuthToken();
        if (refreshedToken) {
          response = await makeRequest(refreshedToken);
          result = await response.json().catch(() => ({}));
        }
      }

      if (response.ok) {
        const normalizedUser = normalizeUser(result.user);
        setCurrentUser(normalizedUser);
        persistUserOnly(normalizedUser);
        return { success: true };
      }

      return {
        success: false,
        error:
          result?.error ||
          result?.message ||
          (response.status === 401
            ? 'Your session expired. Please log in again.'
            : `Profile update failed (${response.status})`),
      };
    } catch (error) {
      console.error('Profile update error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile',
      };
    }
  };

  // Resolve the freshest access token available (state or storage), matching
  // the pattern used by updateProfile.
  const resolveAccessToken = () =>
    accessToken ||
    getStorage(sessionModeRef.current).getItem('accessToken') ||
    localStorage.getItem('accessToken') ||
    sessionStorage.getItem('accessToken');

  // Authenticated request that transparently retries once after a token refresh.
  const authedRequest = async (path: string, init: { method: string; body?: unknown }) => {
    const token = resolveAccessToken();
    if (!token) {
      return { ok: false, status: 401, data: { error: 'Please log in again and try once more.' } };
    }
    const send = (authToken: string) =>
      fetch(`${API_URL}${path}`, {
        method: init.method,
        headers: buildAuthHeaders(authToken),
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });

    let response = await send(token);
    let data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      const refreshed = await refreshAuthToken();
      if (refreshed) {
        response = await send(refreshed);
        data = await response.json().catch(() => ({}));
      }
    }
    return { ok: response.ok, status: response.status, data };
  };

  // Verify a 6-digit signup email-verification code (unauthenticated).
  const verifyEmailCode = async (
    email: string,
    code: string,
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    try {
      const response = await fetch(`${API_URL}/auth/verify-email-code`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { success: false, error: data?.error || 'Invalid verification code' };
      }
      return { success: true, message: typeof data?.message === 'string' ? data.message : undefined };
    } catch (error) {
      console.error('Verify email code error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to verify code' };
    }
  };

  const getSecurityStatus = async (): Promise<SecurityStatus | null> => {
    const { ok, data } = await authedRequest('/auth/2fa/status', { method: 'GET' });
    if (!ok || !data || typeof data !== 'object') {
      return null;
    }
    return {
      emailVerified: Boolean((data as any).emailVerified),
      twoFactorEnabled: Boolean((data as any).twoFactorEnabled),
      twoFactorMethod: ((data as any).twoFactorMethod ?? 'none') as SecurityStatus['twoFactorMethod'],
      hasTotp: Boolean((data as any).hasTotp),
      backupCodesRemaining: Number((data as any).backupCodesRemaining) || 0,
    };
  };

  // Begin TOTP enrollment — returns the secret + otpauth URI to render a QR code.
  const setupTotp = async (): Promise<{
    success: boolean;
    error?: string;
    secret?: string;
    otpauthUri?: string;
  }> => {
    const { ok, data } = await authedRequest('/auth/2fa/setup', { method: 'POST', body: {} });
    if (!ok) {
      return { success: false, error: (data as any)?.error || 'Could not start two-factor setup' };
    }
    return { success: true, secret: (data as any)?.secret, otpauthUri: (data as any)?.otpauthUri };
  };

  // Confirm enrollment with a code; returns one-time backup codes on success.
  const enableTotp = async (
    code: string,
  ): Promise<{ success: boolean; error?: string; backupCodes?: string[] }> => {
    const { ok, data } = await authedRequest('/auth/2fa/enable', { method: 'POST', body: { code } });
    if (!ok) {
      return { success: false, error: (data as any)?.error || 'Could not enable two-factor authentication' };
    }
    return { success: true, backupCodes: Array.isArray((data as any)?.backupCodes) ? (data as any).backupCodes : [] };
  };

  const disableTotp = async (challengeCode?: string): Promise<ChallengeResult> => {
    const { ok, data } = await authedRequest('/auth/2fa/disable', {
      method: 'POST',
      body: { challengeCode },
    });
    return { success: ok && (data as any)?.success !== false, ...(data as any) };
  };

  const regenerateBackupCodes = async (
    challengeCode?: string,
  ): Promise<ChallengeResult & { backupCodes?: string[] }> => {
    const { ok, data } = await authedRequest('/auth/2fa/backup-codes/regenerate', {
      method: 'POST',
      body: { challengeCode },
    });
    return { success: ok && (data as any)?.success !== false, ...(data as any) };
  };

  const changeEmail = async (
    newEmail: string,
    currentPassword: string,
    challengeCode?: string,
  ): Promise<ChallengeResult & { email?: string }> => {
    const { ok, data } = await authedRequest('/auth/change-email', {
      method: 'POST',
      body: { newEmail, currentPassword, challengeCode },
    });
    return { success: ok && (data as any)?.success !== false, ...(data as any) };
  };

  const hasStoredSessionToken = (() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return Boolean(
      normalizeStoredToken(localStorage.getItem('accessToken')) ||
      normalizeStoredToken(sessionStorage.getItem('accessToken')) ||
      normalizeStoredToken(localStorage.getItem('refreshToken')) ||
      normalizeStoredToken(sessionStorage.getItem('refreshToken')),
    );
  })();
  const isAuthenticated = currentUser !== null && (Boolean(accessToken || refreshToken) || hasStoredSessionToken);

  const value = {
    currentUser,
    accessToken,
    refreshAuthToken,
    login,
    verifyTwoFactorCode,
    resendTwoFactorCode,
    resendConfirmationEmail,
    register,
    verifyEmailCode,
    getSecurityStatus,
    setupTotp,
    enableTotp,
    disableTotp,
    regenerateBackupCodes,
    changeEmail,
    logout,
    isAuthenticated,
    updateProfile,
    refreshUser,
    refreshCurrentUser: refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { User, SecurityStatus, ChallengeResult };

