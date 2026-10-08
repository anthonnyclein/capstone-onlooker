import { UserAccount } from '../types';

const TOKEN_KEY = 'cpms_jwt_token_v1';

export const authService = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string | null, remember: boolean = true): void {
    if (typeof window === 'undefined') return;
    if (token) {
      if (remember) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        sessionStorage.setItem(TOKEN_KEY, token);
      }
    } else {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    }
  },

  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  async login(username: string, password: string): Promise<{ token: string; user: UserAccount }> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Authentication failed. Please check your credentials.');
    }

    const data = await response.json();
    this.setToken(data.token);
    return data;
  },

  async setupCoordinator(firstName: string, lastName: string, password: string): Promise<{ token: string; user: UserAccount }> {
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initialize coordinator account.');
    }

    const data = await response.json();
    this.setToken(data.token);
    return data;
  },

  async getMe(): Promise<UserAccount | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/auth/me', {
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        this.setToken(null);
        return null;
      }
      const data = await response.json();
      return data.user;
    } catch {
      return null;
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<UserAccount> {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Password change failed.');
    }

    const data = await response.json();
    return data.user;
  },

  logout(): void {
    this.setToken(null);
  },
};

