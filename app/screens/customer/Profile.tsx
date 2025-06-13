import React, { useState, useEffect } from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert, Dimensions, TextInput, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User, signOut } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { userService, UserData } from '../../../services/userService';
import { getUserOrderStats, OrderStats } from '../../../services/orderUtils';
import { formatPrice } from '../../../services/currency';
import AddressManagementScreen from './AddressManagement';

const { width } = Dimensions.get('window');

interface ProfileMenuSection {
  title: string;
  items: ProfileMenuItem[];
}

interface ProfileMenuItem {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  action: 'navigate' | 'toggle' | 'action';
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  iconColor?: string;
  badge?: number;
}

interface EditProfileData {
  name: string;
  phoneNumber: string;
  address: string;
  dateOfBirth: string;
}

const ProfileScreen = ({ user, onNavigateToOrders }: { user: User; onNavigateToOrders?: () => void }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAddressScreen, setShowAddressScreen] = useState(false);
  const [editData, setEditData] = useState<EditProfileData>({
    name: '',
    phoneNumber: '',
    address: '',
    dateOfBirth: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Only load data if user is authenticated
    if (user && user.uid) {
      loadUserData();
      loadOrderStats();
    } else {
      // User is not authenticated, reset state
      setUserData(null);
      setOrderStats(null);
      setLoading(false);
    }
  }, [user?.uid]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      let data = await userService.getUserData(user.uid);
      
      if (!data) {
        // Create default user data if doesn't exist
        data = await userService.createUserData(user);
      }
      
      // Ensure stats exist with proper defaults
      const safeUserData: UserData = {
        ...data,
        stats: {
          totalOrders: data.stats?.totalOrders ?? 0,
          totalSpent: data.stats?.totalSpent ?? 0,
          averageRating: data.stats?.averageRating ?? 0,
          loyaltyPoints: data.stats?.loyaltyPoints ?? 0,
        },
        preferences: {
          notifications: data.preferences?.notifications ?? true,
          location: data.preferences?.location ?? true,
          emailUpdates: data.preferences?.emailUpdates ?? true,
          smsUpdates: data.preferences?.smsUpdates ?? false,
        }
      };
      
      setUserData(safeUserData);
      setEditData({
        name: safeUserData.name || '',
        phoneNumber: safeUserData.phoneNumber || '',
        address: safeUserData.address || '',
        dateOfBirth: safeUserData.dateOfBirth || '',
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      // Don't show alert for permission errors when user is signing out
      if (user && user.uid) {
        Alert.alert('Error', 'Failed to load user data');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadOrderStats = async () => {
    // Check if user is still authenticated before making the request
    if (!user || !user.uid) {
      return;
    }

    try {
      const stats = await getUserOrderStats(user.uid);
      setOrderStats(stats);
    } catch (error) {
      console.error('Error loading order stats:', error);
      // Silently handle permission errors during logout
      if (error instanceof Error && error.message.includes('permission')) {
        console.log('Permission error during logout - ignoring');
        return;
      }
    }
  };

  const handleUpdateProfile = async () => {
    if (!userData) return;

    try {
      setSaving(true);
      
      await userService.updateProfile(user, editData);
      
      // Update local state
      const updatedData = {
        ...userData,
        ...editData,
        updatedAt: new Date().toISOString(),
        profileComplete: true,
      };
      
      setUserData(updatedData);
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    try {
      setSaving(true);
      await userService.updatePassword(user, passwordData.currentPassword, passwordData.newPassword);
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert('Success', 'Password updated successfully!');
    } catch (error: any) {
      console.error('Error updating password:', error);
      Alert.alert('Error', error.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePreference = async (key: keyof UserData['preferences'], value: boolean) => {
    if (!userData) return;

    try {
      const updatedPreferences = {
        ...userData.preferences,
        [key]: value,
      };

      await userService.updatePreferences(user.uid, updatedPreferences);
      
      setUserData({
        ...userData,
        preferences: updatedPreferences,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear local state immediately to prevent further API calls
              setUserData(null);
              setOrderStats(null);
              
              await signOut(FIREBASE_AUTH);
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  // Use order stats data, fallback to userData stats if available
  const displayStats = {
    totalOrders: orderStats?.totalOrders ?? userData?.stats?.totalOrders ?? 0,
    totalSpent: orderStats?.totalSpent ?? userData?.stats?.totalSpent ?? 0,
    averageRating: userData?.stats?.averageRating ?? 0,
    loyaltyPoints: userData?.stats?.loyaltyPoints ?? 0,
    completedOrders: orderStats?.completedOrders ?? 0,
    pendingOrders: orderStats?.pendingOrders ?? 0,
  };

  // Safe access to user preferences with defaults
  const safePreferences = {
    notifications: userData?.preferences?.notifications ?? true,
    location: userData?.preferences?.location ?? true,
    emailUpdates: userData?.preferences?.emailUpdates ?? true,
    smsUpdates: userData?.preferences?.smsUpdates ?? false,
  };

  const profileSections: ProfileMenuSection[] = [
    {
      title: 'Account',
      items: [
        {
          id: '0',
          icon: 'receipt-outline',
          title: 'My Orders',
          subtitle: `${displayStats.totalOrders} orders placed`,
          action: 'navigate',
          iconColor: '#10B981',
          badge: displayStats.pendingOrders > 0 ? displayStats.pendingOrders : undefined,
          onPress: onNavigateToOrders,
        },
        {
          id: '1',
          icon: 'person-outline',
          title: 'Edit Profile',
          subtitle: 'Update your personal information',
          action: 'navigate',
          iconColor: '#4F46E5',
          onPress: () => setShowEditModal(true),
        },
        {
          id: '2',
          icon: 'lock-closed-outline',
          title: 'Change Password',
          subtitle: 'Update your password',
          action: 'navigate',
          iconColor: '#EF4444',
          onPress: () => setShowPasswordModal(true),
        },
        {
          id: '3',
          icon: 'location-outline',
          title: 'My Addresses',
          subtitle: 'Manage delivery addresses',
          action: 'navigate',
          iconColor: '#059669',
          onPress: () => setShowAddressScreen(true),
        },
        {
          id: '4',
          icon: 'card-outline',
          title: 'Payment Methods',
          subtitle: 'Manage cards and payment options',
          action: 'navigate',
          iconColor: '#DC2626',
          onPress: () => console.log('Navigate to Payment Methods'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          id: '6',
          icon: 'notifications-outline',
          title: 'Push Notifications',
          subtitle: 'Order updates and promotions',
          action: 'toggle',
          hasToggle: true,
          toggleValue: safePreferences.notifications,
          iconColor: '#8B5CF6',
          onToggle: (value) => handleTogglePreference('notifications', value),
        },
        {
          id: '7',
          icon: 'location-outline',
          title: 'Location Services',
          subtitle: 'Allow location access',
          action: 'toggle',
          hasToggle: true,
          toggleValue: safePreferences.location,
          iconColor: '#06B6D4',
          onToggle: (value) => handleTogglePreference('location', value),
        },
        {
          id: '10',
          icon: isDarkMode ? 'sunny-outline' : 'moon-outline',
          title: 'Dark Mode',
          subtitle: isDarkMode ? 'Switch to light theme' : 'Switch to dark theme',
          action: 'toggle',
          hasToggle: true,
          toggleValue: isDarkMode,
          iconColor: isDarkMode ? '#F59E0B' : '#6B7280',
          onToggle: toggleTheme,
        },
      ],
    },
    {
      title: 'Support & Legal',
      items: [
        {
          id: '11',
          icon: 'help-circle-outline',
          title: 'Help & Support',
          subtitle: 'Get help with your orders',
          action: 'navigate',
          iconColor: '#10B981',
          onPress: () => console.log('Navigate to Help'),
        },
        {
          id: '12',
          icon: 'star-outline',
          title: 'Rate Our App',
          subtitle: 'Share your feedback',
          action: 'navigate',
          iconColor: '#F59E0B',
          onPress: () => console.log('Rate app'),
        },
      ],
    },
  ];

  const renderEditProfileModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowEditModal(false)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleUpdateProfile} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[styles.saveButton, { color: theme.primary }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={editData.name}
              onChangeText={(text) => setEditData({ ...editData, name: text })}
              placeholder="Enter your full name"
              placeholderTextColor={theme.placeholder}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={editData.phoneNumber}
              onChangeText={(text) => setEditData({ ...editData, phoneNumber: text })}
              placeholder="Enter your phone number"
              placeholderTextColor={theme.placeholder}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Address</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={editData.address}
              onChangeText={(text) => setEditData({ ...editData, address: text })}
              placeholder="Enter your address"
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Date of Birth</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={editData.dateOfBirth}
              onChangeText={(text) => setEditData({ ...editData, dateOfBirth: text })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.placeholder}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const renderPasswordModal = () => (
    <Modal
      visible={showPasswordModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
          <TouchableOpacity onPress={handleUpdatePassword} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[styles.saveButton, { color: theme.primary }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Current Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
              placeholder="Enter current password"
              placeholderTextColor={theme.placeholder}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>New Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
              placeholder="Enter new password"
              placeholderTextColor={theme.placeholder}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Confirm New Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
              placeholder="Confirm new password"
              placeholderTextColor={theme.placeholder}
              secureTextEntry
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const renderMenuItem = (item: ProfileMenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, { backgroundColor: theme.surface }]}
      onPress={item.onPress}
      disabled={item.action === 'toggle'}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: item.iconColor + '15' }]}>
          <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
        </View>
        <View style={styles.menuItemText}>
          <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
          {item.subtitle && (
            <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
          )}
        </View>
      </View>
      <View style={styles.menuItemRight}>
        {item.badge && (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        {item.hasToggle ? (
          <Switch
            value={item.toggleValue}
            onValueChange={item.onToggle}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={item.toggleValue ? '#fff' : '#f4f3f4'}
            ios_backgroundColor={theme.border}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section: ProfileMenuSection) => (
    <View key={section.title} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
        {section.items.map((item, index) => (
          <View key={item.id}>
            {renderMenuItem(item)}
            {index < section.items.length - 1 && <View style={[styles.separator, { backgroundColor: theme.separator }]} />}
          </View>
        ))}
      </View>
    </View>
  );

  // Return early if user is not authenticated
  if (!user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Please sign in to view your profile</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading profile...</Text>
      </View>
    );
  }

  // Show address management screen
  if (showAddressScreen) {
    return (
      <AddressManagementScreen 
        user={user} 
        onBack={() => setShowAddressScreen(false)} 
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string, ...string[]]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: userData?.profilePicture || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.name || user.email || 'User')}&background=fff&color=FF6B35&size=120`,
              }}
              style={styles.avatar}
            />
            <TouchableOpacity style={[styles.editAvatarButton, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{userData?.name || 'Valued Customer'}</Text>
          <Text style={styles.userEmail}>{userData?.email || user.email}</Text>
          
          {/* Enhanced Stats Container */}
          <View style={[styles.statsContainer, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.95)' }]}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="bag-handle" size={20} color={theme.primary} />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#2D3748' }]}>
                {displayStats.totalOrders}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? theme.textSecondary : '#6B7280' }]}>Orders</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="star" size={20} color="#10B981" />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#2D3748' }]}>
                {displayStats.averageRating.toFixed(1)}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? theme.textSecondary : '#6B7280' }]}>Rating</Text>
            </View>
          </View>
          {/* Favorite Restaurant */}
          {orderStats?.favoriteRestaurant && (
            <View style={[styles.favoriteContainer, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
              <Ionicons name="heart" size={16} color="#EF4444" />
              <Text style={[styles.favoriteText, { color: theme.textSecondary }]}>
                Favorite: {orderStats.favoriteRestaurant}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Menu Sections */}
        {profileSections.map(renderSection)}

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LinearGradient
              colors={isDarkMode ? ['rgba(239, 68, 68, 0.2)', 'rgba(248, 113, 113, 0.2)'] : ['#FEE2E2', '#FECACA']}
              style={styles.signOutGradient}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: theme.textMuted }]}>YetuEats v1.0</Text>
          <Text style={[styles.copyrightText, { color: theme.textMuted }]}>© 2025 YetuEats. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* Modals */}
      {renderEditProfileModal()}
      {renderPasswordModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  headerGradient: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingsButton: {
    padding: 8,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#fff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  orderStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  orderStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  orderStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  orderStatLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  favoriteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  favoriteText: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    marginTop: -20,
  },
  scrollContent: {
    paddingTop: 30,
    paddingBottom: 30,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  quickActionButton: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  quickActionGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 20,
    marginBottom: 12,
  },
  sectionContent: {
    marginHorizontal: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  separator: {
    height: 1,
    marginLeft: 68,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  signOutContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  signOutButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  signOutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 50,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
  },
});

export default ProfileScreen;