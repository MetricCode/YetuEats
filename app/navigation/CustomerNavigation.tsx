import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { User } from 'firebase/auth';
import { Home, Search, ShoppingBag, User as UserIcon, Compass } from 'lucide-react-native';
import CustomerHomeScreen from '../screens/customer/Home';
import SearchScreen from '../screens/customer/Search';
import OrdersScreen from '../screens/customer/Orders';
import ProfileScreen from '../screens/customer/Profile';
import { useTheme } from '../../contexts/ThemeContext';

const Tab = createBottomTabNavigator();

const CustomerNavigation = ({ user }: { user: User }) => {
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
        name="Explore"
        options={{
          tabBarIcon: ({ color }) => (
            <Compass size={iconSize} color={color} />
          ),
        }}
      >
        {() => <CustomerHomeScreen user={user} />}
      </Tab.Screen>
            
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Search size={iconSize} color={color} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Orders"
        options={{
          tabBarIcon: ({ color }) => (
            <ShoppingBag size={iconSize} color={color} />
          ),
        }}
      >
        {() => <OrdersScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Profile"
        options={{
          tabBarIcon: ({ color }) => (
            <UserIcon size={iconSize} color={color} />
          ),
        }}
      >
        {() => <ProfileScreen user={user} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default CustomerNavigation;