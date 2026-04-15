export function resolveApiBaseUrl(): string {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '');
  if (backendUrl) {
    return `${backendUrl}/api`;
  }

  const fallbackApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fallbackApiUrl) {
    return fallbackApiUrl;
  }

  throw new Error(
    'Backend API URL is required. Set NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_API_URL.',
  );
}

export const API_BASE_URL = resolveApiBaseUrl();
