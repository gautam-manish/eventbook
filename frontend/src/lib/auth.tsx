'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AUTH_KEY } from './api';
import { User } from './types';

type AuthState = {
    user: User | null;
    ready: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [ready, setReady] = useState(false);

    // Restore a saved login after a page refresh
    useEffect(() => {
        try {
            const saved = localStorage.getItem(AUTH_KEY);
            if (saved) setUser(JSON.parse(saved).user);
        } catch {
            localStorage.removeItem(AUTH_KEY);
        }
        setReady(true);
    }, []);

    function login(user: User, token: string) {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ user, token }));
        setUser(user);
    }

    function logout() {
        localStorage.removeItem(AUTH_KEY);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, ready, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}