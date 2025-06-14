import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

const { width: screenWidth } = Dimensions.get('window');

interface AdminStats {
  totalRestaurants: number;
  activeRestaurants: number;
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  totalMenuItems: number;
  pendingOrders: number;
  completedOrders: number;
  averageOrderValue: number;
  topRestaurants: Array<{
    id: string;
    name: string;
    orders: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'restaurant_signup' | 'order_placed' | 'menu_item_added';
    description: string;
    timestamp: any;
    restaurantName?: string;
  }>;
}

interface SystemMetrics {
  uptime: string;
  responseTime: number;
  errorRate: number;
  activeUsers: number;
}

const AdminDashboardScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalRestaurants: 0,
    activeRestaurants: 0,
    totalOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    totalMenuItems: 0,
    pendingOrders: 0,
    completedOrders: 0,
    averageOrderValue: 0,
    topRestaurants: [],
    recentActivity: [],
  });
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    uptime: '99.9%',
    responseTime: 156,
    errorRate: 0.02,
    activeUsers: 0,
  });

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRestaurantStats(),
        loadOrderStats(),
        loadMenuStats(),
        loadRecentActivity(),
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRestaurantStats = async () => {
    try {
      const restaurantsSnapshot = await getDocs(collection(FIREBASE_DB, 'restaurants'));
      const totalRestaurants = restaurantsSnapshot.size;
      const activeRestaurants = restaurantsSnapshot.docs.filter(doc => 
        doc.data().isActive === true
      ).length;

      setAdminStats(prev => ({
        ...prev,
        totalRestaurants,
        activeRestaurants,
      }));
    } catch (error) {
      console.error('Error loading restaurant stats:', error);
    }
  };

  interface Order {
    id: string;
    createdAt?: any;
    status?: string;
    pricing?: { total?: number };
    restaurantId?: string;
    restaurantName?: string;
    [key: string]: any;
  }

  const loadOrderStats = async () => {
    try {
      const ordersSnapshot = await getDocs(collection(FIREBASE_DB, 'orders'));
      const orders: Order[] = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const todayOrders = orders.filter(order => {
        if (!order.createdAt) return false;
        let orderDate: Date;
        
        if (order.createdAt instanceof Timestamp) {
          orderDate = order.createdAt.toDate();
        } else if (order.createdAt.toDate) {
          orderDate = order.createdAt.toDate();
        } else if (order.createdAt.seconds) {
          orderDate = new Date(order.createdAt.seconds * 1000);
        } else {
          return false;
        }
        
        return orderDate >= startOfToday;
      });

      const completedOrders = orders.filter(order => order.status === 'delivered');
      const pendingOrders = orders.filter(order => 
        typeof order.status === 'string' &&
        ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)
      );

      const totalRevenue = completedOrders.reduce((sum, order) => 
        sum + (order.pricing?.total || 0), 0
      );
      
      const todayRevenue = todayOrders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + (order.pricing?.total || 0), 0);

      const averageOrderValue = completedOrders.length > 0 
        ? totalRevenue / completedOrders.length 
        : 0;

      // Calculate top restaurants
      const restaurantStats = new Map();
      completedOrders.forEach(order => {
        const restaurantId = order.restaurantId;
        const current = restaurantStats.get(restaurantId) || {
          orders: 0,
          revenue: 0,
          name: order.restaurantName || 'Unknown'
        };
        current.orders += 1;
        current.revenue += order.pricing?.total || 0;
        restaurantStats.set(restaurantId, current);
      });

      const topRestaurants = Array.from(restaurantStats.entries())
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setAdminStats(prev => ({
        ...prev,
        totalOrders: orders.length,
        todayOrders: todayOrders.length,
        totalRevenue,
        todayRevenue,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        averageOrderValue,
        topRestaurants,
      }));
    } catch (error) {
      console.error('Error loading order stats:', error);
    }
  };

  const loadMenuStats = async () => {
    try {
      const menuItemsSnapshot = await getDocs(collection(FIREBASE_DB, 'menuItems'));
      setAdminStats(prev => ({
        ...prev,
        totalMenuItems: menuItemsSnapshot.size,
      }));
    } catch (error) {
      console.error('Error loading menu stats:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      // Get recent orders
      const ordersQuery = query(
        collection(FIREBASE_DB, 'orders'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      const recentActivity = ordersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'order_placed' as const,
          description: `New order ${data.orderNumber || `#${doc.id.slice(-6).toUpperCase()}`} placed`,
          timestamp: data.createdAt,
          restaurantName: data.restaurantName,
        };
      });

      setAdminStats(prev => ({
        ...prev,
        recentActivity,
      }));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    
    try {
      const now = new Date();
      let activityTime: Date;
      
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        activityTime = timestamp.toDate();
      } else if (timestamp.seconds) {
        activityTime = new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        activityTime = timestamp;
      } else {
        return 'Unknown time';
      }
      
      const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    } catch (error) {
      return 'Unknown time';
    }
  };

  const renderStatsCard = (
    title: string,
    value: string,
    subtitle: string,
    icon: string,
    color: string,
    trend?: { value: string; isPositive: boolean }
  ) => (
    <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={styles.statsHeader}>
        <View style={[styles.statsIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        {trend && (
          <View style={[styles.trendContainer, { backgroundColor: trend.isPositive ? '#10B981' : '#EF4444' }]}>
            <Ionicons 
              name={trend.isPositive ? "trending-up" : "trending-down"} 
              size={12} 
              color="#fff" 
            />
            <Text style={styles.trendValue}>{trend.value}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.statsValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.statsSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
    </View>
  );

  const renderQuickAction = (title: string, icon: string, color: string, onPress: () => void) => (
    <TouchableOpacity 
      style={[styles.quickActionCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={28} color={color} />
      </View>
      <Text style={[styles.quickActionTitle, { color: theme.text }]}>{title}</Text>
    </TouchableOpacity>
  );

  const renderSystemMetric = (label: string, value: string, color: string) => (
    <View style={styles.systemMetricItem}>
      <Text style={[styles.systemMetricLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.systemMetricValue, { color }]}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading admin dashboard...</Text>
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
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <Text style={styles.headerSubtitle}>Manage your food delivery platform</Text>
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
        {/* Overview Stats */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Platform Overview</Text>
          <View style={styles.statsGrid}>
            {renderStatsCard(
              'Total Revenue',
              formatPrice(adminStats.totalRevenue),
              `Today: ${formatPrice(adminStats.todayRevenue)}`,
              'wallet',
              '#10B981',
              { value: '+12.5%', isPositive: true }
            )}
            {renderStatsCard(
              'Total Orders',
              adminStats.totalOrders.toString(),
              `Today: ${adminStats.todayOrders}`,
              'receipt',
              '#3B82F6',
              { value: '+8.2%', isPositive: true }
            )}
            {renderStatsCard(
              'Active Restaurants',
              adminStats.activeRestaurants.toString(),
              `Total: ${adminStats.totalRestaurants}`,
              'restaurant',
              '#F59E0B',
              { value: '+2', isPositive: true }
            )}
            {renderStatsCard(
              'Pending Orders',
              adminStats.pendingOrders.toString(),
              'Require attention',
              'time',
              '#EF4444'
            )}
          </View>
        </View>

        {/* System Health */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>System Health</Text>
          <View style={[styles.systemHealthCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.systemMetricsGrid}>
              {renderSystemMetric('Uptime', systemMetrics.uptime, '#10B981')}
              {renderSystemMetric('Response Time', `${systemMetrics.responseTime}ms`, '#3B82F6')}
              {renderSystemMetric('Error Rate', `${systemMetrics.errorRate}%`, '#F59E0B')}
              {renderSystemMetric('Active Users', systemMetrics.activeUsers.toString(), '#8B5CF6')}
            </View>
          </View>
        </View>

        {/* Top Restaurants */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Performing Restaurants</Text>
          <View style={[styles.topRestaurantsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            {adminStats.topRestaurants.map((restaurant, index) => (
              <View key={restaurant.id} style={styles.restaurantRow}>
                <View style={styles.restaurantRank}>
                  <View style={[styles.rankBadge, { backgroundColor: index === 0 ? '#F59E0B' : theme.primary }]}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                </View>
                <View style={styles.restaurantInfo}>
                  <Text style={[styles.restaurantName, { color: theme.text }]}>{restaurant.name}</Text>
                  <Text style={[styles.restaurantStats, { color: theme.textSecondary }]}>
                    {restaurant.orders} orders
                  </Text>
                </View>
                <View style={styles.restaurantRevenue}>
                  <Text style={[styles.revenueAmount, { color: theme.primary }]}>
                    {formatPrice(restaurant.revenue)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
          <View style={[styles.activityCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            {adminStats.recentActivity.slice(0, 8).map((activity, index) => (
              <View key={activity.id} style={[styles.activityItem, { borderBottomColor: theme.separator }]}>
                <View style={[styles.activityIcon, { backgroundColor: theme.primary + '20' }]}>
                  <Ionicons name="receipt" size={16} color={theme.primary} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityDescription, { color: theme.text }]}>
                    {activity.description}
                  </Text>
                  {activity.restaurantName && (
                    <Text style={[styles.activityRestaurant, { color: theme.textSecondary }]}>
                      at {activity.restaurantName}
                    </Text>
                  )}
                </View>
                <Text style={[styles.activityTime, { color: theme.textMuted }]}>
                  {getTimeAgo(activity.timestamp)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Performance Summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Performance Summary</Text>
          <View style={[styles.performanceCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.performanceRow}>
              <Text style={[styles.performanceLabel, { color: theme.textSecondary }]}>Average Order Value</Text>
              <Text style={[styles.performanceValue, { color: theme.primary }]}>
                {formatPrice(adminStats.averageOrderValue)}
              </Text>
            </View>
            <View style={styles.performanceRow}>
              <Text style={[styles.performanceLabel, { color: theme.textSecondary }]}>Completion Rate</Text>
              <Text style={[styles.performanceValue, { color: theme.success }]}>
                {adminStats.totalOrders > 0 
                  ? ((adminStats.completedOrders / adminStats.totalOrders) * 100).toFixed(1)
                  : '0'
                }%
              </Text>
            </View>
            <View style={styles.performanceRow}>
              <Text style={[styles.performanceLabel, { color: theme.textSecondary }]}>Menu Items</Text>
              <Text style={[styles.performanceValue, { color: theme.text }]}>
                {adminStats.totalMenuItems}
              </Text>
            </View>
          </View>
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
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsCard: {
    width: (screenWidth - 64) / 2,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 2,
  },
  trendValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  statsSubtitle: {
    fontSize: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: (screenWidth - 64) / 2,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  systemHealthCard: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  systemMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  systemMetricItem: {
    alignItems: 'center',
  },
  systemMetricLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  systemMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  topRestaurantsCard: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  restaurantRank: {
    marginRight: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  restaurantStats: {
    fontSize: 12,
  },
  restaurantRevenue: {
    alignItems: 'flex-end',
  },
  revenueAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  activityCard: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityRestaurant: {
    fontSize: 12,
  },
  activityTime: {
    fontSize: 12,
  },
  performanceCard: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  performanceLabel: {
    fontSize: 14,
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AdminDashboardScreen;