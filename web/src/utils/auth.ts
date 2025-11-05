// Authentication utilities
const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8787/api';

export interface AuthUser {
  id: number;
  username: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
}

let refreshPromise: Promise<boolean> | null = null;
let refreshFailureHandled = false;

async function requestRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) return false;

    // Response body is not used but parsing avoids unhandled promise rejections
    await response.json().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = requestRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function handleRefreshFailure(): Promise<void> {
  if (refreshFailureHandled) return;
  refreshFailureHandled = true;

  try {
    await logout();
  } catch {
    // Ignore secondary failures while cleaning up session
  }

  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const firstResponse = await fetch(input, { ...init, credentials: 'include' });
  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    await handleRefreshFailure();
    return firstResponse;
  }

  const retryResponse = await fetch(input, { ...init, credentials: 'include' });
  if (retryResponse.status === 401) {
    await handleRefreshFailure();
  }

  return retryResponse;
}

// Check if user is authenticated by calling the /session endpoint
export async function isAuthenticated(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/session`, {
      credentials: 'include'
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Bootstrap admin user (first time setup)
export async function bootstrapAdmin(username: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE}/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Bootstrap failed' };
    }

    const data = await response.json();
    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Login
export async function login(username: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Login failed' };
    }

    const data = await response.json();
    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Get current user
export async function getCurrentUser(): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include'
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to fetch user' };
    }

    const data = await response.json();
    return { success: true, user: data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Refresh token
export async function refreshToken(): Promise<AuthResponse> {
  const success = await refreshAccessToken();
  if (!success) {
    return { success: false, error: 'Token refresh failed' };
  }
  return { success: true };
}

// Logout
export async function logout(): Promise<void> {
  try {
    // Call backend to clear HTTP-only cookies
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout request failed:', error);
  }
}

// Protected route guard - checks if user is authenticated
export async function requireAuth(): Promise<boolean> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return false;
  }
  return true;
}
