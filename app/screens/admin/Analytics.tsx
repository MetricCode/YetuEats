import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
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
  getDocs, 
  limit,
  Timestamp,
} from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

const { width: screenWidth } = Dimensions.get('window');

interface PlatformAnalytics {
  totalRevenue: number;
  totalOrders: number;
  totalRestaurants: number;
  totalCustomers: number;
  averageOrderValue: number;
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  dailyOrders: number;
  weeklyOrders: number;
  monthlyOrders: number;
  growthRate: {
    revenue: number;
    orders: number;
    restaurants: number;
  };
  topPerformingCuisines: Array<{
    name: string;
    orders: number;
    revenue: number;
    restaurants: number;
  }>;
  revenueByTimeOfDay: Array<{
    hour: number;
    revenue: number;
    orders: number;
  }>;
  customerRetention: {
    newCustomers: number;
    returningCustomers: number;
    retentionRate: number;
  };
  orderStatusDistribution: {
    pending: number;
    confirmed: number;
    preparing: number;
    ready: number;
    delivered: number;
    cancelled: number;
  };
  geographicDistribution: Array<{
    region: string;
    orders: number;
    revenue: number;
    restaurants: number;
  }>;
}

type TimeFilter = 'today' | 'week' | 'month' | 'year';

const AdminAnalyticsScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilter>('month');
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedTimeFilter]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadOrderAnalytics(),
        loadRestaurantAnalytics(),
        loadCustomerAnalytics(),
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (selectedTimeFilter) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        };
      case 'week':
        const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekStart, end: today };
      case 'month':
        const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start: monthStart, end: today };
      case 'year':
        const yearStart = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        return { start: yearStart, end: today };
    }
  };

  // Define the type for an order document
  interface Order {
    id: string;
    createdAt?: Timestamp | { seconds: number; toDate?: () => Date };
    status?: string;
    pricing?: { total?: number };
    restaurantId?: string;
    [key: string]: any; // fallback for any extra fields
  }

  const loadOrderAnalytics = async () => {
    try {
      const ordersSnapshot = await getDocs(collection(FIREBASE_DB, 'orders'));
      const orders: Order[] = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const { start, end } = getDateRange();
      
      // Filter orders by date range
      const filteredOrders = orders.filter(order => {
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
        
        return orderDate >= start && orderDate <= end;
      });

      // Calculate metrics
      const totalOrders = filteredOrders.length;
      const completedOrders = filteredOrders.filter(o => o.status === 'delivered');
      const totalRevenue = completedOrders.reduce((sum, order) => 
        sum + (order.pricing?.total || 0), 0);
      const averageOrderValue = completedOrders.length > 0 
        ? totalRevenue / completedOrders.length : 0;

      // Order status distribution
      const orderStatusDistribution = {
        pending: filteredOrders.filter(o => o.status === 'pending').length,
        confirmed: filteredOrders.filter(o => o.status === 'confirmed').length,
        preparing: filteredOrders.filter(o => o.status === 'preparing').length,
        ready: filteredOrders.filter(o => o.status === 'ready').length,
        delivered: filteredOrders.filter(o => o.status === 'delivered').length,
        cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
      };

      // Cuisine analysis
      const cuisineStats = new Map();
      completedOrders.forEach(order => {
        // Get restaurant cuisine from order or fetch separately
        const restaurantId = order.restaurantId;
        // For now, we'll simulate cuisine data
        const mockCuisines = ['Italian', 'Chinese', 'Indian', 'Mexican', 'Japanese'];
        const cuisine = mockCuisines[Math.floor(Math.random() * mockCuisines.length)];
        
        const existing = cuisineStats.get(cuisine) || { orders: 0, revenue: 0, restaurants: new Set() };
        existing.orders += 1;
        existing.revenue += order.pricing?.total || 0;
        existing.restaurants.add(restaurantId);
        cuisineStats.set(cuisine, existing);
      });

      const topPerformingCuisines = Array.from(cuisineStats.entries())
        .map(([name, stats]) => ({
          name,
          orders: stats.orders,
          revenue: stats.revenue,
          restaurants: stats.restaurants.size
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Revenue by time of day
      const hourlyStats = new Array(24).fill(0).map((_, hour) => ({
        hour,
        revenue: 0,
        orders: 0
      }));

      completedOrders.forEach(order => {
        if (order.createdAt) {
          let orderDate: Date;
          if (order.createdAt instanceof Timestamp) {
            orderDate = order.createdAt.toDate();
          } else if (order.createdAt.toDate) {
            orderDate = order.createdAt.toDate();
          } else if (order.createdAt.seconds) {
            orderDate = new Date(order.createdAt.seconds * 1000);
          } else {
            return;
          }
          
          const hour = orderDate.getHours();
          hourlyStats[hour].revenue += order.pricing?.total || 0;
          hourlyStats[hour].orders += 1;
        }
      });

      setAnalytics(prev => ({
        ...prev!,
        totalOrders,
        totalRevenue,
        averageOrderValue,
        orderStatusDistribution,
        topPerformingCuisines,
        revenueByTimeOfDay: hourlyStats,
      }));

    } catch (error) {
      console.error('Error loading order analytics:', error);
    }
  };

  const loadRestaurantAnalytics = async () => {
    try {
      const restaurantsSnapshot = await getDocs(collection(FIREBASE_DB, 'restaurants'));
      const totalRestaurants = restaurantsSnapshot.size;
      const activeRestaurants = restaurantsSnapshot.docs.filter(doc => 
        doc.data().isActive === true).length;

      // Geographic distribution (mock data for now)
      const geographicDistribution = [
        { region: 'Nairobi', orders: 450, revenue: 125000, restaurants: 25 },
        { region: 'Mombasa', orders: 320, revenue: 89000, restaurants: 18 },
        { region: 'Kisumu', orders: 180, revenue: 52000, restaurants: 12 },
        { region: 'Nakuru', orders: 150, revenue: 43000, restaurants: 10 },
        { region: 'Eldoret', orders: 120, revenue: 35000, restaurants: 8 },
      ];

      setAnalytics(prev => ({
        ...prev!,
        totalRestaurants,
        geographicDistribution,
      }));
    } catch (error) {
      console.error('Error loading restaurant analytics:', error);
    }
  };

  const loadCustomerAnalytics = async () => {
    try {
      const usersSnapshot = await getDocs(
        query(collection(FIREBASE_DB, 'users'), where('userType', '==', 'customer'))
      );
      const totalCustomers = usersSnapshot.size;

      // Mock customer retention data
      const customerRetention = {
        newCustomers: Math.floor(totalCustomers * 0.3),
        returningCustomers: Math.floor(totalCustomers * 0.7),
        retentionRate: 70,
      };

      // Mock growth rates
      const growthRate = {
        revenue: 12.5,
        orders: 8.2,
        restaurants: 15.7,
      };

      setAnalytics(prev => ({
        ...prev!,
        totalCustomers,
        customerRetention,
        growthRate,
      }));
    } catch (error) {
      console.error('Error loading customer analytics:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
    setRefreshing(false);
  };

  const renderTimeFilter = (filter: TimeFilter, label: string) => {
    const isSelected = selectedTimeFilter === filter;
    return (
      <TouchableOpacity
        key={filter}
        style={[
          styles.timeFilterButton,
          { 
            backgroundColor: isSelected ? theme.primary : theme.inputBackground,
            borderColor: isSelected ? theme.primary : 'transparent'
          }
        ]}
        onPress={() => setSelectedTimeFilter(filter)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.timeFilterText,
          { color: isSelected ? '#fff' : theme.textSecondary }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderMetricCard = (
    title: string,
    value: string,
    subtitle: string,
    icon: string,
    color: string,
    trend?: { value: string; isPositive: boolean }
  ) => (
    <View style={[styles.metricCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: color + '20' }]}>
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
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.metricSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
    </View>
  );

  const renderOrderStatusChart = () => {
    if (!analytics) return null;

    const { orderStatusDistribution } = analytics;
    const total = Object.values(orderStatusDistribution).reduce((sum, count) => sum + count, 0);
    
    const statusColors: Record<keyof typeof orderStatusDistribution, string> = {
      pending: '#F59E0B',
      confirmed: '#3B82F6',
      preparing: '#8B5CF6',
      ready: '#10B981',
      delivered: '#059669',
      cancelled: '#EF4444',
    };

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>Order Status Distribution</Text>
        <View style={styles.statusChart}>
          {Object.entries(orderStatusDistribution).map(([status, count]) => {
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
              <View key={status} style={styles.statusItem}>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusColors[status as keyof typeof orderStatusDistribution] }]} />
                  <Text style={[styles.statusLabel, { color: theme.text }]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>
                <View style={styles.statusValues}>
                  <Text style={[styles.statusCount, { color: theme.textSecondary }]}>{count}</Text>
                  <Text style={[styles.statusPercentage, { color: theme.textMuted }]}>
                    {percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderTopCuisines = () => {
    if (!analytics) return null;

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>Top Performing Cuisines</Text>
        {analytics.topPerformingCuisines.map((cuisine, index) => (
          <View key={cuisine.name} style={styles.cuisineItem}>
            <View style={styles.cuisineRank}>
              <View style={[styles.rankBadge, { backgroundColor: index === 0 ? '#F59E0B' : theme.primary }]}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
            </View>
            <View style={styles.cuisineInfo}>
              <Text style={[styles.cuisineName, { color: theme.text }]}>{cuisine.name}</Text>
              <Text style={[styles.cuisineStats, { color: theme.textSecondary }]}>
                {cuisine.orders} orders • {cuisine.restaurants} restaurants
              </Text>
            </View>
            <View style={styles.cuisineRevenue}>
              <Text style={[styles.revenueAmount, { color: theme.primary }]}>
                {formatPrice(cuisine.revenue)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderGeographicDistribution = () => {
    if (!analytics) return null;

    return (
      <View style={[styles.chartCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>Geographic Distribution</Text>
        {analytics.geographicDistribution.map((region, index) => (
          <View key={region.region} style={styles.regionItem}>
            <View style={styles.regionInfo}>
              <Text style={[styles.regionName, { color: theme.text }]}>{region.region}</Text>
              <Text style={[styles.regionStats, { color: theme.textSecondary }]}>
                {region.orders} orders • {region.restaurants} restaurants
              </Text>
            </View>
            <View style={styles.regionRevenue}>
              <Text style={[styles.revenueAmount, { color: theme.primary }]}>
                {formatPrice(region.revenue)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderCustomerRetention = () => {
    if (!analytics) return null;

    const { customerRetention } = analytics;
    
    return (
      <View style={[styles.chartCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>Customer Retention</Text>
        <View style={styles.retentionChart}>
          <View style={styles.retentionItem}>
            <View style={[styles.retentionIcon, { backgroundColor: '#10B981' + '20' }]}>
              <Ionicons name="person-add" size={20} color="#10B981" />
            </View>
            <View style={styles.retentionInfo}>
              <Text style={[styles.retentionNumber, { color: theme.text }]}>
                {customerRetention.newCustomers}
              </Text>
              <Text style={[styles.retentionLabel, { color: theme.textSecondary }]}>
                New Customers
              </Text>
            </View>
          </View>
          
          <View style={styles.retentionItem}>
            <View style={[styles.retentionIcon, { backgroundColor: '#3B82F6' + '20' }]}>
              <Ionicons name="people" size={20} color="#3B82F6" />
            </View>
            <View style={styles.retentionInfo}>
              <Text style={[styles.retentionNumber, { color: theme.text }]}>
                {customerRetention.returningCustomers}
              </Text>
              <Text style={[styles.retentionLabel, { color: theme.textSecondary }]}>
                Returning Customers
              </Text>
            </View>
          </View>
          
          <View style={styles.retentionItem}>
            <View style={[styles.retentionIcon, { backgroundColor: '#F59E0B' + '20' }]}>
              <Ionicons name="trending-up" size={20} color="#F59E0B" />
            </View>
            <View style={styles.retentionInfo}>
              <Text style={[styles.retentionNumber, { color: theme.text }]}>
                {customerRetention.retentionRate}%
              </Text>
              <Text style={[styles.retentionLabel, { color: theme.textSecondary }]}>
                Retention Rate
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading analytics...</Text>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={theme.primaryGradient as [string, string]}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Platform Analytics</Text>
          <Text style={styles.headerSubtitle}>Monitor platform performance</Text>
        </LinearGradient>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Analytics Data</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Analytics will appear when there's sufficient data
          </Text>
        </View>
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
        <Text style={styles.headerTitle}>Platform Analytics</Text>
        <Text style={styles.headerSubtitle}>Monitor platform performance</Text>
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
        {/* Time Filter */}
        <View style={styles.timeFilterContainer}>
          <Text style={[styles.filterLabel, { color: theme.text }]}>Time Period</Text>
          <View style={styles.timeFilterButtons}>
            {renderTimeFilter('today', 'Today')}
            {renderTimeFilter('week', 'Week')}
            {renderTimeFilter('month', 'Month')}
            {renderTimeFilter('year', 'Year')}
          </View>
        </View>

        {/* Main Metrics */}
        <View style={styles.metricsContainer}>
          {renderMetricCard(
            'Total Revenue',
            formatPrice(analytics.totalRevenue),
            `From ${analytics.totalOrders} orders`,
            'wallet',
            '#10B981',
            { value: `+${analytics.growthRate.revenue}%`, isPositive: true }
          )}
          {renderMetricCard(
            'Total Orders',
            analytics.totalOrders.toString(),
            `Avg value: ${formatPrice(analytics.averageOrderValue)}`,
            'receipt',
            '#3B82F6',
            { value: `+${analytics.growthRate.orders}%`, isPositive: true }
          )}
          {renderMetricCard(
            'Active Restaurants',
            analytics.totalRestaurants.toString(),
            'Restaurant partners',
            'restaurant',
            '#F59E0B',
            { value: `+${analytics.growthRate.restaurants}%`, isPositive: true }
          )}
          {renderMetricCard(
            'Total Customers',
            analytics.totalCustomers.toString(),
            `${analytics.customerRetention.retentionRate}% retention rate`,
            'people',
            '#8B5CF6'
          )}
        </View>

        {/* Order Status Distribution */}
        {renderOrderStatusChart()}

        {/* Top Performing Cuisines */}
        {renderTopCuisines()}

        {/* Customer Retention */}
        {renderCustomerRetention()}

        {/* Geographic Distribution */}
        {renderGeographicDistribution()}
      </ScrollView>
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
    fontWeight: '500',
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
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  timeFilterContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  timeFilterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  timeFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  timeFilterText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: (screenWidth - 64) / 2,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.02)',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  trendValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  metricSubtitle: {
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 16,
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.02)',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  statusChart: {
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 1,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  statusValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusCount: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  statusPercentage: {
    fontSize: 12,
    opacity: 0.7,
  },
  cuisineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  cuisineRank: {
    marginRight: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
  cuisineInfo: {
    flex: 1,
  },
  cuisineName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  cuisineStats: {
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 16,
  },
  cuisineRevenue: {
    alignItems: 'flex-end',
  },
  revenueAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  regionInfo: {
    flex: 1,
  },
  regionName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  regionStats: {
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 16,
  },
  regionRevenue: {
    alignItems: 'flex-end',
  },
  retentionChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  retentionItem: {
    alignItems: 'center',
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
  },
  retentionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  retentionInfo: {
    alignItems: 'center',
  },
  retentionNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  retentionLabel: {
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
});

export default AdminAnalyticsScreen;