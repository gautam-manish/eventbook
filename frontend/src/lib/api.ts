const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const AUTH_KEY = 'eventbook_auth';

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

function getToken(): string | null {
    try {
        const saved = localStorage.getItem(AUTH_KEY);
        return saved ? JSON.parse(saved).token : null;
    } catch {
        return null;
    }
}

export async function api<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
): Promise<T> {
    const token = getToken();
    let res: Response;
    try {
        res = await fetch(`${API_URL}${path}`, {
            method: options.method ?? 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
    } catch {
        throw new ApiError('Cannot reach the server. Please try again.', 0);
    }

    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new ApiError(data?.error?.message ?? 'Request failed', res.status);
    }
    return data as T;
}