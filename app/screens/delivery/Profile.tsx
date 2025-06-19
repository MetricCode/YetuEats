import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

const { width } = Dimensions.get('window');

interface DeliveryData {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  profilePicture?: string;
  vehicleType: 'bicycle' | 'motorcycle' | 'car';
  vehicleNumber: string;
  licenseNumber: string;
  isOnline: boolean;
  isActive: boolean;
  isVerified: boolean;
  rating: number;
  totalDeliveries: number;
  totalEarnings: number;
  joinedDate: string;
  lastSeenAt?: any;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  bankDetails: {
    accountNumber: string;
    bankName: string;
    accountHolderName: string;
    branchCode?: string;
  };
  emergencyContact: {
    name: string;
    phoneNumber: string;
    relationship: string;
  };
  workingHours: {
    start: string;
    end: string;
    isActive: boolean;
  };
  preferences: {
    notifications: boolean;
    orderAlerts: boolean;
    locationTracking: boolean;
    autoAcceptOrders: boolean;
    maxDeliveryDistance: number;
    preferredAreas: string[];
  };
  stats: {
    todayDeliveries: number;
    todayEarnings: number;
    weekDeliveries: number;
    weekEarnings: number;
    monthDeliveries: number;
    monthEarnings: number;
    avgRating: number;
    completionRate: number;
    onTimeRate: number;
    totalRatings: number;
  };
}

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
  badge?: string | number;
  rightIcon?: string;
}

const DeliveryProfileScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [userData, setUserData] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  
  // Form states
  const [editData, setEditData] = useState({
    name: '',
    phoneNumber: '',
    vehicleType: 'bicycle' as 'bicycle' | 'motorcycle' | 'car',
    vehicleNumber: '',
    licenseNumber: '',
  });
  
  const [bankData, setBankData] = useState({
    accountNumber: '',
    bankName: '',
    accountHolderName: '',
    branchCode: '',
  });
  
  const [emergencyData, setEmergencyData] = useState({
    name: '',
    phoneNumber: '',
    relationship: '',
  });
  
  const [workingHours, setWorkingHours] = useState({
    start: '08:00',
    end: '22:00',
    isActive: true,
  });

  useEffect(() => {
    loadUserData();
  }, [user.uid]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(FIREBASE_DB, 'deliverys', user.uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data() as DeliveryData;
        setUserData(data);
        populateFormData(data);
      } else {
        await createDefaultUserData();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultUserData = async () => {
    const defaultData: DeliveryData = {
      uid: user.uid,
      name: user.displayName || 'Delivery Partner',
      email: user.email || '',
      phoneNumber: '',
      vehicleType: 'bicycle',
      vehicleNumber: '',
      licenseNumber: '',
      isOnline: false,
      isActive: true,
      isVerified: false,
      rating: 0,
      totalDeliveries: 0,
      totalEarnings: 0,
      joinedDate: new Date().toISOString(),
      bankDetails: {
        accountNumber: '',
        bankName: '',
        accountHolderName: '',
        branchCode: '',
      },
      emergencyContact: {
        name: '',
        phoneNumber: '',
        relationship: '',
      },
      workingHours: {
        start: '08:00',
        end: '22:00',
        isActive: true,
      },
      preferences: {
        notifications: true,
        orderAlerts: true,
        locationTracking: true,
        autoAcceptOrders: false,
        maxDeliveryDistance: 10,
        preferredAreas: [],
      },
      stats: {
        todayDeliveries: 0,
        todayEarnings: 0,
        weekDeliveries: 0,
        weekEarnings: 0,
        monthDeliveries: 0,
        monthEarnings: 0,
        avgRating: 0,
        completionRate: 0,
        onTimeRate: 0,
        totalRatings: 0,
      },
    };
    
    await setDoc(doc(FIREBASE_DB, 'deliverys', user.uid), defaultData);
    setUserData(defaultData);
    populateFormData(defaultData);
  };

  const populateFormData = (data: DeliveryData) => {
    setEditData({
      name: data.name,
      phoneNumber: data.phoneNumber,
      vehicleType: data.vehicleType,
      vehicleNumber: data.vehicleNumber,
      licenseNumber: data.licenseNumber,
    });
    setBankData({
      ...data.bankDetails,
      branchCode: data.bankDetails.branchCode ?? '',
    });
    setEmergencyData(data.emergencyContact);
    setWorkingHours(data.workingHours);
  };

  const updateUserData = async (updates: Partial<DeliveryData>) => {
    if (!userData) return;

    try {
      setSaving(true);
      const updatedData = { ...userData, ...updates, updatedAt: new Date() };
      await updateDoc(doc(FIREBASE_DB, 'deliverys', user.uid), updatedData);
      setUserData(updatedData);
      return true;
    } catch (error) {
      console.error('Error updating user data:', error);
      Alert.alert('Error', 'Failed to update data');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOnlineStatus = async (value: boolean) => {
    const success = await updateUserData({ 
      isOnline: value,
      lastSeenAt: new Date(),
    });
    
    if (success) {
      Alert.alert(
        value ? 'You\'re Online!' : 'You\'re Offline',
        value 
          ? 'You will now receive delivery requests' 
          : 'You won\'t receive new delivery requests'
      );
    }
  };

  const handleUpdateProfile = async () => {
    const success = await updateUserData(editData);
    if (success) {
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    }
  };

  const handleUpdateBankDetails = async () => {
    const success = await updateUserData({ bankDetails: bankData });
    if (success) {
      setShowBankModal(false);
      Alert.alert('Success', 'Bank details updated successfully!');
    }
  };

  const handleUpdateEmergencyContact = async () => {
    const success = await updateUserData({ emergencyContact: emergencyData });
    if (success) {
      setShowEmergencyModal(false);
      Alert.alert('Success', 'Emergency contact updated successfully!');
    }
  };

  const handleUpdateWorkingHours = async () => {
    const success = await updateUserData({ workingHours });
    if (success) {
      setShowWorkingHoursModal(false);
      Alert.alert('Success', 'Working hours updated successfully!');
    }
  };

  const handleTogglePreference = async (key: keyof DeliveryData['preferences'], value: boolean | number | string[]) => {
    if (!userData) return;

    const updatedPreferences = { ...userData.preferences, [key]: value };
    await updateUserData({ preferences: updatedPreferences });
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? This will set your status to offline.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Set offline before signing out
              if (userData?.isOnline) {
                await updateUserData({ isOnline: false });
              }
              await signOut(FIREBASE_AUTH);
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  const getVehicleIcon = (vehicleType: string) => {
    switch (vehicleType) {
      case 'bicycle': return 'bicycle';
      case 'motorcycle': return 'car-sport';
      case 'car': return 'car';
      default: return 'bicycle';
    }
  };

  const getVehicleLabel = (vehicleType: string) => {
    switch (vehicleType) {
      case 'bicycle': return 'Bicycle';
      case 'motorcycle': return 'Motorcycle';
      case 'car': return 'Car';
      default: return 'Bicycle';
    }
  };

  const getStatusColor = () => {
    if (!userData?.isActive) return theme.error;
    if (!userData?.isVerified) return theme.warning;
    if (userData?.isOnline) return theme.success;
    return theme.textMuted;
  };

  const getStatusText = () => {
    if (!userData?.isActive) return 'Inactive';
    if (!userData?.isVerified) return 'Pending Verification';
    if (userData?.isOnline) return 'Online';
    return 'Offline';
  };

  const profileSections: ProfileMenuSection[] = [
    {
      title: 'Account & Profile',
      items: [
        {
          id: 'edit_profile',
          icon: 'person-outline',
          title: 'Personal Information',
          subtitle: 'Name, phone, vehicle details',
          action: 'navigate',
          iconColor: theme.primary,
          onPress: () => setShowEditModal(true),
        },
        {
          id: 'bank_details',
          icon: 'card-outline',
          title: 'Banking Information',
          subtitle: 'Payment and withdrawal details',
          action: 'navigate',
          iconColor: theme.success,
          onPress: () => setShowBankModal(true),
          badge: userData?.bankDetails.accountNumber ? '' : 'Setup Required',
        },
        {
          id: 'emergency_contact',
          icon: 'call-outline',
          title: 'Emergency Contact',
          subtitle: 'Safety contact information',
          action: 'navigate',
          iconColor: theme.error,
          onPress: () => setShowEmergencyModal(true),
          badge: userData?.emergencyContact.name ? '' : 'Not Set',
        },
        {
          id: 'working_hours',
          icon: 'time-outline',
          title: 'Working Hours',
          subtitle: `${userData?.workingHours.start || '08:00'} - ${userData?.workingHours.end || '22:00'}`,
          action: 'navigate',
          iconColor: theme.info,
          onPress: () => setShowWorkingHoursModal(true),
        },
      ],
    },
    {
      title: 'Delivery Preferences',
      items: [
        {
          id: 'notifications',
          icon: 'notifications-outline',
          title: 'Push Notifications',
          subtitle: 'General app notifications',
          action: 'toggle',
          hasToggle: true,
          toggleValue: userData?.preferences?.notifications ?? true,
          iconColor: theme.primary,
          onToggle: (value) => handleTogglePreference('notifications', value),
        },
        {
          id: 'order_alerts',
          icon: 'alert-circle-outline',
          title: 'Order Alerts',
          subtitle: 'New order notifications',
          action: 'toggle',
          hasToggle: true,
          toggleValue: userData?.preferences?.orderAlerts ?? true,
          iconColor: theme.warning,
          onToggle: (value) => handleTogglePreference('orderAlerts', value),
        },
        {
          id: 'location_tracking',
          icon: 'location-outline',
          title: 'Location Tracking',
          subtitle: 'Allow real-time location sharing',
          action: 'toggle',
          hasToggle: true,
          toggleValue: userData?.preferences?.locationTracking ?? true,
          iconColor: theme.info,
          onToggle: (value) => handleTogglePreference('locationTracking', value),
        },
        {
          id: 'auto_accept',
          icon: 'flash-outline',
          title: 'Auto Accept Orders',
          subtitle: 'Automatically accept suitable orders',
          action: 'toggle',
          hasToggle: true,
          toggleValue: userData?.preferences?.autoAcceptOrders ?? false,
          iconColor: theme.success,
          onToggle: (value) => handleTogglePreference('autoAcceptOrders', value),
        },
      ],
    },
    {
      title: 'App Settings',
      items: [
        {
          id: 'dark_mode',
          icon: isDarkMode ? 'sunny-outline' : 'moon-outline',
          title: 'Dark Mode',
          subtitle: isDarkMode ? 'Switch to light theme' : 'Switch to dark theme',
          action: 'toggle',
          hasToggle: true,
          toggleValue: isDarkMode,
          iconColor: isDarkMode ? theme.warning : theme.textMuted,
          onToggle: toggleTheme,
        },
        {
          id: 'language',
          icon: 'language-outline',
          title: 'Language',
          subtitle: 'App language settings',
          action: 'navigate',
          iconColor: theme.textSecondary,
          rightIcon: 'chevron-forward',
          onPress: () => Alert.alert('Coming Soon', 'Language settings will be available soon'),
        },
      ],
    },
    {
      title: 'Support & Legal',
      items: [
        {
          id: 'help',
          icon: 'help-circle-outline',
          title: 'Help & Support',
          subtitle: 'Get help and contact support',
          action: 'navigate',
          iconColor: theme.info,
          onPress: () => Alert.alert('Support', 'Contact support at support@yetueats.com'),
        },
        {
          id: 'safety',
          icon: 'shield-outline',
          title: 'Safety Center',
          subtitle: 'Safety guidelines and tips',
          action: 'navigate',
          iconColor: theme.success,
          onPress: () => Alert.alert('Safety', 'Safety guidelines and emergency procedures'),
        },
        {
          id: 'terms',
          icon: 'document-text-outline',
          title: 'Terms & Conditions',
          subtitle: 'Legal terms and policies',
          action: 'navigate',
          iconColor: theme.textMuted,
          onPress: () => Alert.alert('Terms', 'View terms and conditions'),
        },
        {
          id: 'rate_app',
          icon: 'star-outline',
          title: 'Rate Our App',
          subtitle: 'Share your feedback',
          action: 'navigate',
          iconColor: theme.warning,
          onPress: () => Alert.alert('Rating', 'Thank you for your feedback!'),
        },
      ],
    },
  ];

  const renderStatsCard = (title: string, value: string, icon: string, color: string) => (
    <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.statsContent}>
        <Text style={[styles.statsValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>{title}</Text>
      </View>
    </View>
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
          <View style={[styles.badge, { backgroundColor: theme.warning }]}>
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
          <Ionicons 
            name={(item.rightIcon || 'chevron-forward') as any} 
            size={20} 
            color={theme.textMuted} 
          />
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
            {index < section.items.length - 1 && (
              <View style={[styles.separator, { backgroundColor: theme.separator }]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );

  // Modal Components
  const renderEditProfileModal = () => (
    <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
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
            <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={editData.name}
              onChangeText={(text) => setEditData({ ...editData, name: text })}
              placeholder="Enter your full name"
              placeholderTextColor={theme.placeholder}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number *</Text>
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
            <Text style={[styles.inputLabel, { color: theme.text }]}>Vehicle Type *</Text>
            <View style={styles.vehicleSelector}>
              {(['bicycle', 'motorcycle', 'car'] as const).map(vehicle => (
                <TouchableOpacity
                  key={vehicle}
                  style={[
                    styles.vehicleOption,
                    {
                      backgroundColor: editData.vehicleType === vehicle ? theme.primary : theme.inputBackground,
                      borderColor: editData.vehicleType === vehicle ? theme.primary : theme.border,
                    }
                  ]}
                  onPress={() => setEditData({ ...editData, vehicleType: vehicle })}
                >
                  <Ionicons 
                    name={getVehicleIcon(vehicle) as any} 
                    size={24} 
                    color={editData.vehicleType === vehicle ? '#fff' : theme.text} 
                  />
                  <Text style={[
                    styles.vehicleLabel,
                    { color: editData.vehicleType === vehicle ? '#fff' : theme.text }
                  ]}>
                    {getVehicleLabel(vehicle)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Vehicle Registration</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={editData.vehicleNumber}
              onChangeText={(text) => setEditData({ ...editData, vehicleNumber: text.toUpperCase() })}
              placeholder="e.g., KAA 123A"
              placeholderTextColor={theme.placeholder}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>License Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              value={editData.licenseNumber}
              onChangeText={(text) => setEditData({ ...editData, licenseNumber: text })}
              placeholder="Enter your license number"
              placeholderTextColor={theme.placeholder}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading profile...</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Unable to load profile data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with Gradient */}
      <LinearGradient colors={theme.primaryGradient as [string, string]} style={styles.headerGradient}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity 
            style={[styles.onlineToggle, { backgroundColor: getStatusColor() }]}
            onPress={() => handleToggleOnlineStatus(!userData.isOnline)}
          >
            <Text style={styles.onlineToggleText}>{getStatusText()}</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: userData.profilePicture || 
                     user.photoURL || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=fff&color=FF6B35&size=120`,
              }}
              style={styles.avatar}
            />
            <TouchableOpacity style={[styles.editAvatarButton, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
            <View style={[styles.onlineIndicator, { backgroundColor: getStatusColor() }]} />
          </View>
          
          <Text style={styles.userName}>{userData.name}</Text>
          <Text style={styles.userEmail}>{userData.email}</Text>
          
          {/* Vehicle Info */}
          <View style={styles.vehicleInfo}>
            <View style={[styles.vehicleIcon, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
              <Ionicons name={getVehicleIcon(userData.vehicleType) as any} size={20} color="#fff" />
            </View>
            <Text style={styles.vehicleText}>
              {getVehicleLabel(userData.vehicleType)}
              {userData.vehicleNumber && ` • ${userData.vehicleNumber}`}
            </Text>
          </View>
          
          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{userData.stats.todayDeliveries}</Text>
              <Text style={styles.quickStatLabel}>Today</Text>
            </View>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{userData.rating > 0 ? userData.rating.toFixed(1) : 'N/A'}</Text>
              <Text style={styles.quickStatLabel}>Rating</Text>
            </View>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{formatPrice(userData.stats.todayEarnings)}</Text>
              <Text style={styles.quickStatLabel}>Earned</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Performance Stats */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text, marginHorizontal: 20 }]}>
            Performance Overview
          </Text>
          <View style={styles.statsGrid}>
            {renderStatsCard(
              'Total Deliveries', 
              userData.totalDeliveries.toString(), 
              'bicycle', 
              theme.primary
            )}
            {renderStatsCard(
              'Completion Rate', 
              `${userData.stats.completionRate.toFixed(1)}%`, 
              'checkmark-circle', 
              theme.success
            )}
            {renderStatsCard(
              'On-Time Rate', 
              `${userData.stats.onTimeRate.toFixed(1)}%`, 
              'time', 
              theme.info
            )}
            {renderStatsCard(
              'Total Earned', 
              formatPrice(userData.totalEarnings), 
              'wallet', 
              theme.warning
            )}
          </View>
        </View>

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
          <Text style={[styles.versionText, { color: theme.textMuted }]}>YetuEats Delivery v1.0</Text>
          <Text style={[styles.copyrightText, { color: theme.textMuted }]}>© 2025 YetuEats. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* Modals */}
      {renderEditProfileModal()}
      
      {/* Bank Details Modal */}
      <Modal visible={showBankModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowBankModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Bank Details</Text>
            <TouchableOpacity onPress={handleUpdateBankDetails} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.saveButton, { color: theme.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Account Holder Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                value={bankData.accountHolderName}
                onChangeText={(text) => setBankData({ ...bankData, accountHolderName: text })}
                placeholder="Enter account holder name"
                placeholderTextColor={theme.placeholder}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Bank Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                value={bankData.bankName}
                onChangeText={(text) => setBankData({ ...bankData, bankName: text })}
                placeholder="e.g., KCB Bank, Equity Bank"
                placeholderTextColor={theme.placeholder}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Account Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                value={bankData.accountNumber}
                onChangeText={(text) => setBankData({ ...bankData, accountNumber: text })}
                placeholder="Enter account number"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Branch Code</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                value={bankData.branchCode}
                onChangeText={(text) => setBankData({ ...bankData, branchCode: text })}
                placeholder="Optional branch code"
                placeholderTextColor={theme.placeholder}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Emergency Contact Modal */}
      <Modal visible={showEmergencyModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowEmergencyModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Emergency Contact</Text>
            <TouchableOpacity onPress={handleUpdateEmergencyContact} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.saveButton, { color: theme.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Contact Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                value={emergencyData.name}
                onChangeText={(text) => setEmergencyData({ ...emergencyData, name: text })}
                placeholder="Enter contact name"
                placeholderTextColor={theme.placeholder}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                value={emergencyData.phoneNumber}
                onChangeText={(text) => setEmergencyData({ ...emergencyData, phoneNumber: text })}
                placeholder="Enter phone number"
                placeholderTextColor={theme.placeholder}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Relationship *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                value={emergencyData.relationship}
                onChangeText={(text) => setEmergencyData({ ...emergencyData, relationship: text })}
                placeholder="e.g., Spouse, Parent, Sibling"
                placeholderTextColor={theme.placeholder}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Working Hours Modal */}
      <Modal visible={showWorkingHoursModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowWorkingHoursModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Working Hours</Text>
            <TouchableOpacity onPress={handleUpdateWorkingHours} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.saveButton, { color: theme.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputContainer}>
              <View style={styles.workingHoursToggle}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Enable Working Hours</Text>
                <Switch
                  value={workingHours.isActive}
                  onValueChange={(value) => setWorkingHours({ ...workingHours, isActive: value })}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={workingHours.isActive ? '#fff' : '#f4f3f4'}
                />
              </View>
              <Text style={[styles.inputSubtext, { color: theme.textSecondary }]}>
                Only receive orders during these hours
              </Text>
            </View>

            {workingHours.isActive && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Start Time</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                    value={workingHours.start}
                    onChangeText={(text) => setWorkingHours({ ...workingHours, start: text })}
                    placeholder="08:00"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>End Time</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                    value={workingHours.end}
                    onChangeText={(text) => setWorkingHours({ ...workingHours, end: text })}
                    placeholder="22:00"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  onlineToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  onlineToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  onlineIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
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
    marginBottom: 16,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  vehicleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  vehicleText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  quickStatItem: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
    marginTop: -20,
  },
  scrollContent: {
    paddingTop: 30,
    paddingBottom: 30,
  },
  statsSection: {
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  statsCard: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statsContent: {
    flex: 1,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  statsTitle: {
    fontSize: 11,
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
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
  inputSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 50,
  },
  vehicleSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  vehicleLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  workingHoursToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
});

export default DeliveryProfileScreen;