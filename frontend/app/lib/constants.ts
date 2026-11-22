const PUBLIC_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export const API_BASE_URL = import.meta.env.SSR
  ? process.env.API_INTERNAL_BASE_URL || PUBLIC_API_BASE_URL
  : PUBLIC_API_BASE_URL;
