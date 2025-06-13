import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { User } from 'firebase/auth';
import { Home, Search, ShoppingBag, User as UserIcon } from 'lucide-react-native';
import CustomerHomeScreen from '../screens/customer/Home';
import SearchScreen from '../screens/customer/Search';
import OrdersScreen from '../screens/customer/Orders';
import ProfileScreen from '../screens/customer/Profile';
import RestaurantMenuScreen from '../screens/customer/RestaurantMenu';
import CartCheckoutScreen from '../screens/customer/CartCheckout';
import { useTheme } from '../../contexts/ThemeContext';

const Tab = createBottomTabNavigator();

interface CartItem {
  menuItem: {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    imageUrl: string;
    isAvailable: boolean;
    preparationTime: number;
    restaurantId: string;
    tags: string[]; // Add this line to match the required MenuItem type
  };
  quantity: number;
  specialInstructions?: string;
}

const CustomerNavigation = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const iconSize = 22;
  
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<'home' | 'search' | 'orders' | 'profile' | 'restaurant' | 'cart'>('home');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Navigation handlers
  const handleNavigateToMenu = (restaurantId: string) => {
    setSelectedRestaurantId(restaurantId);
    setCurrentScreen('restaurant');
  };

  const handleNavigateToCart = (cartItems: CartItem[]) => {
    setCart(cartItems);
    setCurrentScreen('cart');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setSelectedRestaurantId('');
  };

  const handleBackToMenu = () => {
    setCurrentScreen('restaurant');
  };

  const handleOrderPlaced = () => {
    setCart([]);
    setCurrentScreen('orders');
  };

  // Render current screen
  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'restaurant':
        return (
          <RestaurantMenuScreen
            restaurantId={selectedRestaurantId}
            onBack={handleBackToHome}
            onNavigateToCart={handleNavigateToCart}
            initialCart={cart}
          />
        );
      
      case 'cart':
        return (
          <CartCheckoutScreen
            user={user}
            cart={cart}
            onBack={handleBackToMenu}
            onOrderPlaced={handleOrderPlaced}
          />
        );
      
      case 'home':
      default:
        return (
          <CustomerHomeScreen 
            user={user}
            onNavigateToMenu={handleNavigateToMenu}
            onNavigateToCart={handleNavigateToCart}
          />
        );
    }
  };

  // If we're on restaurant or cart screen, render them directly
  if (currentScreen === 'restaurant' || currentScreen === 'cart') {
    return renderCurrentScreen();
  }

  // Otherwise, render the tab navigator
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
            <Home size={iconSize} color={color} />
          ),
        }}
      >
        {() => (
          <CustomerHomeScreen 
            user={user}
            onNavigateToMenu={handleNavigateToMenu}
            onNavigateToCart={handleNavigateToCart}
          />
        )}
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