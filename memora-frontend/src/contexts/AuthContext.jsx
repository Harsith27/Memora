import React, { createContext, useContext, useReducer, useEffect } from 'react';
import apiService from '../services/api';

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  SET_USER: 'SET_USER',
  SET_LOADING: 'SET_LOADING',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: !!action.payload.user,
        isLoading: false,
        error: null,
      };

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading,
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const persistUser = (user) => {
    if (!user) return;
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const getPersistedUser = () => {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Failed to parse cached user:', error);
      localStorage.removeItem('currentUser');
      return null;
    }
  };

  const clearPersistedAuth = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('refreshToken');
    apiService.setToken(null);
  };

  // Check if user is authenticated on app start
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      const cachedUser = getPersistedUser();

      if (cachedUser && (token || refreshToken)) {
        dispatch({
          type: AUTH_ACTIONS.SET_USER,
          payload: { user: cachedUser }
        });
      }

      if (!token && !refreshToken) {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: false } });
        return;
      }

      if (token) {
        apiService.setToken(token);
      }

      try {
        const response = await apiService.verifyToken();
        if (!response.success) {
          throw new Error('Token verification failed');
        }

        persistUser(response.user);
        dispatch({
          type: AUTH_ACTIONS.SET_USER,
          payload: { user: response.user }
        });
      } catch (error) {
        const shouldTryRefresh = refreshToken && (apiService.isAuthError(error) || !token);

        if (shouldTryRefresh) {
          try {
            const refreshResponse = await apiService.refreshToken();
            if (!refreshResponse.success) {
              throw new Error('Token refresh failed');
            }

            const verifyAfterRefresh = await apiService.verifyToken();
            if (!verifyAfterRefresh.success) {
              throw new Error('Token verification after refresh failed');
            }

            persistUser(verifyAfterRefresh.user);
            dispatch({
              type: AUTH_ACTIONS.SET_USER,
              payload: { user: verifyAfterRefresh.user }
            });
            return;
          } catch (refreshError) {
            if (!apiService.isAuthError(refreshError) && cachedUser) {
              dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: false } });
              return;
            }

            console.error('Token refresh failed:', refreshError);
            clearPersistedAuth();
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
            return;
          }
        }

        // Keep cached session during transient failures.
        if (!apiService.isAuthError(error) && cachedUser) {
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: false } });
          return;
        }

        console.error('Session restore failed:', error);
        clearPersistedAuth();
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await apiService.login(credentials);

      if (response.success) {
        const user = response.user;

        // Set the authentication token in API service
        if (response.tokens?.accessToken) {
          apiService.setToken(response.tokens.accessToken);
          localStorage.setItem('accessToken', response.tokens.accessToken);
        }

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user }
        });
        persistUser(user);
        return { success: true, user };
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: { error: error.message }
      });
      return { success: false, error: error.message };
    }
  };

  // Register function
  const register = async (userData) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await apiService.register(userData);
      
      if (response.success) {
        persistUser(response.user);
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user: response.user }
        });
        return { success: true, user: response.user };
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: { error: error.message }
      });
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Update user function
  const updateUser = (userData) => {
    const updatedUser = { ...state.user, ...userData };
    persistUser(updatedUser);
    dispatch({
      type: AUTH_ACTIONS.SET_USER,
      payload: { user: updatedUser }
    });
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Save evaluation results
  const saveEvaluationResults = async (results) => {
    try {
      const response = await apiService.saveEvaluationResults(results);
      if (response.success) {
        // Update user with evaluation completion and the memScore from backend response
        updateUser({
          hasCompletedEvaluation: true,
          evaluationResults: results,
          memScore: response.memScore // Use the memScore returned from backend
        });

        // Also store in localStorage for persistence
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const updatedUser = {
          ...currentUser,
          hasCompletedEvaluation: true,
          evaluationResults: results,
          memScore: response.memScore
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));

        // Refresh user data from backend to ensure consistency
        try {
          const userResponse = await apiService.verifyToken();
          if (userResponse.success) {
            dispatch({
              type: AUTH_ACTIONS.SET_USER,
              payload: { user: userResponse.user }
            });
          }
        } catch (refreshError) {
          console.error('Failed to refresh user data:', refreshError);
        }
      }
      return response;
    } catch (error) {
      console.error('Failed to save evaluation results:', error);
      throw error;
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    clearError,
    saveEvaluationResults,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
