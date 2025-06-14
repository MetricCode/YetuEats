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
  serverTimestamp,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

interface DeliveryDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  isOnline: boolean;
  currentOrders: number;
  totalDeliveries: number;
  rating: number;
  totalRatings: number;
  vehicleType: 'bike' | 'motorcycle' | 'car';
  licensePlate?: string;
  location?: {
    latitude: number;
    longitude: number;
    lastUpdated: any;
  };
  earnings: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  createdAt: any;
  lastActive?: any;
}

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  restaurantId: string;
  restaurantName: string;
  driverId?: string;
  driverName?: string;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  orderValue: number;
  deliveryFee: number;
  pickupAddress: string;
  deliveryAddress: string;
  estimatedDeliveryTime: string;
  actualDeliveryTime?: string;
  createdAt: any;
  assignedAt?: any;
  pickedUpAt?: any;
  deliveredAt?: any;
  distance: number; // in km
  notes?: string;
}

interface DeliveryStats {
  totalDeliveries: number;
  activeDeliveries: number;
  pendingAssignment: number;
  completedToday: number;
  averageDeliveryTime: number;
  totalDrivers: number;
  onlineDrivers: number;
  totalRevenue: number;
  averageRating: number;
}

type FilterType = 'all' | 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

const AdminDeliveryManagementScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<DeliveryOrder[]>([]);
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats>({
    totalDeliveries: 0,
    activeDeliveries: 0,
    pendingAssignment: 0,
    completedToday: 0,
    averageDeliveryTime: 0,
    totalDrivers: 0,
    onlineDrivers: 0,
    totalRevenue: 0,
    averageRating: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DeliveryDriver | null>(null);
  const [showDriverModal, setShowDriverModal] = useState(false);

  useEffect(() => {
    loadDeliveryData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, selectedFilter]);

  const loadDeliveryData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadDrivers(),
        loadDeliveryOrders(),
      ]);
      calculateStats();
    } catch (error) {
      console.error('Error loading delivery data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      // Load delivery drivers from users collection with userType 'delivery'
      const driversSnapshot = await getDocs(
        query(collection(FIREBASE_DB, 'users'), where('userType', '==', 'delivery'))
      );
      
      const driversList: DeliveryDriver[] = driversSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown Driver',
          email: data.email || '',
          phone: data.phone || '',
          isActive: data.isActive !== false,
          isOnline: data.isOnline || false,
          currentOrders: data.currentOrders || 0,
          totalDeliveries: data.totalDeliveries || 0,
          rating: data.rating || 0,
          totalRatings: data.totalRatings || 0,
          vehicleType: data.vehicleType || 'bike',
          licensePlate: data.licensePlate,
          location: data.location,
          earnings: data.earnings || { today: 0, thisWeek: 0, thisMonth: 0 },
          createdAt: data.createdAt,
          lastActive: data.lastActive,
        };
      });
      
      setDrivers(driversList);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadDeliveryOrders = async () => {
    try {
      // Load orders that are in delivery stages
      const ordersSnapshot = await getDocs(
        query(
          collection(FIREBASE_DB, 'orders'),
          where('status', 'in', ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered']),
          orderBy('createdAt', 'desc'),
          limit(100)
        )
      );
      
      const ordersList: DeliveryOrder[] = ordersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          orderNumber: data.orderNumber || `#${doc.id.slice(-6).toUpperCase()}`,
          customerId: data.customerId || data.userId || '',
          customerName: data.customerName || 'Unknown Customer',
          restaurantId: data.restaurantId || '',
          restaurantName: data.restaurantName || 'Unknown Restaurant',
          driverId: data.driverId,
          driverName: data.driverName,
          status: data.status || 'pending',
          orderValue: data.pricing?.total || 0,
          deliveryFee: data.pricing?.deliveryFee || 0,
          pickupAddress: data.restaurantAddress || 'Restaurant Address',
          deliveryAddress: data.deliveryAddress || 'Customer Address',
          estimatedDeliveryTime: data.estimatedDeliveryTime || '30-45 min',
          actualDeliveryTime: data.actualDeliveryTime,
          createdAt: data.createdAt,
          assignedAt: data.assignedAt,
          pickedUpAt: data.pickedUpAt,
          deliveredAt: data.deliveredAt,
          distance: data.distance || 5, // Default 5km
          notes: data.notes,
        };
      });
      
      setOrders(ordersList);
    } catch (error) {
      console.error('Error loading delivery orders:', error);
    }
  };

  const calculateStats = () => {
    const totalDeliveries = orders.length;
    const activeDeliveries = orders.filter(o => ['assigned', 'picked_up', 'in_transit'].includes(o.status)).length;
    const pendingAssignment = orders.filter(o => o.status === 'pending').length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedToday = orders.filter(o => {
      if (o.status !== 'delivered' || !o.deliveredAt) return false;
      const deliveryDate = o.deliveredAt.toDate ? o.deliveredAt.toDate() : new Date(o.deliveredAt.seconds * 1000);
      return deliveryDate >= today;
    }).length;

    const totalDrivers = drivers.length;
    const onlineDrivers = drivers.filter(d => d.isOnline && d.isActive).length;
    
    const totalRevenue = orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, order) => sum + order.deliveryFee, 0);

    const averageRating = drivers.length > 0 
      ? drivers.reduce((sum, driver) => sum + driver.rating, 0) / drivers.length 
      : 0;

    setDeliveryStats({
      totalDeliveries,
      activeDeliveries,
      pendingAssignment,
      completedToday,
      averageDeliveryTime: 35, // Mock data
      totalDrivers,
      onlineDrivers,
      totalRevenue,
      averageRating,
    });
  };

  const filterOrders = () => {
    let filtered = orders;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.restaurantName.toLowerCase().includes(query) ||
        order.driverName?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(order => order.status === selectedFilter);
    }

    setFilteredOrders(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDeliveryData();
    setRefreshing(false);
  };

  const assignDriverToOrder = async (orderId: string, driverId: string) => {
    try {
      await updateDoc(doc(FIREBASE_DB, 'orders', orderId), {
        driverId,
        status: 'assigned',
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      await loadDeliveryData();
      Alert.alert('Success', 'Driver assigned successfully');
    } catch (error) {
      console.error('Error assigning driver:', error);
      Alert.alert('Error', 'Failed to assign driver');
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      if (newStatus === 'picked_up') {
        updateData.pickedUpAt = serverTimestamp();
      } else if (newStatus === 'delivered') {
        updateData.deliveredAt = serverTimestamp();
      }

      await updateDoc(doc(FIREBASE_DB, 'orders', orderId), updateData);
      
      await loadDeliveryData();
      Alert.alert('Success', 'Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const now = new Date();
      let date: Date;
      
      if (timestamp.toDate) {
        date = timestamp.toDate();
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        return 'Unknown';
      }
      
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    } catch (error) {
      return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'assigned': return '#3B82F6';
      case 'picked_up': return '#8B5CF6';
      case 'in_transit': return '#06B6D4';
      case 'delivered': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getVehicleIcon = (vehicleType: string) => {
    switch (vehicleType) {
      case 'bike': return 'bicycle';
      case 'motorcycle': return 'car-sport';
      case 'car': return 'car';
      default: return 'bicycle';
    }
  };

  const renderFilterTab = (filter: FilterType, label: string) => {
    const isSelected = selectedFilter === filter;
    const count = orders.filter(o => filter === 'all' || o.status === filter).length;

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

  const renderStatsCard = (title: string, value: string, subtitle: string, icon: string, color: string) => (
    <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={[styles.statsIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={[styles.statsValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.statsSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
    </View>
  );

  const renderOrderCard = ({ item }: { item: DeliveryOrder }) => (
    <TouchableOpacity
      style={[styles.orderCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      onPress={() => {
        setSelectedOrder(item);
        setShowOrderModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={[styles.orderNumber, { color: theme.text }]}>{item.orderNumber}</Text>
          <Text style={[styles.customerName, { color: theme.textSecondary }]}>{item.customerName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="restaurant" size={14} color={theme.textMuted} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>{item.restaurantName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={14} color={theme.textMuted} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.deliveryAddress}
          </Text>
        </View>
        {item.driverName && (
          <View style={styles.detailRow}>
            <Ionicons name="person" size={14} color={theme.textMuted} />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>{item.driverName}</Text>
          </View>
        )}
      </View>

      <View style={styles.orderFooter}>
        <Text style={[styles.orderValue, { color: theme.primary }]}>
          {formatPrice(item.orderValue)}
        </Text>
        <Text style={[styles.orderTime, { color: theme.textMuted }]}>
          {getTimeAgo(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderDriverCard = ({ item }: { item: DeliveryDriver }) => (
    <TouchableOpacity
      style={[styles.driverCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      onPress={() => {
        setSelectedDriver(item);
        setShowDriverModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.driverHeader}>
        <Image
          source={{
            uri: `https://ui-avatars.com/api/?name=${item.name}&background=4F46E5&color=fff&size=200`,
          }}
          style={styles.driverImage}
        />
        <View style={styles.driverInfo}>
          <Text style={[styles.driverName, { color: theme.text }]}>{item.name}</Text>
          <View style={styles.driverStatus}>
            <View style={[
              styles.statusDot,
              { backgroundColor: item.isOnline ? '#10B981' : '#6B7280' }
            ]} />
            <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>
              {item.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        <View style={styles.vehicleInfo}>
          <Ionicons name={getVehicleIcon(item.vehicleType) as any} size={20} color={theme.primary} />
          <Text style={[styles.vehicleType, { color: theme.textMuted }]}>{item.vehicleType}</Text>
        </View>
      </View>

      <View style={styles.driverStats}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.primary }]}>{item.totalDeliveries}</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Deliveries</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.success }]}>
            {item.rating > 0 ? item.rating.toFixed(1) : 'N/A'}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Rating</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.warning }]}>{item.currentOrders}</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Active</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading delivery data...</Text>
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
        <Text style={styles.headerTitle}>Delivery Management</Text>
        <Text style={styles.headerSubtitle}>Track deliveries and manage drivers</Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderStatsCard('Active Deliveries', deliveryStats.activeDeliveries.toString(), 'Currently in progress', 'car', '#3B82F6')}
            {renderStatsCard('Pending Orders', deliveryStats.pendingAssignment.toString(), 'Awaiting assignment', 'time', '#F59E0B')}
            {renderStatsCard('Online Drivers', deliveryStats.onlineDrivers.toString(), `of ${deliveryStats.totalDrivers} total`, 'person', '#10B981')}
            {renderStatsCard('Today Delivered', deliveryStats.completedToday.toString(), 'Completed orders', 'checkmark-circle', '#8B5CF6')}
          </ScrollView>
        </View>

        {/* Search and Filters */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.inputBackground }]}>
            <Ionicons name="search-outline" size={20} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search orders, customers, drivers..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.placeholder}
            />
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderFilterTab('all', 'All')}
            {renderFilterTab('pending', 'Pending')}
            {renderFilterTab('assigned', 'Assigned')}
            {renderFilterTab('in_transit', 'In Transit')}
            {renderFilterTab('delivered', 'Delivered')}
          </ScrollView>
        </View>

        {/* Orders List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Delivery Orders</Text>
          <FlatList
            data={filteredOrders}
            renderItem={renderOrderCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="car-outline" size={48} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No orders found</Text>
              </View>
            }
          />
        </View>

        {/* Drivers List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Drivers</Text>
          <FlatList
            data={drivers.filter(d => d.isActive)}
            renderItem={renderDriverCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            horizontal
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="person-outline" size={48} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No active drivers</Text>
              </View>
            }
          />
        </View>
      </ScrollView>
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
  statsContainer: {
    paddingVertical: 20,
    paddingLeft: 20,
  },
  statsCard: {
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 140,
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  statsSubtitle: {
    fontSize: 10,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
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
  orderDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderTime: {
    fontSize: 12,
  },
  driverCard: {
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    width: 200,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  driverHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  driverImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  driverInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  driverName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  driverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
  },
  vehicleInfo: {
    alignItems: 'center',
    gap: 4,
  },
  vehicleType: {
    fontSize: 10,
    textTransform: 'capitalize',
  },
  driverStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
  },
});

export default AdminDeliveryManagementScreen;