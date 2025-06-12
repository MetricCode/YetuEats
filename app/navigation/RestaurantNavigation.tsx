import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { User } from 'firebase/auth';
import { Home, BarChart3, Menu, User as UserIcon } from 'lucide-react-native';
import RestaurantDashboardScreen from '../screens/restaurant/Dashboard';
import MenuManagementScreen from '../screens/restaurant/Menu';
import AnalyticsScreen from '../screens/restaurant/Analytics';
import RestaurantProfileScreen from '../screens/restaurant/Profile';
import { useTheme } from '../../contexts/ThemeContext';

const Tab = createBottomTabNavigator();

const RestaurantNavigation = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const iconSize = 22;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopWidth: 1,
          borderTopColor: theme.tabBarBorder,
          paddingBottom: 5,
          paddingTop: 5,
          height: 70,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        options={{
          tabBarIcon: ({ color }) => (
            <Home size={iconSize} color={color} />
          ),
        }}
      >
        {() => <RestaurantDashboardScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Menu"
        options={{
          tabBarIcon: ({ color }) => (
            <Menu size={iconSize} color={color} />
          ),
        }}
      >
        {() => <MenuManagementScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <BarChart3 size={iconSize} color={color} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Profile"
        options={{
          tabBarIcon: ({ color }) => (
            <UserIcon size={iconSize} color={color} />
          ),
        }}
      >
        {() => <RestaurantProfileScreen user={user} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default RestaurantNavigation;