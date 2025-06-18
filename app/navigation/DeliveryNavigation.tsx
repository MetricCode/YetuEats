import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { User } from 'firebase/auth';
import { Home, MapPin, TrendingUp, User as UserIcon, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';

// Import the delivery screens
import DeliveryDashboardScreen from '../screens/delivery/Dashboard';
import DeliveryMapScreen from '../screens/delivery/Maps';
import DeliveryOrdersScreen from '../screens/delivery/Orders';
import DeliveryAnalyticsScreen from '../screens/delivery/Analytics';
import DeliveryProfileScreen from '../screens/delivery/Profile';

const Tab = createBottomTabNavigator();

const DeliveryNavigation = ({ user }: { user: User }) => {
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
          paddingBottom: 8,
          paddingTop: 8,
          height: 75,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 12,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Home 
              size={focused ? iconSize + 2 : iconSize} 
              color={color} 
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      >
        {() => <DeliveryDashboardScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Map"
        options={{
          tabBarLabel: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <MapPin 
              size={focused ? iconSize + 2 : iconSize} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      >
        {() => <DeliveryMapScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Orders"
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <ShoppingBag 
              size={focused ? iconSize + 2 : iconSize} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      >
        {() => <DeliveryOrdersScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Analytics"
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <TrendingUp 
              size={focused ? iconSize + 2 : iconSize} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      >
        {() => <DeliveryAnalyticsScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <UserIcon 
              size={focused ? iconSize + 2 : iconSize} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      >
        {() => <DeliveryProfileScreen user={user} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default DeliveryNavigation;