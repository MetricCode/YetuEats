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
  limit
} from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

interface Restaurant {
  id: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  cuisine: string[];
  rating: number;
  totalReviews: number;
  deliveryRadius: number;
  minimumOrder: number;
  deliveryFee: number;
  estimatedDeliveryTime: string;
  isActive: boolean;
  isVerified: boolean;
  totalOrders: number;
  monthlyRevenue: number;
  serviceCharge: number;
  taxRate: number;
  hours: {
    [key: string]: { open: string; close: string; isOpen: boolean };
  };
  createdAt: any;
  updatedAt: any;
  lastOrderAt?: any;
  averageOrderValue: number;
  completionRate: number;
}

interface RestaurantStats {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  completionRate: number;
  pendingOrders: number;
  menuItems: number;
}

type FilterType = 'all' | 'active' | 'inactive' | 'verified' | 'unverified' | 'top_rated';
type SortType = 'name' | 'revenue' | 'orders' | 'rating' | 'created';

const AdminRestaurantsManagementScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('created');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [restaurantStats, setRestaurantStats] = useState<RestaurantStats | null>(null);

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    filterAndSortRestaurants();
  }, [restaurants, searchQuery, selectedFilter, sortBy]);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const restaurantsSnapshot = await getDocs(
        query(collection(FIREBASE_DB, 'restaurants'), orderBy('createdAt', 'desc'))
      );
      
      const restaurantsList: Restaurant[] = [];
      restaurantsSnapshot.forEach((doc) => {
        const data = doc.data();
        restaurantsList.push({
          id: doc.id,
          name: data.name || 'Unknown Restaurant',
          description: data.description || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          cuisine: data.cuisine || [],
          rating: data.rating || 0,
          totalReviews: data.totalReviews || 0,
          deliveryRadius: data.deliveryRadius || 5,
          minimumOrder: data.minimumOrder || 0,
          deliveryFee: data.deliveryFee || 0,
          estimatedDeliveryTime: data.estimatedDeliveryTime || '30-45 min',
          isActive: data.isActive || false,
          isVerified: data.isVerified || false,
          totalOrders: data.totalOrders || 0,
          monthlyRevenue: data.monthlyRevenue || 0,
          serviceCharge: data.serviceCharge || 0,
          taxRate: data.taxRate || 16,
          hours: data.hours || {},
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          lastOrderAt: data.lastOrderAt,
          averageOrderValue: data.averageOrderValue || 0,
          completionRate: data.completionRate || 0,
        });
      });
      
      setRestaurants(restaurantsList);
    } catch (error) {
      console.error('Error loading restaurants:', error);
      Alert.alert('Error', 'Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortRestaurants = () => {
    let filtered = restaurants;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(restaurant => 
        restaurant.name.toLowerCase().includes(query) ||
        restaurant.email.toLowerCase().includes(query) ||
        restaurant.address.toLowerCase().includes(query) ||
        restaurant.cuisine.some(c => c.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    switch (selectedFilter) {
      case 'active':
        filtered = filtered.filter(r => r.isActive);
        break;
      case 'inactive':
        filtered = filtered.filter(r => !r.isActive);
        break;
      case 'verified':
        filtered = filtered.filter(r => r.isVerified);
        break;
      case 'unverified':
        filtered = filtered.filter(r => !r.isVerified);
        break;
      case 'top_rated':
        filtered = filtered.filter(r => r.rating >= 4.0);
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'revenue':
          return b.monthlyRevenue - a.monthlyRevenue;
        case 'orders':
          return b.totalOrders - a.totalOrders;
        case 'rating':
          return b.rating - a.rating;
        case 'created':
        default:
          if (!a.createdAt || !b.createdAt) return 0;
          const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt.seconds * 1000);
          const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt.seconds * 1000);
          return dateB.getTime() - dateA.getTime();
      }
    });

    setFilteredRestaurants(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRestaurants();
    setRefreshing(false);
  };

  const toggleRestaurantStatus = async (restaurantId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(FIREBASE_DB, 'restaurants', restaurantId), {
        isActive: !currentStatus,
        updatedAt: serverTimestamp(),
      });
      
      await loadRestaurants();
      Alert.alert('Success', `Restaurant ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error updating restaurant status:', error);
      Alert.alert('Error', 'Failed to update restaurant status');
    }
  };

  const toggleRestaurantVerification = async (restaurantId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(FIREBASE_DB, 'restaurants', restaurantId), {
        isVerified: !currentStatus,
        updatedAt: serverTimestamp(),
      });
      
      await loadRestaurants();
      Alert.alert('Success', `Restaurant ${!currentStatus ? 'verified' : 'unverified'} successfully`);
    } catch (error) {
      console.error('Error updating restaurant verification:', error);
      Alert.alert('Error', 'Failed to update restaurant verification');
    }
  };

  const deleteRestaurant = async (restaurantId: string) => {
    Alert.alert(
      'Delete Restaurant',
      'Are you sure you want to delete this restaurant? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(FIREBASE_DB, 'restaurants', restaurantId));
              await loadRestaurants();
              Alert.alert('Success', 'Restaurant deleted successfully');
            } catch (error) {
              console.error('Error deleting restaurant:', error);
              Alert.alert('Error', 'Failed to delete restaurant');
            }
          },
        },
      ]
    );
  };

  const loadRestaurantStats = async (restaurantId: string) => {
    try {
      // Load orders for this restaurant
      const ordersSnapshot = await getDocs(
        query(
          collection(FIREBASE_DB, 'orders'),
          where('restaurantId', '==', restaurantId),
          orderBy('createdAt', 'desc'),
          limit(100)
        )
      );

      const orders = ordersSnapshot.docs.map(doc => doc.data());
      const completedOrders = orders.filter(o => o.status === 'delivered');
      const pendingOrders = orders.filter(o => 
        ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)
      );

      const totalRevenue = completedOrders.reduce((sum, order) => 
        sum + (order.pricing?.total || 0), 0);
      const averageOrderValue = completedOrders.length > 0 
        ? totalRevenue / completedOrders.length : 0;
      const completionRate = orders.length > 0 
        ? (completedOrders.length / orders.length) * 100 : 0;

      // Load menu items count
      const menuItemsSnapshot = await getDocs(
        query(collection(FIREBASE_DB, 'menuItems'), where('restaurantId', '==', restaurantId))
      );

      setRestaurantStats({
        totalRevenue,
        totalOrders: orders.length,
        averageOrderValue,
        completionRate,
        pendingOrders: pendingOrders.length,
        menuItems: menuItemsSnapshot.size,
      });
    } catch (error) {
      console.error('Error loading restaurant stats:', error);
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
      
      const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 30) return `${diffInDays} days ago`;
      if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
      return `${Math.floor(diffInDays / 365)} years ago`;
    } catch (error) {
      return 'Unknown';
    }
  };

  const renderFilterTab = (filter: FilterType, label: string) => {
    const isSelected = selectedFilter === filter;
    const count = restaurants.filter(r => {
      switch (filter) {
        case 'active': return r.isActive;
        case 'inactive': return !r.isActive;
        case 'verified': return r.isVerified;
        case 'unverified': return !r.isVerified;
        case 'top_rated': return r.rating >= 4.0;
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

  const renderSortOption = (sort: SortType, label: string) => {
    const isSelected = sortBy === sort;
    return (
      <TouchableOpacity
        key={sort}
        style={[
          styles.sortOption,
          { backgroundColor: isSelected ? theme.primary + '20' : 'transparent' }
        ]}
        onPress={() => setSortBy(sort)}
      >
        <Text style={[
          styles.sortOptionText,
          { color: isSelected ? theme.primary : theme.text }
        ]}>
          {label}
        </Text>
        {isSelected && <Ionicons name="checkmark" size={16} color={theme.primary} />}
      </TouchableOpacity>
    );
  };

  const renderRestaurantCard = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity
      style={[styles.restaurantCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      onPress={() => {
        setSelectedRestaurant(item);
        setShowDetailsModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.restaurantHeader}>
        <Image
          source={{
            uri: item.name 
              ? 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
              : `https://ui-avatars.com/api/?name=${item.name}&background=FF6B35&color=fff&size=200`,
          }}
          style={styles.restaurantImage}
        />
        
        <View style={styles.restaurantInfo}>
          <View style={styles.restaurantTitleRow}>
            <Text style={[styles.restaurantName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.statusBadges}>
              <View style={[
                styles.statusBadge,
                { backgroundColor: item.isActive ? '#10B981' : '#EF4444' }
              ]}>
                <Text style={styles.statusText}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
              {item.isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: '#3B82F6' }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#fff" />
                </View>
              )}
            </View>
          </View>
          
          <Text style={[styles.restaurantAddress, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.address || 'No address provided'}
          </Text>
          
          <View style={styles.cuisineContainer}>
            <Text style={[styles.cuisineText, { color: theme.textMuted }]} numberOfLines={1}>
              {item.cuisine.join(', ') || 'No cuisine specified'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.restaurantStats}>
        <View style={styles.statItem}>
          <View style={styles.statRow}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {item.rating > 0 ? item.rating.toFixed(1) : 'N/A'}
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Rating</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.primary }]}>
            {item.totalOrders}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Orders</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.success }]}>
            {formatPrice(item.monthlyRevenue)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Revenue</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.warning }]}>
            {getTimeAgo(item.lastOrderAt)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Last Order</Text>
        </View>
      </View>

      <View style={styles.restaurantActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}
          onPress={(e) => {
            e.stopPropagation();
            setSelectedRestaurant(item);
            loadRestaurantStats(item.id);
            setShowStatsModal(true);
          }}
        >
          <Ionicons name="analytics" size={16} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>Stats</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.success + '20', borderColor: theme.success }]}
          onPress={(e) => {
            e.stopPropagation();
            toggleRestaurantStatus(item.id, item.isActive);
          }}
        >
          <Ionicons name={item.isActive ? "pause" : "play"} size={16} color={theme.success} />
          <Text style={[styles.actionButtonText, { color: theme.success }]}>
            {item.isActive ? 'Deactivate' : 'Activate'}
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
      {selectedRestaurant && (
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Restaurant Details</Text>
            <TouchableOpacity onPress={() => deleteRestaurant(selectedRestaurant.id)}>
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Restaurant Image */}
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
              }}
              style={styles.modalRestaurantImage}
            />

            {/* Basic Info */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Basic Information</Text>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Name:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{selectedRestaurant.name}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Email:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{selectedRestaurant.email}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Phone:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedRestaurant.phone || 'Not provided'}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Address:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedRestaurant.address || 'Not provided'}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Description:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedRestaurant.description || 'No description provided'}
                </Text>
              </View>
            </View>

            {/* Business Info */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Business Information</Text>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Cuisine:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedRestaurant.cuisine.join(', ') || 'Not specified'}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Minimum Order:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {formatPrice(selectedRestaurant.minimumOrder)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Delivery Fee:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {formatPrice(selectedRestaurant.deliveryFee)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Service Charge:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {formatPrice(selectedRestaurant.serviceCharge)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Delivery Time:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedRestaurant.estimatedDeliveryTime}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Delivery Radius:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedRestaurant.deliveryRadius} km
                </Text>
              </View>
            </View>

            {/* Performance */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Performance</Text>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Rating:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedRestaurant.rating > 0 ? `${selectedRestaurant.rating.toFixed(1)}/5` : 'No rating'}
                  {selectedRestaurant.totalReviews > 0 && ` (${selectedRestaurant.totalReviews} reviews)`}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Total Orders:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedRestaurant.totalOrders}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Monthly Revenue:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {formatPrice(selectedRestaurant.monthlyRevenue)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Avg Order Value:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {formatPrice(selectedRestaurant.averageOrderValue)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Created:</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {getTimeAgo(selectedRestaurant.createdAt)}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Actions</Text>
              
              <View style={styles.actionRow}>
                <Text style={[styles.actionLabel, { color: theme.text }]}>Active Status</Text>
                <Switch
                  value={selectedRestaurant.isActive}
                  onValueChange={(value) => toggleRestaurantStatus(selectedRestaurant.id, selectedRestaurant.isActive)}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor={selectedRestaurant.isActive ? '#fff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.actionRow}>
                <Text style={[styles.actionLabel, { color: theme.text }]}>Verified Status</Text>
                <Switch
                  value={selectedRestaurant.isVerified}
                  onValueChange={(value) => toggleRestaurantVerification(selectedRestaurant.id, selectedRestaurant.isVerified)}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={selectedRestaurant.isVerified ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
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
      {selectedRestaurant && (
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowStatsModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Restaurant Analytics</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Restaurant Header */}
            <View style={[styles.statsHeader, { backgroundColor: theme.surface }]}>
              <Text style={[styles.statsRestaurantName, { color: theme.text }]}>
                {selectedRestaurant.name}
              </Text>
              <Text style={[styles.statsRestaurantAddress, { color: theme.textSecondary }]}>
                {selectedRestaurant.address}
              </Text>
            </View>

            {restaurantStats ? (
              <>
                {/* Key Metrics */}
                <View style={styles.statsGrid}>
                  <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
                    <View style={[styles.statsIcon, { backgroundColor: '#10B981' + '20' }]}>
                      <Ionicons name="wallet" size={24} color="#10B981" />
                    </View>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {formatPrice(restaurantStats.totalRevenue)}
                    </Text>
                    <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Total Revenue</Text>
                  </View>

                  <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
                    <View style={[styles.statsIcon, { backgroundColor: '#3B82F6' + '20' }]}>
                      <Ionicons name="receipt" size={24} color="#3B82F6" />
                    </View>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {restaurantStats.totalOrders}
                    </Text>
                    <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Total Orders</Text>
                  </View>

                  <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
                    <View style={[styles.statsIcon, { backgroundColor: '#F59E0B' + '20' }]}>
                      <Ionicons name="card" size={24} color="#F59E0B" />
                    </View>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {formatPrice(restaurantStats.averageOrderValue)}
                    </Text>
                    <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Avg Order Value</Text>
                  </View>

                  <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
                    <View style={[styles.statsIcon, { backgroundColor: '#8B5CF6' + '20' }]}>
                      <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
                    </View>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {restaurantStats.completionRate.toFixed(1)}%
                    </Text>
                    <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Completion Rate</Text>
                  </View>
                </View>

                {/* Additional Stats */}
                <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Current Status</Text>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Pending Orders:</Text>
                    <Text style={[styles.detailValue, { color: theme.warning }]}>
                      {restaurantStats.pendingOrders}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Menu Items:</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {restaurantStats.menuItems}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.statsLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.statsLoadingText, { color: theme.text }]}>
                  Loading restaurant statistics...
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading restaurants...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Restaurant Management</Text>
            <Text style={styles.headerSubtitle}>Manage restaurant partners</Text>
          </View>
          <View style={styles.headerStats}>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatNumber}>{restaurants.filter(r => r.isActive).length}</Text>
              <Text style={styles.headerStatLabel}>Active</Text>
            </View>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatNumber}>{restaurants.filter(r => r.isVerified).length}</Text>
              <Text style={styles.headerStatLabel}>Verified</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Search and Sort */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.inputBackground }]}>
          <Ionicons name="search-outline" size={20} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search restaurants, cuisine, or location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.placeholder}
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.sortButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            // Show sort options in action sheet or modal
            Alert.alert(
              'Sort By',
              'Choose sorting criteria',
              [
                { text: 'Name', onPress: () => setSortBy('name') },
                { text: 'Revenue', onPress: () => setSortBy('revenue') },
                { text: 'Orders', onPress: () => setSortBy('orders') },
                { text: 'Rating', onPress: () => setSortBy('rating') },
                { text: 'Created Date', onPress: () => setSortBy('created') },
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
          {renderFilterTab('active', 'Active')}
          {renderFilterTab('inactive', 'Inactive')}
          {renderFilterTab('verified', 'Verified')}
          {renderFilterTab('unverified', 'Unverified')}
          {renderFilterTab('top_rated', 'Top Rated')}
        </ScrollView>
      </View>

      {/* Restaurants List */}
      <FlatList
        data={filteredRestaurants}
        renderItem={renderRestaurantCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.restaurantsList}
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
            <Ionicons name="restaurant-outline" size={64} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No restaurants found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery || selectedFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'No restaurants have been registered yet'
              }
            </Text>
          </View>
        }
      />

      {/* Modals */}
      {renderDetailsModal()}
      {renderStatsModal()}
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
    gap: 20,
  },
  headerStatItem: {
    alignItems: 'center',
  },
  headerStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerStatLabel: {
    fontSize: 12,
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
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sortOptionText: {
    fontSize: 16,
  },
  restaurantsList: {
    padding: 20,
    paddingBottom: 100,
  },
  restaurantCard: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  restaurantHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  restaurantImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  restaurantName: {
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
  verifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantAddress: {
    fontSize: 12,
    marginBottom: 4,
  },
  cuisineContainer: {
    flexDirection: 'row',
  },
  cuisineText: {
    fontSize: 12,
    flex: 1,
  },
  restaurantStats: {
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
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  restaurantActions: {
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
  modalRestaurantImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
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
  statsRestaurantName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  statsRestaurantAddress: {
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
});

export default AdminRestaurantsManagementScreen;