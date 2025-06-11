import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

// Define color schemes
export const lightTheme = {
  // Background colors
  background: '#F8F9FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  
  // Text colors
  text: '#2D3748',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  
  // Primary colors (keep consistent for branding)
  primary: '#FF6B35',
  primaryGradient: ['#FF6B35', '#F7931E'],
  
  // UI element colors
  border: '#E5E7EB',
  separator: '#F3F4F6',
  shadow: '#000000',
  
  // Status colors
  success: '#059669',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Input colors
  inputBackground: '#F9F9F9',
  inputBorder: '#E5E5E5',
  placeholder: '#9CA3AF',
  
  // Navigation
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#F0F0F0',
  
  // Status bar
  statusBarStyle: 'dark' as const,
  statusBarBackground: '#FF6B35',
};

export const darkTheme = {
  // Background colors
  background: '#0F172A',
  surface: '#1E293B',
  card: '#334155',
  
  // Text colors
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  
  // Primary colors (keep consistent for branding)
  primary: '#FF6B35',
  primaryGradient: ['#FF6B35', '#F7931E'],
  
  // UI element colors
  border: '#475569',
  separator: '#374151',
  shadow: '#000000',
  
  // Status colors
  success: '#10B981',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',
  
  // Input colors
  inputBackground: '#374151',
  inputBorder: '#4B5563',
  placeholder: '#9CA3AF',
  
  // Navigation
  tabBarBackground: '#1E293B',
  tabBarBorder: '#374151',
  
  // Status bar
  statusBarStyle: 'light' as const,
  statusBarBackground: '#FF6B35',
};

export type Theme = Omit<typeof lightTheme, 'statusBarStyle'> & {
  statusBarStyle: 'dark' | 'light';
};

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference from AsyncStorage on app start
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme_preference');
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemePreference = async (isDark: boolean) => {
    try {
      await AsyncStorage.setItem('theme_preference', isDark ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    saveThemePreference(newTheme);
  };

  const setTheme = (isDark: boolean) => {
    setIsDarkMode(isDark);
    saveThemePreference(isDark);
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  if (isLoading) {
    // You can return a loading screen here if needed
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme, setTheme }}>
      <StatusBar style={theme.statusBarStyle} backgroundColor={theme.statusBarBackground} />
      {children}
    </ThemeContext.Provider>
  );
};