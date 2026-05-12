const RAW_API_BASE_URL = import.meta.env.VITE_API_URL;
const IS_LOCALHOST_API_BASE = typeof RAW_API_BASE_URL === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(RAW_API_BASE_URL);
const API_BASE_URL = !import.meta.env.DEV && IS_LOCALHOST_API_BASE ? '/api' : (RAW_API_BASE_URL || '/api');

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
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Upload files
  async uploadFiles(files) {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`${this.baseURL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`
        },
        body: formData
      });

      if (!response.ok) {
        let message = 'Failed to upload files';
        try {
          const errorData = await response.json();
          if (errorData?.message) {
            message = errorData.message;
          }
        } catch {
          // Ignore JSON parsing errors and keep fallback message.
        }
        throw new Error(message);
      }

      const data = await response.json();
      return data.files;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  // Create a new DocTag (document or folder)
  async createDocTag(docTagData) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(docTagData)
      });

      if (!response.ok) {
        let message = 'Failed to create DocTag';
        try {
          const errorData = await response.json();
          if (errorData?.message) {
            message = errorData.message;
          }
          if (Array.isArray(errorData?.errors) && errorData.errors.length > 0) {
            const firstError = errorData.errors[0];
            const detail = typeof firstError === 'string' ? firstError : firstError?.msg;
            if (detail) {
              message = `${message}: ${detail}`;
            }
          }
        } catch {
          // Ignore parsing errors and keep fallback message.
        }
        throw new Error(message);
      }

      return await response.json();
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

      const response = await fetch(`${this.baseURL}?${params}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch DocTags');
      }

      return await response.json();
    } catch (error) {
      console.error('Get DocTags error:', error);
      throw error;
    }
  }

  // Update a DocTag
  async updateDocTag(id, updateData) {
    try {
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        let message = 'Failed to update DocTag';
        try {
          const errorData = await response.json();
          if (errorData?.message) {
            message = errorData.message;
          }
          if (Array.isArray(errorData?.errors) && errorData.errors.length > 0) {
            const firstError = errorData.errors[0];
            const detail = typeof firstError === 'string' ? firstError : firstError?.msg;
            if (detail) {
              message = `${message}: ${detail}`;
            }
          }
        } catch {
          // Ignore parse failures and use fallback message.
        }
        throw new Error(message);
      }

      return await response.json();
    } catch (error) {
      console.error('Update DocTag error:', error);
      throw error;
    }
  }

  // Delete a DocTag
  async deleteDocTag(id) {
    try {
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to delete DocTag');
      }

      return await response.json();
    } catch (error) {
      console.error('Delete DocTag error:', error);
      throw error;
    }
  }

  // Get recent documents
  async getRecentDocuments(limit = 10) {
    try {
      const response = await fetch(`${this.baseURL}/recent?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recent documents');
      }

      return await response.json();
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

      const response = await fetch(`${this.baseURL}?${params}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to search DocTags');
      }

      return await response.json();
    } catch (error) {
      console.error('Search DocTags error:', error);
      throw error;
    }
  }

  async cleanupDuplicates() {
    try {
      const response = await fetch(`${this.baseURL}/cleanup-duplicates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup duplicates');
      }

      return await response.json();
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
