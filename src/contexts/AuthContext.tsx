import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { apiClient } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { LANDING_URL } from '@/lib/constants';
import { toast } from 'sonner';
import type { AuthUser, LoginCredentials, RegisterData, ResetPasswordData } from '@/types';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  resetPassword: (data: ResetPasswordData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (error.message?.includes('401') || error.message?.includes('403') ||
          error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
        console.error('[AuthContext] Authentication error, not retrying:', error.message);
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`[AuthContext] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);
  // Token renewal stays in the same session; login/logout invalidates pending work.
  const sessionGenerationRef = useRef(0);

  useEffect(() => {
    if (initializingRef.current || initializedRef.current) {
      console.log('[AuthContext] Skipping duplicate initialization');
      return;
    }

    initializingRef.current = true;

    const initAuth = async () => {
      const generation = sessionGenerationRef.current;
      const token = localStorage.getItem('keshless_tickets_token');
      console.log('[AuthContext] Initializing auth, token exists:', !!token);

      if (token) {
        try {
          console.log('[AuthContext] Attempting to fetch user data with retry logic...');
          const userData = await retryWithBackoff(() => apiClient.auth.getMe(), 3, 1000);

          console.log('[AuthContext] Successfully fetched user data:', {
            id: userData._id,
            email: userData.email,
            role: userData.role,
          });

          if (sessionGenerationRef.current === generation) setUser(userData);
        } catch (error: any) {
          console.error('[AuthContext] Failed to fetch user data:', error.message);

          if (error.message?.includes('401') || error.message?.includes('403') ||
              error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
            console.warn('[AuthContext] Authentication failed - token is invalid or expired');

            if (sessionGenerationRef.current === generation) {
              console.warn('[AuthContext] Removing invalid token');
              localStorage.removeItem('keshless_tickets_token');
              localStorage.removeItem('keshless_tickets_refresh_token');
            } else {
              console.warn('[AuthContext] Session already changed, not removing credentials');
            }
          } else {
            console.warn('[AuthContext] Network or temporary error, keeping token for retry on next load');
          }
        }
      } else {
        console.log('[AuthContext] No token found, user not authenticated');
      }

      setIsLoading(false);
      initializingRef.current = false;
      initializedRef.current = true;
      console.log('[AuthContext] Auth initialization complete');
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    console.log('[AuthContext] Login attempt for:', credentials.identifier);

    try {
      const response = await apiClient.auth.login(credentials);
      console.log('[AuthContext] Login successful, user:', {
        id: response.user._id,
        email: response.user.email,
        role: response.user.role,
      });

      await new Promise<void>((resolve) => {
        sessionGenerationRef.current += 1;
        setUser(response.user);
        setTimeout(() => {
          console.log('[AuthContext] User state updated, auth should be active');
          resolve();
        }, 50);
      });
    } catch (error: any) {
      console.error('[AuthContext] Login failed:', error.message);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    console.log('[AuthContext] Register attempt for:', data.businessName);

    try {
      const response = await apiClient.auth.register(data);
      console.log('[AuthContext] Registration successful, user:', {
        id: response.user._id,
        businessName: response.user.businessName,
      });

      await new Promise<void>((resolve) => {
        sessionGenerationRef.current += 1;
        setUser(response.user);
        setTimeout(() => resolve(), 50);
      });
    } catch (error: any) {
      console.error('[AuthContext] Registration failed:', error.message);
      throw error;
    }
  };

  // Password reset (step 2) signs the organizer straight in: the API returns the
  // same token + user payload as login/register, so we just adopt it. Mirrors
  // register() exactly.
  const resetPassword = async (data: ResetPasswordData) => {
    try {
      const response = await apiClient.auth.resetPassword(data);
      console.log('[AuthContext] Password reset successful, user:', {
        id: response.user._id,
        businessName: response.user.businessName,
      });

      await new Promise<void>((resolve) => {
        sessionGenerationRef.current += 1;
        setUser(response.user);
        setTimeout(() => resolve(), 50);
      });
    } catch (error: any) {
      console.error('[AuthContext] Password reset failed:', error.message);
      throw error;
    }
  };

  useEffect(() => {
    const synchronize = () => {
      if (!localStorage.getItem('keshless_tickets_token')) {
        sessionGenerationRef.current += 1;
        setUser(null);
        queryClient.clear();
      }
    };
    const restore = (event: PageTransitionEvent) => {
      // Revalidate server credentials before rendering a restored history entry.
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('storage', synchronize);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('storage', synchronize);
      window.removeEventListener('pageshow', restore);
    };
  }, [queryClient]);

  const logout = async () => {
    try {
      await apiClient.auth.logout();
    } catch (error) {
      toast.error(error instanceof Error ? `Logout failed: ${error.message}` : 'Logout failed. Please try again.');
      return;
    }
    sessionGenerationRef.current += 1;
    setUser(null);
    await queryClient.cancelQueries();
    queryClient.clear();
    if (user?.userType !== 'vendor') {
      window.location.replace('/login');
      return;
    }
    const destination = new URL(LANDING_URL);
    destination.searchParams.set('organizerLoggedOut', '1');
    window.location.replace(destination.toString());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
