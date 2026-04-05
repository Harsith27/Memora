// API service for Memora frontend
// Prefer explicit env URL, otherwise use same-origin /api so Vite proxy handles dev routing.
const RAW_API_BASE_URL = import.meta.env.VITE_API_URL;
const IS_LOCALHOST_API_BASE = typeof RAW_API_BASE_URL === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(RAW_API_BASE_URL);
const API_BASE_URL = !import.meta.env.DEV && IS_LOCALHOST_API_BASE ? '/api' : (RAW_API_BASE_URL || '/api');
const FALLBACK_API_BASE_URL = 'https://memora-api-04021453.azurewebsites.net/api';
const IS_DEV = import.meta.env.DEV;

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('accessToken');

    if (IS_DEV) {
      console.log('API Base URL:', this.baseURL);
    }
  }

  createHttpError(message, status, payload = null) {
    const error = new Error(message || 'Request failed');
    error.status = status;
    error.payload = payload;
    return error;
  }

  isAuthError(error) {
    return error?.status === 401 || error?.status === 403;
  }

  isTransientError(error) {
    if (!error?.status) {
      return true;
    }
    return error.status >= 500;
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }

  // Get authentication headers
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    if (IS_DEV) {
      console.log('API Request:', {
        url,
        method: config.method || 'GET'
      });
    }

    try {
      const response = await fetch(url, config);

      if (IS_DEV) {
        console.log('API Response Status:', {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
          url: response.url
        });
      }

      const data = await response.json();

      if (IS_DEV) {
        console.log('API Response Data:', {
          success: data?.success,
          message: data?.message
        });
      }

      if (!response.ok) {
        throw this.createHttpError(
          data?.message || `HTTP error! status: ${response.status}`,
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      const isNetworkFailure = error.name === 'TypeError' && error.message.includes('fetch');

      // Some browsers/devices may fail on same-origin proxy path due stale edge routes.
      // Retry once directly against backend API before surfacing a network error.
      if (isNetworkFailure && this.baseURL === '/api') {
        try {
          const fallbackUrl = `${FALLBACK_API_BASE_URL}${endpoint}`;
          const fallbackResponse = await fetch(fallbackUrl, config);
          const fallbackData = await fallbackResponse.json();

          if (!fallbackResponse.ok) {
            throw this.createHttpError(
              fallbackData?.message || `HTTP error! status: ${fallbackResponse.status}`,
              fallbackResponse.status,
              fallbackData
            );
          }

          return fallbackData;
        } catch (fallbackError) {
          error = fallbackError;
        }
      }

      console.error('API request failed:', {
        error: error.message,
        url,
        method: config.method || 'GET'
      });

      // More specific error messages
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Check if backend is running.');
      }

      throw error;
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Authentication methods
  async register(userData) {
    const response = await this.post('/auth/register', userData);
    if (response.success && response.tokens) {
      this.setToken(response.tokens.accessToken);
      localStorage.setItem('refreshToken', response.tokens.refreshToken);
    }
    return response;
  }

  async login(credentials) {
    const response = await this.post('/auth/login', credentials);
    if (response.success && response.tokens) {
      this.setToken(response.tokens.accessToken);
      localStorage.setItem('refreshToken', response.tokens.refreshToken);
    }
    return response;
  }

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await this.post('/auth/logout', { refreshToken });
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      this.setToken(null);
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('currentUser');

      // Clear all user-specific localStorage data
      this.clearUserSpecificData();
    }
  }

  // Clear user-specific localStorage data
  clearUserSpecificData() {
    const keysToRemove = [];

    // Find all localStorage keys that might be user-specific
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('focusModeSettings_') ||
        key.includes('focusModePresets_') ||
        key.includes('userPreferences_') ||
        key.includes('userSettings_')
      )) {
        keysToRemove.push(key);
      }
    }

    // Remove all user-specific keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  async verifyToken() {
    try {
      return await this.get('/auth/verify');
    } catch (error) {
      // Keep tokens for transient/server failures so session can recover.
      if (this.isAuthError(error)) {
        this.setToken(null);
        localStorage.removeItem('refreshToken');
      }
      throw error;
    }
  }

  async refreshToken() {
    const refreshTokenValue = localStorage.getItem('refreshToken');
    if (!refreshTokenValue) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.post('/auth/refresh', { refreshToken: refreshTokenValue });
      if (response.success && response.tokens) {
        this.setToken(response.tokens.accessToken);
        localStorage.setItem('refreshToken', response.tokens.refreshToken);
      }
      return response;
    } catch (error) {
      // Only clear tokens when refresh token is truly invalid/expired.
      if (this.isAuthError(error)) {
        this.setToken(null);
        localStorage.removeItem('refreshToken');
      }
      throw error;
    }
  }

  // User methods
  async getUserProfile() {
    return this.get('/user/profile');
  }

  async updateUserProfile(userData) {
    return this.put('/user/profile', userData);
  }

  async saveEvaluationResults(results) {
    return this.post('/user/evaluation', results);
  }

  async getMemScore() {
    return this.get('/user/memscore');
  }

  async getMemScoreHistory(days = 30) {
    return this.get(`/user/memscore/history?days=${days}`);
  }

  async recordStudySession() {
    return this.post('/user/study-session');
  }

  async updateMemScore(score) {
    return this.put('/user/memscore', { memScore: score });
  }

  // Topics methods
  async getTopics(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.get(`/topics${queryString ? `?${queryString}` : ''}`);
  }

  async getDueTopics(limit = 10) {
    return this.get(`/topics/due?limit=${limit}`);
  }

  async getUpcomingTopics(days = 7, limit = 20) {
    return this.get(`/topics/upcoming?days=${days}&limit=${limit}`);
  }

  async getRevisionDailyStats(days = 120) {
    return this.get(`/topics/revision-stats?days=${days}`);
  }

  async createTopic(topicData) {
    return this.post('/topics', topicData);
  }

  async getTopic(id) {
    return this.get(`/topics/${id}`);
  }

  async updateTopic(id, topicData) {
    return this.put(`/topics/${id}`, topicData);
  }

  async deleteTopic(id) {
    return this.delete(`/topics/${id}`);
  }

  async reviewTopic(id, quality, responseTime = null) {
    const payload = { quality };
    if (responseTime !== null && responseTime !== undefined) {
      payload.responseTime = responseTime;
    }
    return this.post(`/topics/${id}/review`, payload);
  }

  async skipTopic(id) {
    return this.post(`/topics/${id}/skip`);
  }

  // Crowding prevention methods
  async getWorkload(days = 14) {
    return this.get(`/topics/workload?days=${days}`);
  }

  async preventCrowding(targetDate) {
    return this.post('/topics/prevent-crowding', {
      targetDate
    });
  }

  async moveOverdueTopics() {
    return this.post('/topics/move-overdue');
  }

  async hardSkipTodayTopics() {
    return this.post('/topics/skip-today');
  }

  async updateTopicRevisionDate(id, nextReviewDate, reason = 'manual_timeline_edit') {
    return this.request(`/topics/${id}/revision-date`, {
      method: 'PATCH',
      body: JSON.stringify({ nextReviewDate, reason }),
    });
  }

  // Journal methods
  async getJournalEntry(date) {
    return this.get(`/journal/${date}`);
  }

  async saveJournalEntry(data) {
    return this.post('/journal', data);
  }

  async getJournalRange(startDate, endDate) {
    return this.get(`/journal/range/${startDate}/${endDate}`);
  }

  async getWeeklySummary(weekStartDate) {
    return this.get(`/journal/weekly/${weekStartDate}`);
  }

  async getMonthlySummary(year, month) {
    return this.get(`/journal/monthly/${year}/${month}`);
  }

  async deleteJournalEntry(date) {
    return this.delete(`/journal/${date}`);
  }

  // Mindmaps AI generation
  async generateMindmapWithAI(topic, options = {}) {
    return this.post('/mindmaps/generate-ai', {
      topic,
      ...options
    });
  }

  // Health check
  async healthCheck() {
    return this.get('/health');
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;

// Export the class for testing
export { ApiService };
