import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

export const useTopics = () => {
  const [topics, setTopics] = useState([]);
  const [dueTopics, setDueTopics] = useState([]);
  const [upcomingTopics, setUpcomingTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch due topics for today
  const fetchDueTopics = useCallback(async (limit = 10) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getDueTopics(limit);
      if (response.success) {
        setDueTopics(response.topics);
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch due topics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch upcoming topics
  const fetchUpcomingTopics = useCallback(async (days = 7, limit = 20) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getUpcomingTopics(days, limit);
      if (response.success) {
        setUpcomingTopics(response.topics);
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch upcoming topics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all topics with filters
  const fetchTopics = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTopics(params);
      if (response.success) {
        setTopics(response.topics);
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch topics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new topic
  const createTopic = useCallback(async (topicData) => {
    try {
      setLoading(true);
      setError(null);
      console.log('useTopics: Creating topic with data:', topicData);
      console.log('useTopics: Current token in localStorage:', localStorage.getItem('accessToken'));
      const response = await apiService.createTopic(topicData);
      console.log('useTopics: API response:', response);
      if (response.success) {
        // Refresh the topics lists
        await Promise.all([
          fetchDueTopics(),
          fetchUpcomingTopics(),
          fetchTopics()
        ]);
        return response;
      } else {
        throw new Error(response.message || 'Failed to create topic');
      }
    } catch (err) {
      console.error('useTopics: Failed to create topic:', err);
      console.error('useTopics: Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchDueTopics, fetchUpcomingTopics, fetchTopics]);

  // Update a topic
  const updateTopic = useCallback(async (id, topicData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.updateTopic(id, topicData);
      if (response.success) {
        // Update the topic in all relevant lists
        const updatedTopic = response.topic;
        
        setTopics(prev => prev.map(topic => 
          topic._id === id ? updatedTopic : topic
        ));
        
        setDueTopics(prev => prev.map(topic => 
          topic._id === id ? updatedTopic : topic
        ));
        
        setUpcomingTopics(prev => prev.map(topic => 
          topic._id === id ? updatedTopic : topic
        ));
        
        return response;
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to update topic:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete a topic
  const deleteTopic = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.deleteTopic(id);
      if (response.success) {
        // Remove the topic from all lists
        setTopics(prev => prev.filter(topic => topic._id !== id));
        setDueTopics(prev => prev.filter(topic => topic._id !== id));
        setUpcomingTopics(prev => prev.filter(topic => topic._id !== id));
        return response;
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to delete topic:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Review a topic
  const reviewTopic = useCallback(async (id, quality, responseTime = 0) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.reviewTopic(id, { quality, responseTime });
      if (response.success) {
        // Remove from due topics and refresh lists
        setDueTopics(prev => prev.filter(topic => topic._id !== id));
        await fetchUpcomingTopics(); // Refresh upcoming as the topic might appear there
        return response;
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to review topic:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUpcomingTopics]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch due topics on mount
  useEffect(() => {
    fetchDueTopics();
  }, [fetchDueTopics]);

  return {
    // State
    topics,
    dueTopics,
    upcomingTopics,
    loading,
    error,
    
    // Actions
    fetchTopics,
    fetchDueTopics,
    fetchUpcomingTopics,
    createTopic,
    updateTopic,
    deleteTopic,
    reviewTopic,
    clearError,
    
    // Computed values
    dueCount: dueTopics.length,
    upcomingCount: upcomingTopics.length,
    totalTopics: topics.length
  };
};
