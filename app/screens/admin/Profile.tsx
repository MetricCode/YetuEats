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
  TextInput,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface AdminInfo {
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  permissions: string[];
  lastLogin: any;
  createdAt?: any;
  updatedAt?: any;
  avatar?: string;
  preferences: {
    notifications: boolean;
    emailAlerts: boolean;
    darkMode: boolean;
    autoRefresh: boolean;
    dataRetention: number; // days
  };
}

interface PlatformStats {
  totalRestaurants: number;
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  activeUsers: number;
  systemUptime: string;
  dataProcessed: string;
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
  badge?: string;
}

const AdminProfileScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [adminInfo, setAdminInfo] = useState<AdminInfo>({
    name: '',
    email: user.email || '',
    phone: '',
    role: 'Administrator',
    department: 'Platform Management',
    permissions: ['all'],
    lastLogin: null,
    preferences: {
      notifications: true,
      emailAlerts: true,
      darkMode: isDarkMode,
      autoRefresh: true,
      dataRetention: 90,
    },
  });

  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    totalRestaurants: 0,
    totalCustomers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeUsers: 0,
    systemUptime: '99.9%',
    dataProcessed: '0 GB',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    department: '',
  });

  useEffect(() => {
    loadAdminData();
  }, [user.uid]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAdminProfile(),
        loadPlatformStats(),
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminProfile = async () => {
    try {
      const docRef = doc(FIREBASE_DB, 'admins', user.uid);
      const docSnap = await getDoc(docRef);
      
      let adminData: AdminInfo;
      
      if (docSnap.exists()) {
        adminData = docSnap.data() as AdminInfo;
        adminData.preferences = {
          ...adminInfo.preferences,
          ...adminData.preferences,
          darkMode: isDarkMode, // Sync with theme context
        };
      } else {
        // First time setup - create default admin profile
        adminData = {
          ...adminInfo,
          name: user.displayName || 'Administrator',
          email: user.email || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(docRef, adminData);
      }
      
      setAdminInfo(adminData);
      
      // Update edit form
      setEditForm({
        name: adminData.name,
        phone: adminData.phone,
        department: adminData.department,
      });
    } catch (error) {
      console.error('Error loading admin profile:', error);
    }
  };

  const loadPlatformStats = async () => {
    try {
      // Load restaurants count
      const restaurantsSnapshot = await getDocs(collection(FIREBASE_DB, 'restaurants'));
      const totalRestaurants = restaurantsSnapshot.size;

      // Load customers count
      const customersSnapshot = await getDocs(
        query(collection(FIREBASE_DB, 'users'), where('userType', '==', 'customer'))
      );
      const totalCustomers = customersSnapshot.size;

      // Load orders data
      const ordersSnapshot = await getDocs(collection(FIREBASE_DB, 'orders'));
      const orders = ordersSnapshot.docs.map(doc => doc.data());
      const totalOrders = orders.length;
      const totalRevenue = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, order) => sum + (order.pricing?.total || 0), 0);

      // Calculate active users (logged in within last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Mock data for active users and other metrics
      const activeUsers = Math.floor(totalCustomers * 0.3); // 30% active rate
      const dataProcessed = `${(totalOrders * 0.5 / 1000).toFixed(1)} GB`; // Mock calculation

      setPlatformStats({
        totalRestaurants,
        totalCustomers,
        totalOrders,
        totalRevenue,
        activeUsers,
        systemUptime: '99.9%',
        dataProcessed,
      });
    } catch (error) {
      console.error('Error loading platform stats:', error);
    }
  };

  const saveAdminData = async (updatedInfo: Partial<AdminInfo>) => {
    try {
      setSaving(true);
      const docRef = doc(FIREBASE_DB, 'admins', user.uid);
      
      const dataToSave = {
        ...updatedInfo,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(docRef, dataToSave);
      
      // Update local state
      setAdminInfo(prev => ({ ...prev, ...updatedInfo }));
      
      return true;
    } catch (error) {
      console.error('Error saving admin data:', error);
      Alert.alert('Error', 'Failed to save admin information');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
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
              await signOut(FIREBASE_AUTH);
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  const toggleNotifications = async (enabled: boolean) => {
    const success = await saveAdminData({ 
      preferences: { ...adminInfo.preferences, notifications: enabled } 
    });
    if (!success) {
      // Revert the change if save failed
      return;
    }
  };

  const toggleEmailAlerts = async (enabled: boolean) => {
    const success = await saveAdminData({ 
      preferences: { ...adminInfo.preferences, emailAlerts: enabled } 
    });
    if (!success) {
      return;
    }
  };

  const toggleAutoRefresh = async (enabled: boolean) => {
    const success = await saveAdminData({ 
      preferences: { ...adminInfo.preferences, autoRefresh: enabled } 
    });
    if (!success) {
      return;
    }
  };

  const validateAndSave = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    const updatedData = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      department: editForm.department.trim(),
    };

    const success = await saveAdminData(updatedData);
    
    if (success) {
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    }
  };

  const resetForm = () => {
    setEditForm({
      name: adminInfo.name,
      phone: adminInfo.phone,
      department: adminInfo.department,
    });
  };

  const exportData = () => {
    Alert.alert(
      'Export Data',
      'Choose what data to export:',
      [
        { text: 'All Data', onPress: () => console.log('Export all data') },
        { text: 'User Data', onPress: () => console.log('Export user data') },
        { text: 'Order Data', onPress: () => console.log('Export order data') },
        { text: 'Analytics', onPress: () => console.log('Export analytics') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const viewSystemLogs = () => {
    Alert.alert(
      'System Logs',
      'View system logs and activities:',
      [
        { text: 'Error Logs', onPress: () => console.log('View error logs') },
        { text: 'Activity Logs', onPress: () => console.log('View activity logs') },
        { text: 'Security Logs', onPress: () => console.log('View security logs') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const managePermissions = () => {
    Alert.alert(
      'Manage Permissions',
      'Configure admin permissions and access levels.',
      [
        { text: 'User Management', onPress: () => console.log('User permissions') },
        { text: 'System Settings', onPress: () => console.log('System permissions') },
        { text: 'Data Access', onPress: () => console.log('Data permissions') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const profileSections: ProfileMenuSection[] = [
    {
      title: 'Administration',
      items: [
        {
          id: '1',
          icon: 'person-outline',
          title: 'Edit Profile',
          subtitle: 'Update personal information',
          action: 'navigate',
          iconColor: '#4F46E5',
          onPress: () => {
            resetForm();
            setShowEditModal(true);
          },
        },
        {
          id: '2',
          icon: 'shield-checkmark-outline',
          title: 'Permissions & Access',
          subtitle: 'Manage admin permissions',
          action: 'navigate',
          iconColor: '#059669',
          onPress: managePermissions,
        },
        {
          id: '3',
          icon: 'document-text-outline',
          title: 'System Logs',
          subtitle: 'View system activities and logs',
          action: 'navigate',
          iconColor: '#DC2626',
          onPress: viewSystemLogs,
        },
        {
          id: '4',
          icon: 'download-outline',
          title: 'Export Data',
          subtitle: 'Export platform data',
          action: 'navigate',
          iconColor: '#7C3AED',
          onPress: exportData,
        },
      ],
    },
    {
      title: 'Platform Settings',
      items: [
        {
          id: '5',
          icon: 'notifications-outline',
          title: 'Push Notifications',
          subtitle: 'Receive system notifications',
          action: 'toggle',
          hasToggle: true,
          toggleValue: adminInfo.preferences.notifications,
          iconColor: '#8B5CF6',
          onToggle: toggleNotifications,
        },
        {
          id: '6',
          icon: 'mail-outline',
          title: 'Email Alerts',
          subtitle: 'Receive email notifications',
          action: 'toggle',
          hasToggle: true,
          toggleValue: adminInfo.preferences.emailAlerts,
          iconColor: '#06B6D4',
          onToggle: toggleEmailAlerts,
        },
        {
          id: '7',
          icon: 'refresh-outline',
          title: 'Auto Refresh',
          subtitle: 'Automatically refresh data',
          action: 'toggle',
          hasToggle: true,
          toggleValue: adminInfo.preferences.autoRefresh,
          iconColor: '#10B981',
          onToggle: toggleAutoRefresh,
        },
        {
          id: '8',
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
      title: 'System Information',
      items: [
        {
          id: '9',
          icon: 'server-outline',
          title: 'System Status',
          subtitle: `Uptime: ${platformStats.systemUptime}`,
          action: 'navigate',
          iconColor: '#10B981',
          onPress: () => console.log('View system status'),
        },
        {
          id: '10',
          icon: 'analytics-outline',
          title: 'Performance Metrics',
          subtitle: `${platformStats.dataProcessed} processed`,
          action: 'navigate',
          iconColor: '#3B82F6',
          onPress: () => console.log('View performance metrics'),
        },
        {
          id: '11',
          icon: 'help-circle-outline',
          title: 'Support & Documentation',
          subtitle: 'Get help and view docs',
          action: 'navigate',
          iconColor: '#F59E0B',
          onPress: () => console.log('Open support'),
        },
      ],
    },
  ];

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
          <View style={styles.menuTitleRow}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
            {item.badge && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </View>
          {item.subtitle && (
            <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
          )}
        </View>
      </View>
      <View style={styles.menuItemRight}>
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

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={[styles.modalContainer, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowEditModal(false)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={validateAndSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[styles.saveButton, { color: theme.primary }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Full Name *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter your full name"
              placeholderTextColor={theme.placeholder}
              value={editForm.name}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="+254 XXX XXX XXX"
              placeholderTextColor={theme.placeholder}
              value={editForm.phone}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Department</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Platform Management"
              placeholderTextColor={theme.placeholder}
              value={editForm.department}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, department: text }))}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Email (Read Only)</Text>
            <TextInput
              style={[styles.formInput, styles.readOnlyInput, { backgroundColor: theme.inputBackground, color: theme.textMuted, borderColor: theme.border }]}
              value={adminInfo.email}
              editable={false}
            />
            <Text style={[styles.helpText, { color: theme.textMuted }]}>
              Email cannot be changed for security reasons
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Role (Read Only)</Text>
            <TextInput
              style={[styles.formInput, styles.readOnlyInput, { backgroundColor: theme.inputBackground, color: theme.textMuted, borderColor: theme.border }]}
              value={adminInfo.role}
              editable={false}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading admin profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin Profile</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.statusText}>Online</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Header */}
        <View style={styles.adminHeader}>
          <View style={styles.adminImageContainer}>
            <Image
              source={{
                uri: adminInfo.avatar || `https://ui-avatars.com/api/?name=${adminInfo.name}&background=4F46E5&color=fff&size=200`,
              }}
              style={styles.adminImage}
            />
            <TouchableOpacity style={[styles.editImageButton, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.adminName}>
            {adminInfo.name || 'Administrator'}
          </Text>
          <Text style={styles.adminRole}>
            {adminInfo.role} • {adminInfo.department}
          </Text>
          
          {/* Platform Stats */}
          <View style={[styles.statsContainer, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.95)' }]}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="restaurant" size={15} color="#F59E0B" />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#2D3748' }]}>
                {platformStats.totalRestaurants}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? theme.textSecondary : '#6B7280' }]}>
                Restaurants
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="people" size={15} color="#3B82F6" />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#2D3748' }]}>
                {platformStats.totalCustomers}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? theme.textSecondary : '#6B7280' }]}>
                Customers
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="receipt" size={15} color="#10B981" />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#2D3748' }]}>
                {platformStats.totalOrders}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? theme.textSecondary : '#6B7280' }]}>
                Orders
              </Text>
            </View>
          </View>

          {/* Additional Stats */}
          <View style={[styles.additionalStatsContainer, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
            <View style={styles.additionalStatItem}>
              <Text style={[styles.additionalStatNumber, { color: theme.text }]}>
                {platformStats.activeUsers}
              </Text>
              <Text style={[styles.additionalStatLabel, { color: theme.textSecondary }]}>
                Active Users
              </Text>
            </View>
            <View style={styles.additionalStatItem}>
              <Text style={[styles.additionalStatNumber, { color: theme.text }]}>
                {platformStats.systemUptime}
              </Text>
              <Text style={[styles.additionalStatLabel, { color: theme.textSecondary }]}>
                Uptime
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Quick Info Cards */}
        <View style={styles.quickInfoContainer}>
          <View style={[styles.quickInfoCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.quickInfoHeader}>
              <Ionicons name="shield-checkmark" size={20} color={theme.success} />
              <Text style={[styles.quickInfoTitle, { color: theme.text }]}>System Status</Text>
            </View>
            <Text style={[styles.quickInfoText, { color: theme.textSecondary }]}>
              All systems operational
            </Text>
            <Text style={[styles.quickInfoText, { color: theme.textSecondary }]}>
              Last backup: Today
            </Text>
            <Text style={[styles.quickInfoRevenue, { color: theme.primary }]}>
              {platformStats.activeUsers} active users online
            </Text>
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
          <Text style={[styles.versionText, { color: theme.textMuted }]}>YetuEats Admin Panel v1.0.0</Text>
          <Text style={[styles.copyrightText, { color: theme.textMuted }]}>© 2025 YetuEats. All rights reserved.</Text>
        </View>
      </ScrollView>

      {renderEditModal()}
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
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  headerGradient: {
    paddingBottom: 35,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 25,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  adminHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  adminImageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  adminImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff',
    borderWidth: 5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  editImageButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  adminName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  adminRole: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 28,
    textAlign: 'center',
    opacity: 0.9,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.3,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    marginBottom: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  statDivider: {
    width: 2,
    height: 50,
    marginHorizontal: 20,
    borderRadius: 1,
    opacity: 0.3,
  },
  additionalStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  additionalStatItem: {
    alignItems: 'center',
  },
  additionalStatNumber: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  additionalStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  scrollView: {
    flex: 1,
    marginTop: -25,
  },
  scrollContent: {
    paddingTop: 35,
    paddingBottom: 40,
  },
  quickInfoContainer: {
    paddingHorizontal: 24,
    marginBottom: 35,
  },
  quickInfoCard: {
    padding: 20,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  quickInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickInfoTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  quickInfoText: {
    fontSize: 15,
    marginBottom: 4,
    lineHeight: 20,
    opacity: 0.9,
  },
  quickInfoRevenue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.2,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 24,
    marginBottom: 16,
    letterSpacing: 0.4,
  },
  sectionContent: {
    marginHorizontal: 24,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 80,
  },
  separator: {
    height: 1,
    marginLeft: 76,
    opacity: 0.4,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  menuItemText: {
    flex: 1,
    paddingRight: 12,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  menuSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    opacity: 0.8,
  },
  menuItemRight: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  signOutContainer: {
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 30,
  },
  signOutButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  signOutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 24,
  },
  versionText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  copyrightText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.7,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  saveButton: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  formInput: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  readOnlyInput: {
    opacity: 0.6,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  helpText: {
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
    opacity: 0.7,
    lineHeight: 16,
  },
});

export default AdminProfileScreen;