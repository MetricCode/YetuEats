import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  setDoc
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { FIREBASE_DB, FIREBASE_AUTH } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  userType: 'customer' | 'restaurant' | 'admin';
  isActive: boolean;
  isBlocked: boolean;
  createdAt: any;
  lastLoginAt?: any;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  favoriteRestaurants: string[];
  address?: {
    street: string;
    city: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  preferences?: {
    notifications: boolean;
    emailMarketing: boolean;
    smsMarketing: boolean;
  };
  avatar?: string;
  dateOfBirth?: any;
  loyaltyPoints?: number;
}

interface UserStats {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: any;
  favoriteRestaurant: string;
  completedOrders: number;
  cancelledOrders: number;
  orderCompletionRate: number;
}

type FilterType = 'all' | 'customers' | 'restaurants' | 'active' | 'inactive' | 'blocked' | 'recent';
type SortType = 'name' | 'created' | 'lastLogin' | 'totalSpent' | 'totalOrders';

const AdminUsersManagementScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('created');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchQuery, selectedFilter, sortBy]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Load all users from the users collection
      const usersSnapshot = await getDocs(
        query(collection(FIREBASE_DB, 'users'), orderBy('createdAt', 'desc'))
      );
      
      const usersList: AppUser[] = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        
        // Calculate user statistics
        const ordersSnapshot = await getDocs(
          query(
            collection(FIREBASE_DB, 'orders'),
            where('customerId', '==', userDoc.id),
            limit(100)
          )
        );
        
        const userOrders = ordersSnapshot.docs.map(doc => doc.data());
        const completedOrders = userOrders.filter(order => order.status === 'delivered');
        const totalSpent = completedOrders.reduce((sum, order) => sum + (order.pricing?.total || 0), 0);
        const averageOrderValue = completedOrders.length > 0 ? totalSpent / completedOrders.length : 0;
        
        usersList.push({
          id: userDoc.id,
          name: userData.name || userData.displayName || 'Unknown User',
          email: userData.email || '',
          phone: userData.phone || userData.phoneNumber || '',
          userType: userData.userType || 'customer',
          isActive: userData.isActive !== false, // Default to true if not specified
          isBlocked: userData.isBlocked || false,
          createdAt: userData.createdAt,
          lastLoginAt: userData.lastLoginAt || userData.lastSignInTime,
          totalOrders: userOrders.length,
          totalSpent,
          averageOrderValue,
          favoriteRestaurants: userData.favoriteRestaurants || [],
          address: userData.address,
          preferences: userData.preferences || {
            notifications: true,
            emailMarketing: false,
            smsMarketing: false,
          },
          avatar: userData.avatar || userData.photoURL,
          dateOfBirth: userData.dateOfBirth,
          loyaltyPoints: userData.loyaltyPoints || 0,
        });
      }
      
      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortUsers = () => {
    let filtered = users;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone.toLowerCase().includes(query) ||
        (user.address?.street && user.address.street.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    switch (selectedFilter) {
      case 'customers':
        filtered = filtered.filter(user => user.userType === 'customer');
        break;
      case 'restaurants':
        filtered = filtered.filter(user => user.userType === 'restaurant');
        break;
      case 'active':
        filtered = filtered.filter(user => user.isActive && !user.isBlocked);
        break;
      case 'inactive':
        filtered = filtered.filter(user => !user.isActive);
        break;
      case 'blocked':
        filtered = filtered.filter(user => user.isBlocked);
        break;
      case 'recent':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = filtered.filter(user => {
          if (!user.createdAt) return false;
          const userDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt.seconds * 1000);
          return userDate >= sevenDaysAgo;
        });
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'totalSpent':
          return b.totalSpent - a.totalSpent;
        case 'totalOrders':
          return b.totalOrders - a.totalOrders;
        case 'lastLogin':
          if (!a.lastLoginAt || !b.lastLoginAt) return 0;
          const dateA = a.lastLoginAt.toDate ? a.lastLoginAt.toDate() : new Date(a.lastLoginAt.seconds * 1000);
          const dateB = b.lastLoginAt.toDate ? b.lastLoginAt.toDate() : new Date(b.lastLoginAt.seconds * 1000);
          return dateB.getTime() - dateA.getTime();
        case 'created':
        default:
          if (!a.createdAt || !b.createdAt) return 0;
          const createdA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt.seconds * 1000);
          const createdB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt.seconds * 1000);
          return createdB.getTime() - createdA.getTime();
      }
    });

    setFilteredUsers(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(FIREBASE_DB, 'users', userId), {
        isActive: !currentStatus,
        updatedAt: serverTimestamp(),
      });
      
      await loadUsers();
      Alert.alert('Success', `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error updating user status:', error);
      Alert.alert('Error', 'Failed to update user status');
    }
  };

  const toggleUserBlocked = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(FIREBASE_DB, 'users', userId), {
        isBlocked: !currentStatus,
        updatedAt: serverTimestamp(),
      });
      
      await loadUsers();
      Alert.alert('Success', `User ${!currentStatus ? 'blocked' : 'unblocked'} successfully`);
    } catch (error) {
      console.error('Error updating user blocked status:', error);
      Alert.alert('Error', 'Failed to update user blocked status');
    }
  };

  const deleteUser = async (userId: string) => {
    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user? This action cannot be undone and will also delete all their orders and data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(FIREBASE_DB, 'users', userId));
              await loadUsers();
              Alert.alert('Success', 'User deleted successfully');
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const loadUserStats = async (userId: string) => {
    try {
      // Load detailed user orders
      const ordersSnapshot = await getDocs(
        query(
          collection(FIREBASE_DB, 'orders'),
          where('customerId', '==', userId),
          orderBy('createdAt', 'desc')
        )
      );

      const orders = ordersSnapshot.docs.map(doc => doc.data());
      const completedOrders = orders.filter(o => o.status === 'delivered');
      const cancelledOrders = orders.filter(o => o.status === 'cancelled');

      const totalSpent = completedOrders.reduce((sum, order) => 
        sum + (order.pricing?.total || 0), 0);
      const averageOrderValue = completedOrders.length > 0 
        ? totalSpent / completedOrders.length : 0;
      const orderCompletionRate = orders.length > 0 
        ? (completedOrders.length / orders.length) * 100 : 0;

      // Find most frequent restaurant
      const restaurantCounts = new Map();
      completedOrders.forEach(order => {
        const restaurantId = order.restaurantId;
        restaurantCounts.set(restaurantId, (restaurantCounts.get(restaurantId) || 0) + 1);
      });

      let favoriteRestaurant = 'None';
      let maxCount = 0;
      for (const [restaurantId, count] of restaurantCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          // In a real app, you'd fetch the restaurant name
          favoriteRestaurant = `Restaurant ${restaurantId.slice(-6)}`;
        }
      }

      const lastOrderDate = orders.length > 0 ? orders[0].createdAt : null;

      setUserStats({
        totalOrders: orders.length,
        totalSpent,
        averageOrderValue,
        lastOrderDate,
        favoriteRestaurant,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        orderCompletionRate,
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Never';
    
    try {
      const now = new Date();
      let date: Date;
      
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        return 'Unknown';
      }
      
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
      if (diffInMinutes < 43200) return `${Math.floor(diffInMinutes / 1440)} days ago`;
      return `${Math.floor(diffInMinutes / 43200)} months ago`;
    } catch (error) {
      return 'Unknown';
    }
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'customer': return 'person-outline';
      case 'restaurant': return 'restaurant-outline';
      case 'admin': return 'shield-checkmark-outline';
      default: return 'person-outline';
    }
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'customer': return '#3B82F6';
      case 'restaurant': return '#F59E0B';
      case 'admin': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const renderFilterTab = (filter: FilterType, label: string) => {
    const isSelected = selectedFilter === filter;
    const count = users.filter(u => {
      switch (filter) {
        case 'customers': return u.userType === 'customer';
        case 'restaurants': return u.userType === 'restaurant';
        case 'active': return u.isActive && !u.isBlocked;
        case 'inactive': return !u.isActive;
        case 'blocked': return u.isBlocked;
        case 'recent': 
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (!u.createdAt) return false;
          const userDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt.seconds * 1000);
          return userDate >= sevenDaysAgo;
        default: return true;
      }
    }).length;

    return (
      <TouchableOpacity
        key={filter}
        style={[
          styles.filterTab,
          { backgroundColor: isSelected ? theme.primary : theme.inputBackground }
        ]}
        onPress={() => setSelectedFilter(filter)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.filterTabText,
          { color: isSelected ? '#fff' : theme.textSecondary }
        ]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderUserCard = ({ item }: { item: AppUser }) => (
    <TouchableOpacity
      style={[styles.userCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      onPress={() => {
        setSelectedUser(item);
        setShowDetailsModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.userHeader}>
        <View style={styles.userImageContainer}>
          <Image
            source={{
              uri: item.avatar || `https://ui-avatars.com/api/?name=${item.name}&background=${getUserTypeColor(item.userType).slice(1)}&color=fff&size=200`,
            }}
            style={styles.userImage}
          />
          <View style={[styles.userTypeIndicator, { backgroundColor: getUserTypeColor(item.userType) }]}>
            <Ionicons name={getUserTypeIcon(item.userType) as any} size={12} color="#fff" />
          </View>
        </View>
        
        <View style={styles.userInfo}>
          <View style={styles.userTitleRow}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.statusBadges}>
              {item.isBlocked ? (
                <View style={[styles.statusBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.statusText}>Blocked</Text>
                </View>
              ) : (
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: item.isActive ? '#10B981' : '#6B7280' }
                ]}>
                  <Text style={styles.statusText}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.email}
          </Text>
          
          <View style={styles.userTypeRow}>
            <Text style={[styles.userTypeText, { color: getUserTypeColor(item.userType) }]}>
              {item.userType.charAt(0).toUpperCase() + item.userType.slice(1)}
            </Text>
            {item.phone && (
              <Text style={[styles.userPhone, { color: theme.textMuted }]} numberOfLines={1}>
                {item.phone}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.userStats}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.primary }]}>
            {item.totalOrders}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Orders</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.success }]}>
            {formatPrice(item.totalSpent)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Spent</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.warning }]}>
            {formatPrice(item.averageOrderValue)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Avg Order</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.textSecondary }]}>
            {getTimeAgo(item.lastLoginAt)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Last Login</Text>
        </View>
      </View>

      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}
          onPress={(e) => {
            e.stopPropagation();
            setSelectedUser(item);
            loadUserStats(item.id);
            setShowStatsModal(true);
          }}
        >
          <Ionicons name="analytics" size={16} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>Stats</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.actionButton, 
            { 
              backgroundColor: item.isBlocked ? theme.success + '20' : theme.error + '20',
              borderColor: item.isBlocked ? theme.success : theme.error
            }
          ]}
          onPress={(e) => {
            e.stopPropagation();
            toggleUserBlocked(item.id, item.isBlocked);
          }}
        >
          <Ionicons 
            name={item.isBlocked ? "checkmark" : "ban"} 
            size={16} 
            color={item.isBlocked ? theme.success : theme.error} 
          />
          <Text style={[
            styles.actionButtonText, 
            { color: item.isBlocked ? theme.success : theme.error }
          ]}>
            {item.isBlocked ? 'Unblock' : 'Block'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderDetailsModal = () => (
    <Modal
      visible={showDetailsModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      {selectedUser && (
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>User Details</Text>
            <TouchableOpacity onPress={() => deleteUser(selectedUser.id)}>
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* User Avatar */}
            <View style={styles.modalUserHeader}>
              <Image
                source={{
                  uri: selectedUser.avatar || `https://ui-avatars.com/api/?name=${selectedUser.name}&background=${getUserTypeColor(selectedUser.userType).slice(1)}&color=fff&size=200`,
                }}
                style={styles.modalUserImage}
              />
              <Text style={[styles.modalUserName, { color: theme.text }]}>
                {selectedUser.name}
              </Text>
              <Text style={[styles.modalUserType, { color: getUserTypeColor(selectedUser.userType) }]}>
                {selectedUser.userType.charAt(0).toUpperCase() + selectedUser.userType.slice(1)} User
              </Text>
            </View>

            {/* Personal Information */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Email:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{selectedUser.email}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Phone:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedUser.phone || 'Not provided'}
                </Text>
              </View>
              
              {selectedUser.address && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Address:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedUser.address.street}, {selectedUser.address.city}
                  </Text>
                </View>
              )}
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Joined:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {getTimeAgo(selectedUser.createdAt)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Last Login:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {getTimeAgo(selectedUser.lastLoginAt)}
                </Text>
              </View>
            </View>

            {/* Order Statistics */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Statistics</Text>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Total Orders:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{selectedUser.totalOrders}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Total Spent:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {formatPrice(selectedUser.totalSpent)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Average Order:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {formatPrice(selectedUser.averageOrderValue)}
                </Text>
              </View>
              
              {selectedUser.loyaltyPoints !== undefined && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Loyalty Points:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedUser.loyaltyPoints}
                  </Text>
                </View>
              )}
            </View>

            {/* Account Status */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Account Status</Text>
              
              <View style={styles.actionRow}>
                <Text style={[styles.actionLabel, { color: theme.text }]}>Active Status</Text>
                <Switch
                  value={selectedUser.isActive}
                  onValueChange={(value) => toggleUserStatus(selectedUser.id, selectedUser.isActive)}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor={selectedUser.isActive ? '#fff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.actionRow}>
                <Text style={[styles.actionLabel, { color: theme.text }]}>Blocked Status</Text>
                <Switch
                  value={selectedUser.isBlocked}
                  onValueChange={(value) => toggleUserBlocked(selectedUser.id, selectedUser.isBlocked)}
                  trackColor={{ false: theme.border, true: theme.error }}
                  thumbColor={selectedUser.isBlocked ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Preferences */}
            {selectedUser.preferences && (
              <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Preferences</Text>
                
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Notifications:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedUser.preferences.notifications ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Email Marketing:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedUser.preferences.emailMarketing ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>SMS Marketing:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedUser.preferences.smsMarketing ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </Modal>
  );

  const renderStatsModal = () => (
    <Modal
      visible={showStatsModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      {selectedUser && (
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowStatsModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>User Analytics</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* User Header */}
            <View style={[styles.statsHeader, { backgroundColor: theme.surface }]}>
              <Text style={[styles.statsUserName, { color: theme.text }]}>
                {selectedUser.name}
              </Text>
              <Text style={[styles.statsUserEmail, { color: theme.textSecondary }]}>
                {selectedUser.email}
              </Text>
            </View>

            {userStats ? (
              <>
                {/* Key Metrics */}
                <View style={styles.statsGrid}>
                  <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
                    <View style={[styles.statsIcon, { backgroundColor: '#10B981' + '20' }]}>
                      <Ionicons name="wallet" size={24} color="#10B981" />
                    </View>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {formatPrice(userStats.totalSpent)}
                    </Text>
                    <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Total Spent</Text>
                  </View>

                  <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
                    <View style={[styles.statsIcon, { backgroundColor: '#3B82F6' + '20' }]}>
                      <Ionicons name="receipt" size={24} color="#3B82F6" />
                    </View>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {userStats.totalOrders}
                    </Text>
                    <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Total Orders</Text>
                  </View>

                  <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
                    <View style={[styles.statsIcon, { backgroundColor: '#F59E0B' + '20' }]}>
                      <Ionicons name="card" size={24} color="#F59E0B" />
                    </View>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {formatPrice(userStats.averageOrderValue)}
                    </Text>
                    <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Avg Order Value</Text>
                  </View>

                  <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
                    <View style={[styles.statsIcon, { backgroundColor: '#8B5CF6' + '20' }]}>
                      <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
                    </View>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {userStats.orderCompletionRate.toFixed(1)}%
                    </Text>
                    <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Completion Rate</Text>
                  </View>
                </View>

                {/* Additional Stats */}
                <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Details</Text>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Completed Orders:</Text>
                    <Text style={[styles.detailValue, { color: theme.success }]}>
                      {userStats.completedOrders}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Cancelled Orders:</Text>
                    <Text style={[styles.detailValue, { color: theme.error }]}>
                      {userStats.cancelledOrders}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Favorite Restaurant:</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {userStats.favoriteRestaurant}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Last Order:</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {getTimeAgo(userStats.lastOrderDate)}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.statsLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.statsLoadingText, { color: theme.text }]}>
                  Loading user statistics...
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </Modal>
  );

  // Add this function to your component
  const handleUserCreated = () => {
    loadUsers(); // Refresh the users list
  };

  // Update your header to include a create button
  const renderHeaderWithCreateButton = () => (
    <LinearGradient
      colors={theme.primaryGradient as [string, string]}
      style={styles.header}
    >
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.headerTitle}>User Management</Text>
          <Text style={styles.headerSubtitle}>Manage customers and restaurant users</Text>
        </View>
        <View style={headerStyles.headerRight}>
          <View style={styles.headerStats}>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatNumber}>{customerCount}</Text>
              <Text style={styles.headerStatLabel}>Customers</Text>
            </View>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatNumber}>{restaurantCount}</Text>
              <Text style={styles.headerStatLabel}>Restaurants</Text>
            </View>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatNumber}>{activeCount}</Text>
              <Text style={styles.headerStatLabel}>Active</Text>
            </View>
          </View>
          <TouchableOpacity
            style={headerStyles.createUserButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="person-add" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading users...</Text>
      </View>
    );
  }

  const customerCount = users.filter(u => u.userType === 'customer').length;
  const restaurantCount = users.filter(u => u.userType === 'restaurant').length;
  const activeCount = users.filter(u => u.isActive && !u.isBlocked).length;

  // Update your return statement to include the create modal
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {renderHeaderWithCreateButton()}
      
      {/* Search and Sort */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.inputBackground }]}>
          <Ionicons name="search-outline" size={20} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search users by name, email, or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.placeholder}
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.sortButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            Alert.alert(
              'Sort By',
              'Choose sorting criteria',
              [
                { text: 'Name', onPress: () => setSortBy('name') },
                { text: 'Date Joined', onPress: () => setSortBy('created') },
                { text: 'Last Login', onPress: () => setSortBy('lastLogin') },
                { text: 'Total Spent', onPress: () => setSortBy('totalSpent') },
                { text: 'Total Orders', onPress: () => setSortBy('totalOrders') },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <Ionicons name="funnel" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: theme.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {renderFilterTab('all', 'All')}
          {renderFilterTab('customers', 'Customers')}
          {renderFilterTab('restaurants', 'Restaurants')}
          {renderFilterTab('active', 'Active')}
          {renderFilterTab('inactive', 'Inactive')}
          {renderFilterTab('blocked', 'Blocked')}
          {renderFilterTab('recent', 'Recent')}
        </ScrollView>
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUserCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.usersList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No users found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery || selectedFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'No users have registered yet'
              }
            </Text>
          </View>
        }
      />

      {/* Modals */}
      {renderDetailsModal()}
      {renderStatsModal()}
      
      {/* Create User Modal */}
      <CreateUserModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={handleUserCreated}
      />
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  headerStatItem: {
    alignItems: 'center',
  },
  headerStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerStatLabel: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.8,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  sortButton: {
    marginLeft: 12,
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 25,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  usersList: {
    padding: 20,
    paddingBottom: 100,
  },
  userCard: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  userImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  userTypeIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 4,
  },
  userTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userPhone: {
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalUserHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalUserImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  modalUserName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalUserType: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionLabel: {
    fontSize: 16,
  },
  // Stats Modal Styles
  statsHeader: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  statsUserName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  statsUserEmail: {
    fontSize: 14,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statsCard: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  statsLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  statsLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  statsLoadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  // Create User Modal Styles
  userTypeContainer: {
    marginBottom: 20,
  },
  userTypeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  userTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  userTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  vehicleTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  passwordContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passwordTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  temporaryPassword: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 8,
    letterSpacing: 2,
  },
  passwordNote: {
    fontSize: 12,
    lineHeight: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});

// Add these additional styles
const headerStyles = StyleSheet.create({
  headerRight: {
    alignItems: 'flex-end',
  },
  createUserButton: {
    backgroundColor: '#fff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
});

// Define the form data interface for creating a user
interface CreateAccountForm {
  name: string;
  email: string;
  phone: string;
  userType: 'customer' | 'restaurant' | 'delivery';
  temporaryPassword: string;
  restaurantName?: string;
  restaurantAddress?: string;
  vehicleType?: string;
  licenseNumber?: string;
}

const CreateUserModal = ({ 
  visible, 
  onClose, 
  onUserCreated 
}: { 
  visible: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateAccountForm>({
    name: '',
    email: '',
    phone: '',
    userType: 'customer',
    temporaryPassword: '',
    restaurantName: '',
    restaurantAddress: '',
    vehicleType: '',
    licenseNumber: '',
  });

  const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, temporaryPassword: password }));
  };

  useEffect(() => {
    if (visible && !formData.temporaryPassword) {
      generateTemporaryPassword();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const validateForm = () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }

    if (formData.userType === 'restaurant' && !formData.restaurantName?.trim()) {
      Alert.alert('Missing Information', 'Restaurant name is required for restaurant accounts.');
      return false;
    }

    if (formData.userType === 'delivery' && (!formData.vehicleType?.trim() || !formData.licenseNumber?.trim())) {
      Alert.alert('Missing Information', 'Vehicle type and license number are required for delivery accounts.');
      return false;
    }

    return true;
  };

  const createAccount = async () => {
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      // Create the user account
      const userCredential = await createUserWithEmailAndPassword(
        FIREBASE_AUTH,
        formData.email.trim(),
        formData.temporaryPassword
      );

      // Update the user's display name
      await updateProfile(userCredential.user, {
        displayName: formData.name.trim()
      });

      // Create user document in Firestore
      const userData: any = {
        uid: userCredential.user.uid,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        userType: formData.userType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        profileComplete: true,
        createdByAdmin: true,
        temporaryPassword: true, // Flag to indicate they need to change password
      };

      // Add specific fields based on user type
      if (formData.userType === 'restaurant') {
        Object.assign(userData, {
          restaurantName: formData.restaurantName?.trim(),
          restaurantAddress: formData.restaurantAddress?.trim(),
          isVerified: false,
          isApproved: false,
        });
      } else if (formData.userType === 'delivery') {
        Object.assign(userData, {
          vehicleType: formData.vehicleType?.trim(),
          licenseNumber: formData.licenseNumber?.trim(),
          isVerified: false,
          isApproved: false,
          isAvailable: false,
        });
      }

      await setDoc(doc(FIREBASE_DB, 'users', userCredential.user.uid), userData);

      // Send password reset email so they can set their own password
      await sendPasswordResetEmail(FIREBASE_AUTH, formData.email.trim());

      Alert.alert(
        'Account Created Successfully',
        `A ${formData.userType} account has been created for ${formData.name}. They will receive an email to set their password.`,
        [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              onUserCreated();
              onClose();
            }
          }
        ]
      );

    } catch (error: any) {
      console.error('Error creating account:', error);
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      
      Alert.alert('Account Creation Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      userType: 'customer',
      temporaryPassword: '',
      restaurantName: '',
      restaurantAddress: '',
      vehicleType: '',
      licenseNumber: '',
    });
  };

  const renderUserTypeSelector = () => (
    <View style={additionalStyles.userTypeContainer}>
      <Text style={[additionalStyles.inputLabel, { color: theme.text }]}>Account Type</Text>
      <View style={additionalStyles.userTypeButtons}>
        {(['customer', 'restaurant', 'delivery'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              additionalStyles.userTypeButton,
              {
                backgroundColor: formData.userType === type ? theme.primary : theme.inputBackground,
                borderColor: formData.userType === type ? theme.primary : theme.border
              }
            ]}
            onPress={() => setFormData(prev => ({ ...prev, userType: type }))}
          >
            <Ionicons
              name={
                type === 'customer' ? 'person' :
                type === 'restaurant' ? 'restaurant' : 'bicycle'
              }
              size={20}
              color={formData.userType === type ? '#fff' : theme.textSecondary}
            />
            <Text style={[
              additionalStyles.userTypeButtonText,
              { color: formData.userType === type ? '#fff' : theme.textSecondary }
            ]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderConditionalFields = () => {
    if (formData.userType === 'restaurant') {
      return (
        <>
          <View style={additionalStyles.inputContainer}>
            <Text style={[additionalStyles.inputLabel, { color: theme.text }]}>Restaurant Name *</Text>
            <TextInput
              style={[additionalStyles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter restaurant name"
              placeholderTextColor={theme.placeholder}
              value={formData.restaurantName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, restaurantName: text }))}
            />
          </View>
          <View style={additionalStyles.inputContainer}>
            <Text style={[additionalStyles.inputLabel, { color: theme.text }]}>Restaurant Address</Text>
            <TextInput
              style={[additionalStyles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter restaurant address"
              placeholderTextColor={theme.placeholder}
              value={formData.restaurantAddress}
              onChangeText={(text) => setFormData(prev => ({ ...prev, restaurantAddress: text }))}
              multiline
              numberOfLines={3}
            />
          </View>
        </>
      );
    }

    if (formData.userType === 'delivery') {
      return (
        <>
          <View style={additionalStyles.inputContainer}>
            <Text style={[additionalStyles.inputLabel, { color: theme.text }]}>Vehicle Type *</Text>
            <View style={additionalStyles.vehicleTypeContainer}>
              {['Motorcycle', 'Bicycle', 'Car', 'Scooter'].map((vehicle) => (
                <TouchableOpacity
                  key={vehicle}
                  style={[
                    additionalStyles.vehicleTypeButton,
                    {
                      backgroundColor: formData.vehicleType === vehicle ? theme.primary : theme.inputBackground,
                      borderColor: formData.vehicleType === vehicle ? theme.primary : theme.border
                    }
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, vehicleType: vehicle }))}
                >
                  <Text style={[
                    additionalStyles.vehicleTypeText,
                    { color: formData.vehicleType === vehicle ? '#fff' : theme.textSecondary }
                  ]}>
                    {vehicle}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={additionalStyles.inputContainer}>
            <Text style={[additionalStyles.inputLabel, { color: theme.text }]}>License Number *</Text>
            <TextInput
              style={[additionalStyles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter license number"
              placeholderTextColor={theme.placeholder}
              value={formData.licenseNumber}
              onChangeText={(text) => setFormData(prev => ({ ...prev, licenseNumber: text }))}
            />
          </View>
        </>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Create New Account</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {renderUserTypeSelector()}

          <View style={additionalStyles.inputContainer}>
            <Text style={[additionalStyles.inputLabel, { color: theme.text }]}>Full Name *</Text>
            <TextInput
              style={[additionalStyles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter full name"
              placeholderTextColor={theme.placeholder}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            />
          </View>

          <View style={additionalStyles.inputContainer}>
            <Text style={[additionalStyles.inputLabel, { color: theme.text }]}>Email Address *</Text>
            <TextInput
              style={[additionalStyles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter email address"
              placeholderTextColor={theme.placeholder}
              value={formData.email}
              onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={additionalStyles.inputContainer}>
            <Text style={[additionalStyles.inputLabel, { color: theme.text }]}>Phone Number *</Text>
            <TextInput
              style={[additionalStyles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter phone number"
              placeholderTextColor={theme.placeholder}
              value={formData.phone}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />
          </View>

          {renderConditionalFields()}

          <View style={[additionalStyles.passwordContainer, { backgroundColor: theme.surface }]}>
            <View style={additionalStyles.passwordHeader}>
              <Text style={[additionalStyles.passwordTitle, { color: theme.text }]}>Temporary Password</Text>
              <TouchableOpacity onPress={generateTemporaryPassword}>
                <Ionicons name="refresh" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[additionalStyles.temporaryPassword, { color: theme.textSecondary }]}>
              {formData.temporaryPassword}
            </Text>
            <Text style={[additionalStyles.passwordNote, { color: theme.textMuted }]}>
              The user will receive an email to set their own password.
            </Text>
          </View>

          <TouchableOpacity
            style={[additionalStyles.createButton, { backgroundColor: theme.primary }]}
            onPress={createAccount}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={additionalStyles.createButtonText}>Create Account</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const additionalStyles = StyleSheet.create({
  // Create User Modal Styles
  userTypeContainer: {
    marginBottom: 20,
  },
  userTypeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  userTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  userTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  vehicleTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  passwordContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passwordTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  temporaryPassword: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 8,
    letterSpacing: 2,
  },
  passwordNote: {
    fontSize: 12,
    lineHeight: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});

export default AdminUsersManagementScreen;