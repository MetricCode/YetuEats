import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { FIREBASE_AUTH, FIREBASE_DB } from './FirebaseConfig';
import LoginScreen from './app/screens/Login';
import CustomerNavigation from './app/navigation/CustomerNavigation';
import RestaurantNavigation from './app/navigation/RestaurantNavigation';
import DeliveryNavigation from './app/navigation/DeliveryNavigation';
import AdminNavigation from './app/navigation/AdminNavigation';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

type UserType = 'customer' | 'restaurant' | 'delivery' | 'admin';

interface UserData {
  uid: string;
  name: string;
  email: string;
  userType: UserType;
  phoneNumber?: string;
  countryCode?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  profileComplete: boolean;
}

const LoadingScreen = () => {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</Text>
    </View>
  );
};

const AppContent = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(FIREBASE_AUTH, async (user) => {
      console.log('Auth state changed:', user?.uid);
      setUser(user);
      
      if (user) {
        setIsLoadingUserData(true);
        try {
          // First check if user is an admin
          const adminDoc = await getDoc(doc(FIREBASE_DB, 'admins', user.uid));
          
          if (adminDoc.exists()) {
            // User is an admin
            const adminData = adminDoc.data();
            const defaultUserData: UserData = {
              uid: user.uid,
              name: adminData.name || user.displayName || 'Admin',
              email: user.email || '',
              userType: 'admin',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isActive: true,
              profileComplete: true,
            };
            setUserData(defaultUserData);
          } else {
            // Check for regular user document
            const userDoc = await getDoc(doc(FIREBASE_DB, 'users', user.uid));
            
            if (userDoc.exists()) {
              const data = userDoc.data() as UserData;
              console.log('User data loaded:', data);
              setUserData(data);
            } else {
              console.log('No user document found, creating default...');
              // If no document exists, create one with default customer type
              const defaultUserData: UserData = {
                uid: user.uid,
                name: user.displayName || 'User',
                email: user.email || '',
                userType: 'customer',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isActive: true,
                profileComplete: false,
              };
              
              // Note: In a real app, you might want to save this to Firestore
              setUserData(defaultUserData);
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Set default user data in case of error
          setUserData({
            uid: user.uid,
            name: user.displayName || 'User',
            email: user.email || '',
            userType: 'customer',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
            profileComplete: false,
          });
        } finally {
          setIsLoadingUserData(false);
        }
      } else {
        setUserData(null);
      }
      
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const renderNavigationByUserType = () => {
    if (!user || !userData) {
      return <LoginScreen />;
    }

    console.log('Rendering navigation for user type:', userData.userType);

    switch (userData.userType) {
      case 'customer':
        return <CustomerNavigation user={user} />;
      case 'restaurant':
        return <RestaurantNavigation user={user} />;
      case 'delivery':
        return <DeliveryNavigation user={user} />;
      case 'admin':
        return <AdminNavigation user={user} />;
      default:
        // Default to customer if user type is unknown
        console.warn('Unknown user type:', userData.userType, 'defaulting to customer');
        return <CustomerNavigation user={user} />;
    }
  };

  if (isLoading || isLoadingUserData) {
    return <LoadingScreen />;
  }

  return (
    <>
      {user ? (
        <NavigationContainer>
          {renderNavigationByUserType()}
        </NavigationContainer>
      ) : (
        <LoginScreen />
      )}
    </>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});