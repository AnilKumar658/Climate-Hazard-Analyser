import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 min timeout for data fetching
});

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.params);
  return config;
});

// Response error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg =
      error.response?.data?.detail ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(msg));
  }
);

/**
 * Analyze climate hazards for a given region and time range.
 */
export const analyzeHazard = async (params) => {
  const { data } = await api.get('/analyze', { params });
  return data;
};

/**
 * Search for geographic regions by name.
 */
export const searchRegions = async (query) => {
  const { data } = await api.get('/regions/search', { params: { q: query, limit: 6 } });
  return data;
};

/**
 * Build export URL for CSV download.
 */
export const getCSVExportURL = (params) => {
  const qs = new URLSearchParams(params).toString();
  return `${API_BASE}/export/csv?${qs}`;
};

/**
 * Build export URL for PDF download.
 */
export const getPDFExportURL = (params) => {
  const qs = new URLSearchParams(params).toString();
  return `${API_BASE}/export/pdf?${qs}`;
};

export default api;
