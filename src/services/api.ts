import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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