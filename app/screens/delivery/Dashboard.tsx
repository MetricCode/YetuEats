import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  restaurantName: string;
  restaurantAddress: string;
  deliveryAddress: {
    label: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  totalAmount: number;
  deliveryFee: number;
  status: 'ready_for_pickup' | 'picked_up' | 'on_the_way' | 'delivered';
  estimatedTime: string;
  distance: string;
  deliveryInstructions?: string;
  createdAt: any;
}

interface DeliveryStats {
  todayDeliveries: number;
  todayEarnings: number;
  activeOrders: number;
  rating: number;
  totalDeliveries: number;
  completionRate: number;
}

const DeliveryDashboardScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [activeOrders, setActiveOrders] = useState<DeliveryOrder[]>([]);
  const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
  const [stats, setStats] = useState<DeliveryStats>({
    todayDeliveries: 0,
    todayEarnings: 0,
    activeOrders: 0,
    rating: 4.8,
    totalDeliveries: 0,
    completionRate: 95.2,
  });

  useEffect(() => {
    loadDashboardData();
  }, [user.uid]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadActiveOrders(),
        loadAvailableOrders(),
        loadDeliveryStats(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveOrders = async () => {
    try {
      const q = query(
        collection(FIREBASE_DB, 'orders'),
        where('deliveryId', '==', user.uid),
        where('status', 'in', ['picked_up', 'on_the_way']),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders: DeliveryOrder[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          orders.push({
            id: doc.id,
            orderNumber: `#${doc.id.slice(-6).toUpperCase()}`,
            customerName: data.customerName || 'Customer',
            customerPhone: data.customerPhone || '',
            restaurantName: data.restaurantName || 'Restaurant',
            restaurantAddress: data.restaurantAddress || '',
            deliveryAddress: data.deliveryAddress || {},
            totalAmount: data.pricing?.total || 0,
            deliveryFee: data.pricing?.deliveryFee || 0,
            status: data.status,
            estimatedTime: data.estimatedDeliveryTime || '30 min',
            distance: data.deliveryDistance || '2.5 km',
            deliveryInstructions: data.deliveryInstructions,
            createdAt: data.createdAt,
          });
        });
        setActiveOrders(orders);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading active orders:', error);
      setActiveOrders([]);
    }
  };

  const loadAvailableOrders = async () => {
    try {
      const q = query(
        collection(FIREBASE_DB, 'orders'),
        where('status', '==', 'ready_for_pickup'),
        where('deliveryId', '==', null),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders: DeliveryOrder[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          orders.push({
            id: doc.id,
            orderNumber: `#${doc.id.slice(-6).toUpperCase()}`,
            customerName: data.customerName || 'Customer',
            customerPhone: data.customerPhone || '',
            restaurantName: data.restaurantName || 'Restaurant',
            restaurantAddress: data.restaurantAddress || '',
            deliveryAddress: data.deliveryAddress || {},
            totalAmount: data.pricing?.total || 0,
            deliveryFee: data.pricing?.deliveryFee || 0,
            status: data.status,
            estimatedTime: data.estimatedDeliveryTime || '30 min',
            distance: data.deliveryDistance || '2.5 km',
            deliveryInstructions: data.deliveryInstructions,
            createdAt: data.createdAt,
          });
        });
        setAvailableOrders(orders);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading available orders:', error);
      setAvailableOrders([]);
    }
  };

  const loadDeliveryStats = async () => {
    // In a real app, this would fetch actual stats from Firestore
    // For now, using mock data
    const mockStats: DeliveryStats = {
      todayDeliveries: 8,
      todayEarnings: 2450.00,
      activeOrders: activeOrders.length,
      rating: 4.8,
      totalDeliveries: 234,
      completionRate: 95.2,
    };
    setStats(mockStats);
  };

  const toggleOnlineStatus = async (value: boolean) => {
    try {
      setIsOnline(value);
      // Update delivery partner status in Firestore
      await updateDoc(doc(FIREBASE_DB, 'deliverys', user.uid), {
        isOnline: value,
        lastSeen: new Date(),
      });
    } catch (error) {
      console.error('Error updating online status:', error);
      Alert.alert('Error', 'Failed to update status');
      setIsOnline(!value); // Revert on error
    }
  };

  const acceptOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(FIREBASE_DB, 'orders', orderId), {
        deliveryId: user.uid,
        status: 'picked_up',
        pickedUpAt: new Date(),
      });
      Alert.alert('Success', 'Order accepted! Head to the restaurant to pick it up.');
    } catch (error) {
      console.error('Error accepting order:', error);
      Alert.alert('Error', 'Failed to accept order');
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === 'on_the_way') {
        updateData.pickedUpAt = new Date();
      } else if (newStatus === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      await updateDoc(doc(FIREBASE_DB, 'orders', orderId), updateData);
      Alert.alert('Success', 'Order status updated successfully!');
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const renderStatsCard = (title: string, value: string, icon: string, color: string) => (
    <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.statsContent}>
        <Text style={[styles.statsValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>{title}</Text>
      </View>
    </View>
  );

  const renderActiveOrder = (order: DeliveryOrder) => (
    <View key={order.id} style={[styles.orderCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={[styles.orderNumber, { color: theme.text }]}>{order.orderNumber}</Text>
          <Text style={[styles.customerName, { color: theme.textSecondary }]}>{order.customerName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: theme.warning }]}>
          <Text style={styles.statusText}>
            {order.status === 'picked_up' ? 'Picked Up' : 'On The Way'}
          </Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.addressContainer}>
          <Ionicons name="restaurant" size={16} color={theme.primary} />
          <Text style={[styles.addressText, { color: theme.textSecondary }]} numberOfLines={1}>
            From: {order.restaurantName}
          </Text>
        </View>
        <View style={styles.addressContainer}>
          <Ionicons name="location" size={16} color={theme.success} />
          <Text style={[styles.addressText, { color: theme.textSecondary }]} numberOfLines={1}>
            To: {order.deliveryAddress.street}
          </Text>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <View style={styles.orderMeta}>
          <Text style={[styles.distance, { color: theme.primary }]}>{order.distance}</Text>
          <Text style={[styles.earnings, { color: theme.success }]}>{formatPrice(order.deliveryFee)}</Text>
        </View>
        
        <View style={styles.orderActions}>
          {order.status === 'picked_up' && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.warning }]}
              onPress={() => updateOrderStatus(order.id, 'on_the_way')}
            >
              <Text style={styles.actionButtonText}>On The Way</Text>
            </TouchableOpacity>
          )}
          {order.status === 'on_the_way' && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.success }]}
              onPress={() => updateOrderStatus(order.id, 'delivered')}
            >
              <Text style={styles.actionButtonText}>Mark Delivered</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const renderAvailableOrder = (order: DeliveryOrder) => (
    <View key={order.id} style={[styles.orderCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={[styles.orderNumber, { color: theme.text }]}>{order.orderNumber}</Text>
          <Text style={[styles.customerName, { color: theme.textSecondary }]}>{order.restaurantName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: theme.info }]}>
          <Text style={styles.statusText}>Available</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.addressContainer}>
          <Ionicons name="location" size={16} color={theme.primary} />
          <Text style={[styles.addressText, { color: theme.textSecondary }]} numberOfLines={1}>
            {order.deliveryAddress.street}, {order.deliveryAddress.city}
          </Text>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <View style={styles.orderMeta}>
          <Text style={[styles.distance, { color: theme.primary }]}>{order.distance}</Text>
          <Text style={[styles.earnings, { color: theme.success }]}>{formatPrice(order.deliveryFee)}</Text>
          <Text style={[styles.time, { color: theme.textMuted }]}>{order.estimatedTime}</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.acceptButton, { backgroundColor: theme.primary }]}
          onPress={() => acceptOrder(order.id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading dashboard...</Text>
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
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>Welcome back, {user.displayName || 'Partner'}!</Text>
          </View>
          
          <View style={styles.onlineToggleContainer}>
            <Text style={[styles.onlineLabel, { color: isOnline ? '#10B981' : '#EF4444' }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={toggleOnlineStatus}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor={isOnline ? '#fff' : '#9CA3AF'}
            />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
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
        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          {renderStatsCard('Today\'s Deliveries', stats.todayDeliveries.toString(), 'bicycle', theme.primary)}
          {renderStatsCard('Today\'s Earnings', formatPrice(stats.todayEarnings), 'wallet', theme.success)}
          {renderStatsCard('Rating', stats.rating.toFixed(1), 'star', theme.warning)}
          {renderStatsCard('Completion Rate', `${stats.completionRate}%`, 'checkmark-circle', theme.info)}
        </View>

        {/* Active Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Deliveries</Text>
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text style={styles.badgeText}>{activeOrders.length}</Text>
            </View>
          </View>
          
          {activeOrders.length > 0 ? (
            activeOrders.map(renderActiveOrder)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="bicycle-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.text }]}>No active deliveries</Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Turn on your status to receive delivery requests
              </Text>
            </View>
          )}
        </View>

        {/* Available Orders */}
        {isOnline && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Available Orders</Text>
              <View style={[styles.badge, { backgroundColor: theme.success }]}>
                <Text style={styles.badgeText}>{availableOrders.length}</Text>
              </View>
            </View>
            
            {availableOrders.length > 0 ? (
              availableOrders.map(renderAvailableOrder)
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={48} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.text }]}>No orders available</Text>
                <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                  New delivery requests will appear here
                </Text>
              </View>
            )}
          </View>
        )}
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
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
  onlineToggleContainer: {
    alignItems: 'center',
  },
  onlineLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  statsCard: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statsContent: {
    flex: 1,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distance: {
    fontSize: 14,
    fontWeight: '600',
  },
  earnings: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  time: {
    fontSize: 12,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default DeliveryDashboardScreen;