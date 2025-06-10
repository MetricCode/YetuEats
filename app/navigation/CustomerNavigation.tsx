import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { User } from 'firebase/auth';
import { Home, Search, ShoppingBag, User as UserIcon, UtensilsCrossed, Compass } from 'lucide-react-native';
import CustomerHomeScreen from '../screens/customer/Home';
import SearchScreen from '../screens/customer/Search';
import OrdersScreen from '../screens/customer/Orders';
import ProfileScreen from '../screens/customer/Profile';

const Tab = createBottomTabNavigator();

const CustomerNavigation = ({ user }: { user: User }) => {
  // Define a consistent, smaller icon size
  const iconSize = 22;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          paddingBottom: 5,
          paddingTop: 5,
          height: 70,
        },
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#9CA3AF',
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