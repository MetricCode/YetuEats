import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { User } from 'firebase/auth';
import { Home, MapPin, TrendingUp, User as UserIcon } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

// Placeholder screens for delivery partner
const DeliveryDashboardScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Delivery Dashboard</Text>
        <Text style={styles.headerSubtitle}>Welcome, {user.displayName}!</Text>
      </LinearGradient>
      
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Ionicons name="bicycle" size={48} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Delivery Partner Dashboard</Text>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            Your delivery partner interface is coming soon! 
            You'll be able to manage deliveries, track earnings, and more.
          </Text>
        </View>
      </View>
    </View>
  );
};

const DeliveryMapScreen = () => {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Delivery Map</Text>
        <Text style={styles.headerSubtitle}>Find nearby orders</Text>
      </LinearGradient>
      
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Ionicons name="map" size={48} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Interactive Map</Text>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            View available deliveries on an interactive map with real-time updates.
          </Text>
        </View>
      </View>
    </View>
  );
};

const DeliveryEarningsScreen = () => {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Earnings</Text>
        <Text style={styles.headerSubtitle}>Track your income</Text>
      </LinearGradient>
      
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Ionicons name="analytics" size={48} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Earnings Analytics</Text>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            View detailed earnings reports, tips, and payment history.
          </Text>
        </View>
      </View>
    </View>
  );
};

const DeliveryProfileScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>Manage your account</Text>
      </LinearGradient>
      
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Ionicons name="person" size={48} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Delivery Partner Profile</Text>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            Manage your delivery partner profile, vehicle information, and account settings.
          </Text>
        </View>
      </View>
    </View>
  );
};

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
        {() => <DeliveryDashboardScreen user={user} />}
      </Tab.Screen>
      
      <Tab.Screen
        name="Map"
        component={DeliveryMapScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MapPin size={iconSize} color={color} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Earnings"
        component={DeliveryEarningsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <TrendingUp size={iconSize} color={color} />
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
        {() => <DeliveryProfileScreen user={user} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    maxWidth: 300,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default DeliveryNavigation;