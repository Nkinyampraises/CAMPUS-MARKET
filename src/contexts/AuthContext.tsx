import React, { createContext, useContext, useState, useEffect } from 'react';

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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string; message?: string; confirmationLink?: string; requiresEmailConfirmation?: boolean }>;
  logout: () => void;
  isAuthenticated: boolean;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is stored in localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    const storedToken = localStorage.getItem('accessToken');
    const storedRefreshToken = localStorage.getItem('refreshToken');
    
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser(normalizeUser(parsedUser));
        setAccessToken(storedToken);
        setRefreshToken(storedRefreshToken || null);
        // Verify and refresh user data
        refreshUserData(storedToken, storedRefreshToken);
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    }
    setLoading(false);
  }, []);

  const refreshUserData = async (token: string, fallbackRefreshToken?: string | null) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const normalizedUser = normalizeUser(data.user);
        setCurrentUser(normalizedUser);
        localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
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
          setCurrentUser(normalizedUser);
          localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
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
    const tokenToUse = tokenOverride || refreshToken || localStorage.getItem('refreshToken');
    if (!tokenToUse) {
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: tokenToUse }),
      });

      if (!response.ok) {
        logout();
        return null;
      }

      const data = await response.json();
      const nextAccessToken = typeof data?.accessToken === 'string' ? data.accessToken : null;
      const nextRefreshToken =
        typeof data?.refreshToken === 'string' ? data.refreshToken : tokenToUse;

      if (!nextAccessToken) {
        logout();
        return null;
      }

      setAccessToken(nextAccessToken);
      setRefreshToken(nextRefreshToken);
      localStorage.setItem('accessToken', nextAccessToken);
      localStorage.setItem('refreshToken', nextRefreshToken);
      return nextAccessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
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
        return { success: false, error: data.error || 'Login failed' };
      }

      const normalizedUser = normalizeUser(data.user);
      setCurrentUser(normalizedUser);
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken || null);
      localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      } else {
        localStorage.removeItem('refreshToken');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'An error occurred during login' };
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
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const updateProfile = async (data: Partial<User>): Promise<boolean> => {
    if (!accessToken) return false;

    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        const normalizedUser = normalizeUser(result.user);
        setCurrentUser(normalizedUser);
        localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Profile update error:', error);
      return false;
    }
  };

  const value = {
    currentUser,
    accessToken,
    refreshAuthToken,
    login,
    register,
    logout,
    isAuthenticated: currentUser !== null,
    updateProfile,
    refreshUser,
    refreshCurrentUser: refreshUser,
  };

  if (loading) {
    return null; // Or a loading spinner
  }

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

