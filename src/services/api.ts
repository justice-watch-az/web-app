import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API service methods
export const courtCaseService = {
  getCases: (limit = 100, offset = 0) => 
    api.get('/cases', { params: { limit, offset } }),
  
  searchCases: (searchTerm: string) => 
    api.get('/cases/search', { params: { q: searchTerm } }),
  
  getStatistics: () => 
    api.get('/cases/statistics'),
  
  exportCSV: (data: any[]) => 
    api.post('/export/csv', { data }),
  
  exportJSON: (data: any[]) => 
    api.post('/export/json', { data }),
};

export const scrapingService = {
  start: (config: any) => 
    api.post('/scraping/start', config),
  
  stop: () => 
    api.post('/scraping/stop'),
  
  getStatus: () => 
    api.get('/scraping/status'),
  
  getJobs: (limit = 10) => 
    api.get('/scraping/jobs', { params: { limit } }),
};