import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Animated,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  getDocs,
  limit,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

const { width: screenWidth } = Dimensions.get('window');

// Enhanced interfaces with real data structure
interface OrderItem {
  id?: string;
  name?: string;
  quantity?: number;
  price?: number;
  subtotal?: number;
  specialInstructions?: string;
}

interface OrderPricing {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  pricing: OrderPricing;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  estimatedDeliveryTime?: string;
  createdAt: any;
  updatedAt: any;
  confirmedAt?: any;
  readyAt?: any;
  deliveredAt?: any;
  customerName?: string;
  customerPhone?: string;
  deliveryInstructions?: string;
}

interface RestaurantInfo {
  name: string;
  description: string;
  cuisine: string[];
  phone: string;
  email: string;
  address: string;
  rating: number;
  totalReviews: number;
  isActive: boolean;
  autoAcceptOrders: boolean;
  notificationsEnabled: boolean;
}

interface Analytics {
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  dailyOrders: number;
  weeklyOrders: number;
  monthlyOrders: number;
  avgOrderValue: number;
  completionRate: number;
  pendingOrders: number;
  popularItems: Array<{
    name: string;
    orders: number;
  }>;
  todayStats: {
    newOrders: number;
    completedOrders: number;
    revenue: number;
  };
}

const RestaurantDashboardScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode } = useTheme();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'orders'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Real data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    dailyRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    dailyOrders: 0,
    weeklyOrders: 0,
    monthlyOrders: 0,
    avgOrderValue: 0,
    completionRate: 0,
    pendingOrders: 0,
    popularItems: [],
    todayStats: {
      newOrders: 0,
      completedOrders: 0,
      revenue: 0,
    }
  });
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo>({
    name: 'My Restaurant',
    description: '',
    cuisine: [],
    phone: '',
    email: '',
    address: '',
    rating: 4.5,
    totalReviews: 0,
    isActive: false,
    autoAcceptOrders: false,
    notificationsEnabled: true,
  });

  // Calculate analytics from orders
  const calculateAnalytics = (ordersList: Order[]): Analytics => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - (now.getDay() * 24 * 60 * 60 * 1000));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Helper function to check if date is in range
    const isInRange = (orderDate: any, startDate: Date) => {
      let date: Date;
      if (orderDate?.toDate) {
        date = orderDate.toDate();
      } else if (orderDate?.seconds) {
        date = new Date(orderDate.seconds * 1000);
      } else if (orderDate instanceof Date) {
        date = orderDate;
      } else {
        return false;
      }
      return date >= startDate;
    };

    // Filter orders by timeframes
    const todayOrders = ordersList.filter(o => isInRange(o.createdAt, startOfToday));
    const weekOrders = ordersList.filter(o => isInRange(o.createdAt, startOfWeek));
    const monthOrders = ordersList.filter(o => isInRange(o.createdAt, startOfMonth));

    // Calculate revenue for completed orders
    const calculateRevenue = (orders: Order[]) => 
      orders.filter(o => o.status === 'delivered' && o.paymentStatus === 'paid')
            .reduce((sum, o) => sum + (o.pricing?.total || 0), 0);

    // Calculate popular items
    const itemCounts = new Map<string, number>();
    ordersList.filter(o => o.status === 'delivered').forEach(order => {
      order.items?.forEach(item => {
        const count = itemCounts.get(item.name || '') || 0;
        itemCounts.set(item.name || '', count + (item.quantity || 1));
      });
    });
    
    const popularItems = Array.from(itemCounts.entries())
      .map(([name, orders]) => ({ name, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 3);

    // Calculate completion rate
    const completedToday = todayOrders.filter(o => o.status === 'delivered').length;
    const totalToday = todayOrders.length;
    const completionRate = totalToday > 0 ? (completedToday / totalToday) * 100 : 0;

    // Average order value
    const completedOrders = ordersList.filter(o => o.status === 'delivered' && o.pricing?.total);
    const avgOrderValue = completedOrders.length > 0 
      ? completedOrders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0) / completedOrders.length
      : 0;

    return {
      dailyRevenue: calculateRevenue(todayOrders),
      weeklyRevenue: calculateRevenue(weekOrders),
      monthlyRevenue: calculateRevenue(monthOrders),
      dailyOrders: todayOrders.length,
      weeklyOrders: weekOrders.length,
      monthlyOrders: monthOrders.length,
      avgOrderValue,
      completionRate,
      pendingOrders: ordersList.filter(o => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length,
      popularItems,
      todayStats: {
        newOrders: todayOrders.filter(o => o.status === 'pending').length,
        completedOrders: completedToday,
        revenue: calculateRevenue(todayOrders),
      }
    };
  };

  // Load restaurant info
  const loadRestaurantInfo = async () => {
    if (!user?.uid) return;

    try {
      const docRef = doc(FIREBASE_DB, 'restaurants', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as RestaurantInfo;
        setRestaurantInfo({
          ...data,
          autoAcceptOrders: data.autoAcceptOrders ?? false,
          notificationsEnabled: data.notificationsEnabled ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading restaurant info:', error);
    }
  };

  // Real-time orders listener
  useEffect(() => {
    if (!user?.uid) return;

    const ordersRef = collection(FIREBASE_DB, 'orders');
    const ordersQuery = query(
      ordersRef,
      where('restaurantId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const ordersList: Order[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        ordersList.push({
          id: doc.id,
          orderNumber: data.orderNumber || `#${doc.id.slice(-6).toUpperCase()}`,
          userId: data.userId || '',
          userEmail: data.userEmail || '',
          restaurantId: data.restaurantId || '',
          restaurantName: data.restaurantName || '',
          items: data.items || [],
          pricing: data.pricing || {
            subtotal: 0,
            serviceCharge: 0,
            tax: 0,
            deliveryFee: 0,
            total: 0,
          },
          status: data.status || 'pending',
          paymentStatus: data.paymentStatus || 'pending',
          estimatedDeliveryTime: data.estimatedDeliveryTime || '30-45 min',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          confirmedAt: data.confirmedAt,
          readyAt: data.readyAt,
          deliveredAt: data.deliveredAt,
          customerName: data.customerName || data.userEmail?.split('@')[0] || 'Unknown Customer',
          customerPhone: data.customerPhone || '',
          deliveryInstructions: data.deliveryInstructions || '',
        } as Order);
      });

      setOrders(ordersList);
      setRecentOrders(ordersList.slice(0, 10));
      
      // Calculate analytics
      const calculatedAnalytics = calculateAnalytics(ordersList);
      setAnalytics(calculatedAnalytics);
      
      setLoading(false);
    }, (error) => {
      console.error('Error listening to orders:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Load restaurant info on mount
  useEffect(() => {
    loadRestaurantData();
  }, [user?.uid]);

  const loadRestaurantData = async () => {
    setLoading(true);
    await loadRestaurantInfo();
    setLoading(false);
  };

  // Pulse animation for offline status
  useEffect(() => {
    if (!restaurantInfo.isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [restaurantInfo.isActive, pulseAnim]);

  // Toggle restaurant status
  const toggleOnlineStatus = async () => {
    const newStatus = !restaurantInfo.isActive;
    
    Alert.alert(
      newStatus ? 'Open Restaurant' : 'Close Restaurant',
      newStatus 
        ? 'This will start accepting new orders again.' 
        : 'This will stop accepting new orders. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus ? 'Open' : 'Close',
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const docRef = doc(FIREBASE_DB, 'restaurants', user.uid);
              await updateDoc(docRef, {
                isActive: newStatus,
                updatedAt: serverTimestamp(),
              });
              
              setRestaurantInfo(prev => ({ ...prev, isActive: newStatus }));
            } catch (error) {
              console.error('Error updating restaurant status:', error);
              Alert.alert('Error', 'Failed to update restaurant status');
            }
          },
        },
      ]
    );
  };

  // Update order status
  const handleStatusUpdate = async (orderId: string, newStatus: Order['status']) => {
    try {
      const orderRef = doc(FIREBASE_DB, 'orders', orderId);
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      // Add timestamp for specific status changes
      switch (newStatus) {
        case 'confirmed':
          updateData.confirmedAt = serverTimestamp();
          break;
        case 'ready':
          updateData.readyAt = serverTimestamp();
          break;
        case 'delivered':
          updateData.deliveredAt = serverTimestamp();
          break;
      }

      await updateDoc(orderRef, updateData);
      
      Alert.alert('Success', `Order updated to ${getStatusText(newStatus)}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  // Get status color and text
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#3B82F6';
      case 'preparing': return '#8B5CF6';
      case 'ready': return '#10B981';
      case 'out_for_delivery': return '#06B6D4';
      case 'delivered': return '#059669';
      case 'cancelled': return '#EF4444';
      default: return theme.textMuted;
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'New Order';
      case 'confirmed': return 'Confirmed';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  // Format time ago
  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    
    try {
      const now = new Date();
      let orderTime: Date;
      
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        orderTime = timestamp.toDate();
      } else if (timestamp.seconds) {
        orderTime = new Date(timestamp.seconds * 1000);
      } else {
        return 'Unknown time';
      }
      
      const diffInMinutes = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    } catch (error) {
      return 'Unknown time';
    }
  };

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadRestaurantData();
    setRefreshing(false);
  };

  // Enhanced analytics card component
  const renderAnalyticsCard = (title: string, value: string, subtitle: string, icon: string, color: string, trend?: string) => (
    <View style={[styles.analyticsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={styles.analyticsHeader}>
        <View style={[styles.analyticsIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.analyticsContent}>
          <Text style={[styles.analyticsValue, { color: theme.text }]}>{value}</Text>
          <Text style={[styles.analyticsTitle, { color: theme.textSecondary }]}>{title}</Text>
        </View>
      </View>
      <Text style={[styles.analyticsSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      {trend && (
        <View style={[styles.trendContainer, { backgroundColor: color + '15' }]}>
          <Ionicons name="trending-up" size={12} color={color} />
          <Text style={[styles.trendText, { color }]}>{trend}</Text>
        </View>
      )}
    </View>
  );

  // Enhanced order card component
  const renderOrderCard = ({ item }: { item: Order }) => {
    const isPending = item.status === 'pending';
    
    return (
      <View style={[
        styles.orderCard, 
        { 
          backgroundColor: theme.surface, 
          shadowColor: theme.shadow,
          borderLeftWidth: isPending ? 4 : 0,
          borderLeftColor: isPending ? '#F59E0B' : 'transparent'
        }
      ]}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <View style={styles.orderTitleRow}>
              <Text style={[styles.orderNumber, { color: theme.text }]}>{item.orderNumber}</Text>
              {isPending && (
                <View style={[styles.newOrderBadge, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.newOrderText}>NEW</Text>
                </View>
              )}
            </View>
            <Text style={[styles.customerName, { color: theme.textSecondary }]}>{item.customerName}</Text>
            <Text style={[styles.orderTime, { color: theme.textMuted }]}>{getTimeAgo(item.createdAt)}</Text>
          </View>
          <View style={styles.orderStatus}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
            </View>
            <Text style={[styles.orderAmount, { color: theme.primary }]}>
              {formatPrice(item.pricing?.total || 0)}
            </Text>
          </View>
        </View>

        <View style={styles.orderItems}>
          <Text style={[styles.itemsLabel, { color: theme.textSecondary }]}>
            {(item.items || []).length} item{((item.items || []).length > 1) ? 's' : ''}:
          </Text>
          <Text style={[styles.itemsList, { color: theme.text }]} numberOfLines={2}>
            {(item.items || []).map(orderItem => `${orderItem.quantity || 1}x ${orderItem.name || 'Unknown Item'}`).join(', ')}
          </Text>
        </View>

        {item.estimatedDeliveryTime && (
          <View style={[styles.estimatedTime, { backgroundColor: theme.info + '20' }]}>
            <Ionicons name="time-outline" size={16} color={theme.info} />
            <Text style={[styles.estimatedTimeText, { color: theme.info }]}>
              Est: {item.estimatedDeliveryTime}
            </Text>
          </View>
        )}

        {item.deliveryInstructions && (
          <View style={[styles.specialInstructions, { backgroundColor: theme.warning + '20' }]}>
            <Ionicons name="alert-circle" size={14} color={theme.warning} />
            <Text style={[styles.specialInstructionsText, { color: theme.warning }]}>
              {item.deliveryInstructions}
            </Text>
          </View>
        )}

        <View style={styles.orderActions}>
          {item.status === 'pending' && (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, styles.rejectButton, { backgroundColor: theme.error }]}
                onPress={() => {
                  Alert.alert(
                    'Reject Order',
                    'Are you sure you want to reject this order?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reject', style: 'destructive', onPress: () => handleStatusUpdate(item.id, 'cancelled') }
                    ]
                  );
                }}
              >
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.acceptButton, { backgroundColor: theme.success }]}
                onPress={() => handleStatusUpdate(item.id, 'confirmed')}
              >
                <Text style={styles.actionButtonText}>Accept</Text>
              </TouchableOpacity>
            </>
          )}
          {item.status === 'confirmed' && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.singleActionButton, { backgroundColor: theme.primary }]}
              onPress={() => handleStatusUpdate(item.id, 'preparing')}
            >
              <Text style={styles.actionButtonText}>Start Preparing</Text>
            </TouchableOpacity>
          )}
          {item.status === 'preparing' && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.singleActionButton, { backgroundColor: theme.success }]}
              onPress={() => handleStatusUpdate(item.id, 'ready')}
            >
              <Text style={styles.actionButtonText}>Mark Ready</Text>
            </TouchableOpacity>
          )}
          {item.status === 'ready' && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.singleActionButton, { backgroundColor: theme.info }]}
              onPress={() => handleStatusUpdate(item.id, 'out_for_delivery')}
            >
              <Text style={styles.actionButtonText}>Out for Delivery</Text>
            </TouchableOpacity>
          )}
          {item.status === 'out_for_delivery' && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.singleActionButton, { backgroundColor: theme.success }]}
              onPress={() => handleStatusUpdate(item.id, 'delivered')}
            >
              <Text style={styles.actionButtonText}>Mark Delivered</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderOverview = () => (
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
      {/* Enhanced Analytics Grid */}
      <View style={styles.analyticsGrid}>
        {renderAnalyticsCard(
          'Daily Revenue',
          formatPrice(analytics.dailyRevenue),
          `${analytics.dailyOrders} orders today`,
          'trending-up',
          '#10B981',
          analytics.weeklyRevenue > analytics.dailyRevenue * 7 ? '+12%' : undefined
        )}
        {renderAnalyticsCard(
          'Orders Today',
          analytics.dailyOrders.toString(),
          `${analytics.completionRate.toFixed(1)}% completion rate`,
          'receipt',
          '#3B82F6'
        )}
        {renderAnalyticsCard(
          'Avg Order Value',
          formatPrice(analytics.avgOrderValue),
          'From completed orders',
          'card',
          '#F59E0B'
        )}
        {renderAnalyticsCard(
          'Pending Orders',
          analytics.pendingOrders.toString(),
          'Require attention',
          'clock',
          '#EF4444'
        )}
      </View>

      {/* Quick Stats Row */}
      <View style={[styles.quickStatsContainer, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatNumber, { color: theme.success }]}>{analytics.todayStats.newOrders}</Text>
          <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>New Today</Text>
        </View>
        <View style={[styles.quickStatDivider, { backgroundColor: theme.border }]} />
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatNumber, { color: theme.primary }]}>{analytics.todayStats.completedOrders}</Text>
          <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>Completed</Text>
        </View>
        <View style={[styles.quickStatDivider, { backgroundColor: theme.border }]} />
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatNumber, { color: theme.warning }]}>{analytics.weeklyOrders}</Text>
          <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>This Week</Text>
        </View>
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Orders</Text>
          <TouchableOpacity onPress={() => setSelectedTab('orders')}>
            <Text style={[styles.seeAllText, { color: theme.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>
        {recentOrders.slice(0, 3).map((order) => (
          <View key={order.id}>
            {renderOrderCard({ item: order })}
          </View>
        ))}
      </View>

      {/* Popular Items */}
      {analytics.popularItems.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Popular Items Today</Text>
          <View style={[styles.popularItemsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            {analytics.popularItems.map((item, index) => (
              <View key={index} style={styles.popularItem}>
                <View style={[styles.popularRank, { backgroundColor: index === 0 ? '#F59E0B' : theme.primary }]}>
                  <Text style={styles.popularRankText}>{index + 1}</Text>
                </View>
                <View style={styles.popularItemInfo}>
                  <Text style={[styles.popularItemName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.popularItemOrders, { color: theme.textSecondary }]}>
                    {item.orders} orders
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Auto-Accept Notice */}
      {restaurantInfo.autoAcceptOrders && restaurantInfo.isActive && (
        <View style={[styles.autoAcceptNotice, { backgroundColor: theme.success + '20', borderColor: theme.success }]}>
          <Ionicons name="checkmark-circle" size={20} color={theme.success} />
          <Text style={[styles.autoAcceptText, { color: theme.success }]}>
            Auto-accept is enabled. New orders are automatically confirmed.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderOrders = () => (
    <FlatList
      data={recentOrders}
      renderItem={renderOrderCard}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.ordersList}
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
          <Ionicons name="receipt-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Orders Yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Orders will appear here when customers place them
          </Text>
        </View>
      }
    />
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Enhanced Header */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.restaurantInfo}>
            <Text style={styles.restaurantName}>{restaurantInfo.name}</Text>
            <Text style={styles.headerSubtitle}>
              {restaurantInfo.cuisine.slice(0, 2).join(' • ') || 'Restaurant Dashboard'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              {analytics.pendingOrders > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>{analytics.pendingOrders}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Enhanced Online Status Toggle */}
        <Animated.View style={[styles.statusContainer, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity 
            style={[
              styles.statusToggle, 
              { 
                backgroundColor: restaurantInfo.isActive ? '#10B981' : '#EF4444',
                shadowColor: restaurantInfo.isActive ? '#10B981' : '#EF4444',
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }
            ]}
            onPress={toggleOnlineStatus}
          >
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: '#fff' }]} />
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusText}>
                {restaurantInfo.isActive ? 'Online - Accepting Orders' : 'Offline - Closed'}
              </Text>
              {restaurantInfo.isActive && analytics.pendingOrders > 0 && (
                <Text style={styles.statusSubtext}>
                  {analytics.pendingOrders} pending order{analytics.pendingOrders > 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <Ionicons 
              name={restaurantInfo.isActive ? "checkmark-circle" : "close-circle"} 
              size={20} 
              color="#fff" 
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Revenue Summary */}
        <View style={[styles.revenueSummary, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Today</Text>
            <Text style={styles.revenueValue}>{formatPrice(analytics.dailyRevenue)}</Text>
          </View>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>This Week</Text>
            <Text style={styles.revenueValue}>{formatPrice(analytics.weeklyRevenue)}</Text>
          </View>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>This Month</Text>
            <Text style={styles.revenueValue}>{formatPrice(analytics.monthlyRevenue)}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Enhanced Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && { borderBottomColor: theme.primary }]}
          onPress={() => setSelectedTab('overview')}
        >
          <Ionicons 
            name="analytics-outline" 
            size={18} 
            color={selectedTab === 'overview' ? theme.primary : theme.textSecondary}
          />
          <Text style={[
            styles.tabText,
            { color: selectedTab === 'overview' ? theme.primary : theme.textSecondary }
          ]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'orders' && { borderBottomColor: theme.primary }]}
          onPress={() => setSelectedTab('orders')}
        >
          <Ionicons 
            name="receipt-outline" 
            size={18} 
            color={selectedTab === 'orders' ? theme.primary : theme.textSecondary}
          />
          <Text style={[
            styles.tabText,
            { color: selectedTab === 'orders' ? theme.primary : theme.textSecondary }
          ]}>
            Orders ({recentOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length})
          </Text>
          {analytics.pendingOrders > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.tabBadgeText}>{analytics.pendingOrders}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {selectedTab === 'overview' ? renderOverview() : renderOrders()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  statusIndicator: {
    marginRight: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusSubtext: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  revenueSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 10,
  },
  revenueItem: {
    alignItems: 'center',
  },
  revenueLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 4,
  },
  revenueValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 12,
  },
  analyticsCard: {
    width: (screenWidth - 64) / 2,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  analyticsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  analyticsContent: {
    flex: 1,
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  analyticsTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  analyticsSubtitle: {
    fontSize: 11,
    marginBottom: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  quickStatDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ordersList: {
    padding: 20,
    paddingBottom: 100,
  },
  orderCard: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
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
  orderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  newOrderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  newOrderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  customerName: {
    fontSize: 14,
    marginBottom: 2,
  },
  orderTime: {
    fontSize: 12,
  },
  orderStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusTextBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderItems: {
    marginBottom: 12,
  },
  itemsLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  itemsList: {
    fontSize: 14,
    lineHeight: 18,
  },
  estimatedTime: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  estimatedTimeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  specialInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    borderRadius: 8,
  },
  specialInstructionsText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
    fontStyle: 'italic',
  },
  orderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  singleActionButton: {
    flex: 1,
  },
  acceptButton: {},
  rejectButton: {},
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  popularItemsCard: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  popularItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  popularRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  popularRankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  popularItemInfo: {
    flex: 1,
  },
  popularItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  popularItemOrders: {
    fontSize: 12,
  },
  autoAcceptNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  autoAcceptText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
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
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default RestaurantDashboardScreen;