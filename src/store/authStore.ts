import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  credits?: number;
  status?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  isAdmin: () => boolean;
  updateUserInfo: (userInfo: Partial<User>) => void;
  updateCredits: (newCredits: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),
      setLoading: (loading) => set({ isLoading: loading }),
      isAdmin: () => get().user?.role === 'admin',
      updateUserInfo: (userInfo) => 
        set((state) => ({
          user: state.user ? { ...state.user, ...userInfo } : null
        })),
      updateCredits: (newCredits) => 
        set((state) => ({
          user: state.user ? { ...state.user, credits: newCredits } : null
        })),
    }),
    {
      name: 'auth-storage',
    }
  )
);
