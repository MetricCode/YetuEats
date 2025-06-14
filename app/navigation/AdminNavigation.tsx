import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { User } from 'firebase/auth';
import { Home, BarChart3, Users, Building2, User as UserIcon, Car, Headphones } from 'lucide-react-native';
import AdminDashboardScreen from '../screens/admin/Dashboard';
import AdminAnalyticsScreen from '../screens/admin/Analytics';
import AdminUsersManagementScreen from '../screens/admin/UsersManagement';
import AdminRestaurantsManagementScreen from '../screens/admin/RestaurantManagement';
import AdminDeliveryManagementScreen from '../screens/admin/DeliveryManagement';
import AdminSupportManagementScreen from '../screens/admin/SupportManagement';
import AdminProfileScreen from '../screens/admin/Profile';
import { useTheme } from '../../contexts/ThemeContext';

const Tab = createBottomTabNavigator();

const AdminNavigation = ({ user }: { user: User }) => {
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
          fontSize: 11,
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
        {() => <AdminDashboardScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Analytics"
        options={{
          tabBarIcon: ({ color }) => (
            <BarChart3 size={iconSize} color={color} />
          ),
        }}
      >
        {() => <AdminAnalyticsScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Users"
        options={{
          tabBarIcon: ({ color }) => (
            <Users size={iconSize} color={color} />
          ),
        }}
      >
        {() => <AdminUsersManagementScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Restaurants"
        options={{
          tabBarIcon: ({ color }) => (
            <Building2 size={iconSize} color={color} />
          ),
        }}
      >
        {() => <AdminRestaurantsManagementScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Delivery"
        options={{
          tabBarIcon: ({ color }) => (
            <Car size={iconSize} color={color} />
          ),
        }}
      >
        {() => <AdminDeliveryManagementScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Support"
        options={{
          tabBarIcon: ({ color }) => (
            <Headphones size={iconSize} color={color} />
          ),
        }}
      >
        {() => <AdminSupportManagementScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Profile"
        options={{
          tabBarIcon: ({ color }) => (
            <UserIcon size={iconSize} color={color} />
          ),
        }}
      >
        {() => <AdminProfileScreen user={user} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default AdminNavigation;