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
}

interface AuthContextType {
  currentUser: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string }>;
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

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

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
  const [loading, setLoading] = useState(true);

  // Check if user is stored in localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    const storedToken = localStorage.getItem('accessToken');
    
    if (storedUser && storedToken) {
      setCurrentUser(normalizeUser(JSON.parse(storedUser)));
      setAccessToken(storedToken);
      // Verify and refresh user data
      refreshUserData(storedToken);
    }
    setLoading(false);
  }, []);

  const refreshUserData = async (token: string) => {
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
      } else {
        // Token invalid, clear auth
        logout();
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
      localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
      localStorage.setItem('accessToken', data.accessToken);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'An error occurred during login' };
    }
  };

  const register = async (userData: RegisterData): Promise<{ success: boolean; error?: string }> => {
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

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'An error occurred during registration' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setAccessToken(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
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

