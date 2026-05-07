/**
 * Supabase Client Configuration
 * 
 * Handles connection to Supabase database
 * Project: https://gidhrctnjfxzccaplkjj.supabase.co
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
export const SUPABASE_CONFIG = {
  url: 'https://gidhrctnjfxzccaplkjj.supabase.co',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
} as const;

/**
 * Initialize Supabase client
 * This is used for client-side operations (authentication, real-time subscriptions)
 * 
 * Do NOT use service role key in frontend - only anon key
 */
export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Supabase table names and types
 */
export const SUPABASE_TABLES = {
  users: 'users',
  profiles: 'profiles',
  listings: 'listings',
  messages: 'messages',
  orders: 'orders',
  reviews: 'reviews',
  payments: 'payments',
  wallets: 'wallets',
  kv_store: 'kv_store_50b25a4f',
} as const;

/**
 * Get Supabase auth session
 */
export async function getAuthSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Failed to get auth session:', error);
    return null;
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

/**
 * Sign out user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Failed to sign out:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes
 */
export function subscribeToTable(
  tableName: string,
  callback: (payload: any) => void,
  filter?: any
) {
  return supabase
    .channel(`public:${tableName}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName,
        filter,
      },
      callback
    )
    .subscribe();
}

/**
 * Unsubscribe from real-time changes
 */
export async function unsubscribeFromTable(subscription: any) {
  if (subscription) {
    await supabase.removeChannel(subscription);
  }
}

console.log('✅ Supabase Configuration:', {
  url: SUPABASE_CONFIG.url,
  hasAnonKey: !!SUPABASE_CONFIG.anonKey,
});
