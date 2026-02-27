/**
 * lib/api.js — Axios instance for calling the FastAPI backend.
 *
 * Usage:
 *   import api from '@/lib/api';
 *   const data = await api.get('/courses');
 *
 * Auth headers are added per-request via the `authFetch` hook in hooks/useAuthFetch.js
 * so that we always use the latest Clerk JWT.
 */
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
    headers: {
        "Content-Type": "application/json",
    },
});

export default api;
