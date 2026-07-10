const RAW_API_BASE_URL = import.meta.env.VITE_API_URL;
const IS_LOCALHOST_API_BASE = typeof RAW_API_BASE_URL === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(RAW_API_BASE_URL);
const API_BASE_URL = !import.meta.env.DEV && IS_LOCALHOST_API_BASE ? '/api' : (RAW_API_BASE_URL || '/api');
const FALLBACK_API_BASE_URL = 'https://memora-api-04021453.azurewebsites.net/api';

function isNetworkFetchError(error) {
  return error?.name === 'TypeError' && typeof error?.message === 'string' && error.message.includes('fetch');
}

async function readResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class DocTagsService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/doctags`;
  }

  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  // Get authorization headers
  getAuthHeaders() {
    const token = this.getAccessToken();
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async fetchJsonWithFallback(path, options = {}, allowFallback = true) {
    const primaryUrl = `${this.baseURL}${path}`;
    const fallbackUrl = `${FALLBACK_API_BASE_URL}/doctags${path}`;

    const executeRequest = async (url) => {
      const response = await fetch(url, options);

      if (!response.ok) {
        const payload = await readResponseBody(response);
        const error = new Error(payload?.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      return readResponseBody(response);
    };

    try {
      return await executeRequest(primaryUrl);
    } catch (error) {
      const shouldFallback = allowFallback && API_BASE_URL === '/api' && (isNetworkFetchError(error) || (typeof error?.status === 'number' && error.status >= 500));

      if (!shouldFallback) {
        throw error;
      }

      return await executeRequest(fallbackUrl);
    }
  }

  // Upload files
  async uploadFiles(files) {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await this.fetchJsonWithFallback('/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`
        },
        body: formData
      });

      return response?.files || [];
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  // Create a new DocTag (document or folder)
  async createDocTag(docTagData) {
    try {
      return await this.fetchJsonWithFallback('', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(docTagData)
      });
    } catch (error) {
      console.error('Create DocTag error:', error);
      throw error;
    }
  }

  // Get DocTags with optional filtering
  async getDocTags(options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.parentId !== undefined) {
        params.append('parentId', options.parentId);
      }
      if (options.type) params.append('type', options.type);
      if (options.search) params.append('search', options.search);
      if (options.limit) params.append('limit', options.limit);
      if (options.page) params.append('page', options.page);

      return await this.fetchJsonWithFallback(`?${params}`, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Get DocTags error:', error);
      throw error;
    }
  }

  // Update a DocTag
  async updateDocTag(id, updateData) {
    try {
      return await this.fetchJsonWithFallback(`/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updateData)
      });
    } catch (error) {
      console.error('Update DocTag error:', error);
      throw error;
    }
  }

  // Delete a DocTag
  async deleteDocTag(id) {
    try {
      return await this.fetchJsonWithFallback(`/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Delete DocTag error:', error);
      throw error;
    }
  }

  // Get recent documents
  async getRecentDocuments(limit = 10) {
    try {
      return await this.fetchJsonWithFallback(`/recent?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Get recent documents error:', error);
      throw error;
    }
  }

  // Search DocTags
  async searchDocTags(query, options = {}) {
    try {
      const params = new URLSearchParams();
      params.append('search', query);
      
      if (options.type) params.append('type', options.type);
      if (options.limit) params.append('limit', options.limit);

      return await this.fetchJsonWithFallback(`?${params}`, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Search DocTags error:', error);
      throw error;
    }
  }

  async cleanupDuplicates() {
    try {
      return await this.fetchJsonWithFallback('/cleanup-duplicates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`
        }
      });
    } catch (error) {
      console.error('Cleanup duplicates error:', error);
      throw error;
    }
  }

  // Helper method to create a document from topic resources
  async createDocumentFromTopic(topicData) {
    const docTagData = {
      name: topicData.title,
      description: topicData.content ? topicData.content.substring(0, 500) : '',
      type: 'document',
      tags: topicData.tags || [],
      attachments: topicData.attachments || [],
      externalLinks: topicData.externalLinks || []
    };

    return await this.createDocTag(docTagData);
  }
}

// Create and export a singleton instance
const docTagsService = new DocTagsService();
export default docTagsService;
