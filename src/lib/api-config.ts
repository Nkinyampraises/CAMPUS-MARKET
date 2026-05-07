/**
 * Frontend API Configuration
 * 
 * Handles connection to the backend server
 * - Development: http://localhost:3000
 * - Production: https://market-backend.onrender.com
 * 
 * Environment Variables:
 * - VITE_API_URL: Backend URL (defaults to Render backend in production)
 * - VITE_LOCAL_API_URL: Local development URL (defaults to localhost:3000)
 */

// Backend API Configuration
export const BACKEND_CONFIG = {
  // Production backend URL (Render)
  production: 'https://market-backend.onrender.com',
  
  // Development backend URL (local)
  development: 'http://localhost:3000',
  
  // Frontend application URL (Vercel)
  frontend: 'https://market-ebon-one.vercel.app',
} as const;

/**
 * Get the appropriate backend URL based on environment
 */
export function getBackendUrl(): string {
  // If we're in a browser environment
  if (typeof window !== 'undefined') {
    // If on localhost, use local backend
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return BACKEND_CONFIG.development;
    }
    
    // Otherwise use production backend
    return BACKEND_CONFIG.production;
  }
  
  // Server-side: default to production
  return BACKEND_CONFIG.production;
}

/**
 * Get API base URL with proper path
 */
export function getApiBaseUrl(): string {
  const backendUrl = getBackendUrl();
  return backendUrl.replace(/\/$/, ''); // Remove trailing slash
}

export const API_ROUTE_SEGMENT = 'make-server-50b25a4f';

export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  // Health Check
  health: () => getApiUrl(`/${API_ROUTE_SEGMENT}/health`),
  
  // Authentication
  signup: () => getApiUrl(`/${API_ROUTE_SEGMENT}/signup`),
  signin: () => getApiUrl(`/${API_ROUTE_SEGMENT}/signin`),
  refresh: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/refresh`),
  me: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/me`),
  updateProfile: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/profile`),
  changePassword: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/change-password`),
  forgotPassword: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/forgot-password`),
  resetPassword: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/reset-password`),
  confirmEmail: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/confirm-email`),
  resendConfirmation: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/resend-confirmation`),
  verify2fa: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/verify-2fa`),
  resend2fa: () => getApiUrl(`/${API_ROUTE_SEGMENT}/auth/resend-2fa`),
  
  // User
  getUser: (id: string) => getApiUrl(`/${API_ROUTE_SEGMENT}/users/${id}`),
  
  // Listings
  listings: () => getApiUrl(`/${API_ROUTE_SEGMENT}/listings`),
  createListing: () => getApiUrl(`/${API_ROUTE_SEGMENT}/listings`),
  getListing: (id: string) => getApiUrl(`/${API_ROUTE_SEGMENT}/listings/${id}`),
  updateListing: (id: string) => getApiUrl(`/${API_ROUTE_SEGMENT}/listings/${id}`),
  deleteListing: (id: string) => getApiUrl(`/${API_ROUTE_SEGMENT}/listings/${id}`),
  viewListing: (id: string) => getApiUrl(`/${API_ROUTE_SEGMENT}/listings/${id}/view`),
  userListings: () => getApiUrl(`/${API_ROUTE_SEGMENT}/listings/user`),
  
  // Messages
  messages: () => getApiUrl(`/${API_ROUTE_SEGMENT}/messages`),
  sendMessage: () => getApiUrl(`/${API_ROUTE_SEGMENT}/messages`),
  getConversations: () => getApiUrl(`/${API_ROUTE_SEGMENT}/messages`),
  markMessageRead: (id: string) => getApiUrl(`/${API_ROUTE_SEGMENT}/messages/${id}/read`),
  updateMessage: (id: string) => getApiUrl(`/${API_ROUTE_SEGMENT}/messages/${id}`),
  deleteMessage: (id: string) => getApiUrl(`/${API_ROUTE_SEGMENT}/messages/${id}`),
  deleteConversation: (userId: string) => getApiUrl(`/${API_ROUTE_SEGMENT}/conversations/${userId}`),
} as const;

/**
 * Make API request with proper error handling
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = typeof endpoint === 'function' ? endpoint() : endpoint;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Add auth token if available
  const token = localStorage.getItem('accessToken');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error [${options.method || 'GET'} ${url}]:`, error);
    throw error;
  }
}

// Export for backward compatibility
export const API_BASE = getApiBaseUrl();
export const API_URL = getApiBaseUrl();

console.log('🔗 API Configuration:', {
  backendUrl: getBackendUrl(),
  baseUrl: getApiBaseUrl(),
  environment: typeof window !== 'undefined' ? 'browser' : 'server',
  isDevelopment: typeof window !== 'undefined' && (window.location.hostname === 'localhost'),
});
