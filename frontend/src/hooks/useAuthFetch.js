/**
 * hooks/useAuthFetch.js — Authenticated fetch helper using Clerk JWT.
 *
 * Returns an `authFetch` function that auto-attaches the Clerk Bearer token
 * to every request before forwarding to the FastAPI backend.
 *
 * Usage:
 *   const { authFetch } = useAuthFetch();
 *   const res = await authFetch('/courses');
 *   const data = await res.json();
 */
import { useAuth } from "@clerk/clerk-react";

export function useAuthFetch() {
    const { getToken } = useAuth();

    const authFetch = async (url, options = {}) => {
        const token = await getToken();
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

        return fetch(`${baseUrl}${url}`, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
    };

    return { authFetch };
}
