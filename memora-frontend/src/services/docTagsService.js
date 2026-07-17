import apiService from './api';

class DocTagsService {
  // Upload files
  async uploadFiles(files) {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await apiService.postForm('/doctags/upload', formData);
      return response?.files || [];
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  // Create a new DocTag (document or folder)
  async createDocTag(docTagData) {
    try {
      return await apiService.post('/doctags', docTagData);
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

      return await apiService.get(`/doctags?${params}`);
    } catch (error) {
      console.error('Get DocTags error:', error);
      throw error;
    }
  }

  // Update a DocTag
  async updateDocTag(id, updateData) {
    try {
      return await apiService.put(`/doctags/${id}`, updateData);
    } catch (error) {
      console.error('Update DocTag error:', error);
      throw error;
    }
  }

  // Delete a DocTag
  async deleteDocTag(id) {
    try {
      return await apiService.delete(`/doctags/${id}`);
    } catch (error) {
      console.error('Delete DocTag error:', error);
      throw error;
    }
  }

  // Get recent documents
  async getRecentDocuments(limit = 10) {
    try {
      return await apiService.get(`/doctags/recent?limit=${limit}`);
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
      return await apiService.get(`/doctags?${params}`);
    } catch (error) {
      console.error('Search DocTags error:', error);
      throw error;
    }
  }

  // Cleanup duplicates
  async cleanupDuplicates() {
    try {
      return await apiService.post('/doctags/cleanup-duplicates', {});
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
