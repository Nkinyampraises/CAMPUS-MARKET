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
  verifyTwoFactorCode: (token: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendTwoFactorCode: (token: string) => Promise<{ success: boolean; error?: string; message?: string; verificationCode?: string }>;
  resendConfirmationEmail: (email: string) => Promise<{ success: boolean; error?: string; message?: string; confirmationLink?: string }>;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string; message?: string; confirmationLink?: string; requiresEmailConfirmation?: boolean }>;
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
  message?: string;
  verificationCode?: string;
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

import { API_URL } from '@/lib/api';

const normalizeUser = (user: any): User => {
  const userType = user?.userType === 'seller' ? 'seller' : 'buyer';
  const profilePicture =
    typeof user?.profilePicture === 'string'
      ? user.profilePicture
      : (typeof user?.avatar === 'string' ? user.avatar : '');

  return {
    ...user,
    userType,
    profilePicture,
    avatar: profilePicture,
  } as User;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const AUTH_REMEMBER_KEY = 'authRememberDevice';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);
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
    const activeStorage = getStorage(mode);
    const inactiveStorage = getStorage(mode === 'local' ? 'session' : 'local');
    activeStorage.setItem('currentUser', JSON.stringify(user));
    activeStorage.setItem('accessToken', token);
    activeStorage.setItem(AUTH_REMEMBER_KEY, mode === 'local' ? 'true' : 'false');
    if (nextRefreshToken) {
      activeStorage.setItem('refreshToken', nextRefreshToken);
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
    const nextAccessToken = typeof data?.accessToken === 'string' ? data.accessToken : null;
    const nextRefreshToken = typeof data?.refreshToken === 'string' ? data.refreshToken : null;
    const storageMode: 'local' | 'session' = options?.rememberDevice ? 'local' : 'session';

    if (!normalizedUser || !nextAccessToken) {
      return false;
    }

    setCurrentUser(normalizedUser);
    setAccessToken(nextAccessToken);
    setRefreshToken(nextRefreshToken);
    persistSession(normalizedUser, nextAccessToken, nextRefreshToken, storageMode);

    return true;
  };

  // Check if user is stored in localStorage on mount
  useEffect(() => {
    const readStoredSession = (mode: 'local' | 'session') => {
      const storage = getStorage(mode);
      const storedUser = storage.getItem('currentUser');
      const storedToken = storage.getItem('accessToken');
      const storedRefreshToken = storage.getItem('refreshToken');
      const rememberFlag = storage.getItem(AUTH_REMEMBER_KEY);

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
          refreshToken: storedRefreshToken || null,
        };
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        clearStorage(storage);
        return null;
      }
    };

    const storedSession = readStoredSession('local') || readStoredSession('session');
    if (storedSession) {
      sessionModeRef.current = storedSession.mode;
      setCurrentUser(storedSession.user);
      setAccessToken(storedSession.token);
      setRefreshToken(storedSession.refreshToken);
      // Verify and refresh user data
      refreshUserData(storedSession.token, storedSession.refreshToken, storedSession.mode);
    }
    setLoading(false);
  }, []);

  const refreshUserData = async (
    token: string,
    fallbackRefreshToken?: string | null,
    storageMode: 'local' | 'session' = sessionModeRef.current,
  ) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
          logout();
          return;
        }

        const retryResponse = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${nextToken}`,
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
        } else {
          logout();
        }
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
    if (refreshInFlightRef.current) {
      return await refreshInFlightRef.current;
    }

    const tokenToUse =
      tokenOverride ||
      refreshToken ||
      getStorage(sessionModeRef.current).getItem('refreshToken') ||
      localStorage.getItem('refreshToken') ||
      sessionStorage.getItem('refreshToken');
    if (!tokenToUse) {
      return null;
    }

    const runRefresh = async (): Promise<string | null> => {
      const refreshWithToken = async (token: string) => {
        return await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: token }),
        });
      };

      try {
        let response = await refreshWithToken(tokenToUse);
        let usedToken = tokenToUse;

        // Another request/tab may have already rotated tokens; retry once with the latest token.
        if (!response.ok && response.status === 401) {
          const latestToken =
            getStorage(sessionModeRef.current).getItem('refreshToken') ||
            localStorage.getItem('refreshToken') ||
            sessionStorage.getItem('refreshToken');
          if (latestToken && latestToken !== tokenToUse) {
            response = await refreshWithToken(latestToken);
            usedToken = latestToken;
          }
        }

        if (!response.ok) {
          if (response.status === 401) {
            logout();
          }
          return null;
        }

        const data = await response.json();
        const nextAccessToken = typeof data?.accessToken === 'string' ? data.accessToken : null;
        const nextRefreshToken =
          typeof data?.refreshToken === 'string' ? data.refreshToken : usedToken;

        if (!nextAccessToken || !nextRefreshToken) {
          return null;
        }

        setAccessToken(nextAccessToken);
        setRefreshToken(nextRefreshToken);
        const activeStorage = getStorage(sessionModeRef.current);
        const inactiveStorage = getStorage(sessionModeRef.current === 'local' ? 'session' : 'local');
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
    if (!refreshed) {
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
    setCurrentUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    try {
      const response = await fetch(`${API_URL}/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
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
      
      return { success: true };
    } catch (error) {
      pendingRememberDeviceRef.current = false;
      console.error('Login error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'An error occurred during login' };
    }
  };

  const verifyTwoFactorCode = async (token: string, code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_URL}/auth/verify-2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      return { success: true };
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
  ): Promise<{ success: boolean; error?: string; message?: string; confirmationLink?: string }> => {
    try {
      const response = await fetch(`${API_URL}/auth/resend-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      };
    } catch (error) {
      console.error('Resend confirmation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend confirmation email',
      };
    }
  };

  const register = async (userData: RegisterData): Promise<{ success: boolean; error?: string; message?: string; confirmationLink?: string; requiresEmailConfirmation?: boolean }> => {
    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'An error occurred during registration' };
    }
  };

  const logout = () => {
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

  const value = {
    currentUser,
    accessToken,
    refreshAuthToken,
    login,
    verifyTwoFactorCode,
    resendTwoFactorCode,
    resendConfirmationEmail,
    register,
    logout,
    isAuthenticated: currentUser !== null,
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

export type { User };

