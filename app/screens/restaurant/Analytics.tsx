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
  onSnapshot
} from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice, formatCurrency } from '../../../services/currency';

const { width: screenWidth } = Dimensions.get('window');

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
  createdAt: any;
  updatedAt: any;
  deliveredAt?: any;
  confirmedAt?: any;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  category: string;
}

interface OrderPricing {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

interface AnalyticsData {
  revenue: {
    today: number;
    yesterday: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
  };
  orders: {
    today: number;
    yesterday: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
    completed: number;
    cancelled: number;
    pending: number;
  };
  performance: {
    avgOrderValue: number;
    avgPreparationTime: number;
    customerRating: number;
    repeatCustomers: number;
  };
  topItems: Array<{
    name: string;
    orders: number;
    revenue: number;
    category: string;
  }>;
  recentActivity: Array<{
    time: string;
    action: string;
    amount?: number;
    orderId?: string;
  }>;
}

type TimeFilter = 'today' | 'week' | 'month';

const AnalyticsScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode } = useTheme();
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilter>('today');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  // Date helper functions
  const getDateRanges = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    // Week ranges (Monday to Sunday)
    const dayOfWeek = now.getDay();
    const mondayOfThisWeek = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
    const mondayOfLastWeek = new Date(mondayOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Month ranges
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    return {
      today,
      yesterday,
      mondayOfThisWeek,
      mondayOfLastWeek,
      firstOfThisMonth,
      firstOfLastMonth,
      firstOfNextMonth,
    };
  };

  // Calculate analytics from orders
  const calculateAnalytics = (ordersList: Order[]): AnalyticsData => {
    const dates = getDateRanges();
    const now = new Date();

    // Helper function to check if date is in range
    const isInRange = (orderDate: any, startDate: Date, endDate?: Date) => {
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
      
      if (endDate) {
        return date >= startDate && date < endDate;
      } else {
        return date >= startDate;
      }
    };

    // Filter orders by date ranges
    const todayOrders = ordersList.filter(o => isInRange(o.createdAt, dates.today));
    const yesterdayOrders = ordersList.filter(o => isInRange(o.createdAt, dates.yesterday, dates.today));
    const thisWeekOrders = ordersList.filter(o => isInRange(o.createdAt, dates.mondayOfThisWeek));
    const lastWeekOrders = ordersList.filter(o => isInRange(o.createdAt, dates.mondayOfLastWeek, dates.mondayOfThisWeek));
    const thisMonthOrders = ordersList.filter(o => isInRange(o.createdAt, dates.firstOfThisMonth));
    const lastMonthOrders = ordersList.filter(o => isInRange(o.createdAt, dates.firstOfLastMonth, dates.firstOfThisMonth));

    // Calculate revenue
    const calculateRevenue = (orders: Order[]) => 
      orders.filter(o => o.status === 'delivered' && o.paymentStatus === 'paid')
            .reduce((sum, o) => sum + (o.pricing?.total || 0), 0);

    const revenue = {
      today: calculateRevenue(todayOrders),
      yesterday: calculateRevenue(yesterdayOrders),
      thisWeek: calculateRevenue(thisWeekOrders),
      lastWeek: calculateRevenue(lastWeekOrders),
      thisMonth: calculateRevenue(thisMonthOrders),
      lastMonth: calculateRevenue(lastMonthOrders),
    };

    // Calculate order stats
    const orders = {
      today: todayOrders.length,
      yesterday: yesterdayOrders.length,
      thisWeek: thisWeekOrders.length,
      lastWeek: lastWeekOrders.length,
      thisMonth: thisMonthOrders.length,
      lastMonth: lastMonthOrders.length,
      completed: ordersList.filter(o => o.status === 'delivered').length,
      cancelled: ordersList.filter(o => o.status === 'cancelled').length,
      pending: ordersList.filter(o => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length,
    };

    // Calculate performance metrics
    const completedOrders = ordersList.filter(o => o.status === 'delivered' && o.pricing?.total);
    const avgOrderValue = completedOrders.length > 0 
      ? completedOrders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0) / completedOrders.length
      : 0;

    // Calculate average preparation time (if available)
    const ordersWithPrepTime = ordersList.filter(o => 
      o.confirmedAt && o.deliveredAt && o.status === 'delivered'
    );
    
    let avgPreparationTime = 20; // Default fallback
    if (ordersWithPrepTime.length > 0) {
      const totalPrepTime = ordersWithPrepTime.reduce((sum, o) => {
        const confirmedTime = o.confirmedAt?.toDate() || new Date(o.confirmedAt?.seconds * 1000);
        const deliveredTime = o.deliveredAt?.toDate() || new Date(o.deliveredAt?.seconds * 1000);
        return sum + (deliveredTime.getTime() - confirmedTime.getTime()) / (1000 * 60); // minutes
      }, 0);
      avgPreparationTime = Math.round(totalPrepTime / ordersWithPrepTime.length);
    }

    // Calculate top-selling items
    const itemStats = new Map<string, { orders: number; revenue: number; category: string }>();
    
    ordersList.filter(o => o.status === 'delivered').forEach(order => {
      order.items?.forEach(item => {
        const key = item.name;
        const existing = itemStats.get(key) || { orders: 0, revenue: 0, category: item.category || 'Other' };
        existing.orders += item.quantity || 1;
        existing.revenue += item.subtotal || (item.price * (item.quantity || 1));
        itemStats.set(key, existing);
      });
    });

    const topItems = Array.from(itemStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    // Generate recent activity
    const recentActivity = ordersList
      .slice(0, 10) // Most recent 10 orders
      .map(order => {
        const timeAgo = getTimeAgo(order.createdAt);
        switch (order.status) {
          case 'delivered':
            return {
              time: timeAgo,
              action: 'Order completed',
              amount: order.pricing?.total || 0,
              orderId: order.id,
            };
          case 'cancelled':
            return {
              time: timeAgo,
              action: 'Order cancelled',
              amount: order.pricing?.total || 0,
              orderId: order.id,
            };
          case 'pending':
            return {
              time: timeAgo,
              action: 'New order received',
              amount: order.pricing?.total || 0,
              orderId: order.id,
            };
          default:
            return {
              time: timeAgo,
              action: `Order ${order.status}`,
              amount: order.pricing?.total || 0,
              orderId: order.id,
            };
        }
      });

    // Calculate repeat customers (simplified)
    const customerEmails = new Set(ordersList.map(o => o.userEmail));
    const customerOrderCounts = new Map<string, number>();
    ordersList.forEach(order => {
      const email = order.userEmail;
      customerOrderCounts.set(email, (customerOrderCounts.get(email) || 0) + 1);
    });
    const repeatCustomers = Array.from(customerOrderCounts.values()).filter(count => count > 1).length;
    const repeatCustomerPercentage = customerEmails.size > 0 ? (repeatCustomers / customerEmails.size) * 100 : 0;

    const performance = {
      avgOrderValue,
      avgPreparationTime,
      customerRating: 4.7, // This would come from a reviews collection
      repeatCustomers: Math.round(repeatCustomerPercentage),
    };

    return {
      revenue,
      orders,
      performance,
      topItems,
      recentActivity,
    };
  };

  // Time ago helper
  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    
    try {
      const now = new Date();
      let orderTime: Date;
      
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        orderTime = timestamp.toDate();
      } else if (timestamp.seconds) {
        orderTime = new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        orderTime = timestamp;
      } else {
        return 'Unknown time';
      }
      
      const diffInMinutes = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    } catch (error) {
      console.warn('Error formatting time:', error);
      return 'Unknown time';
    }
  };

  // Load orders data
  const loadOrdersData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      
      // Get orders from last 3 months for analysis
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const ordersRef = collection(FIREBASE_DB, 'orders');
      const ordersQuery = query(
        ordersRef,
        where('restaurantId', '==', user.uid),
        where('createdAt', '>=', Timestamp.fromDate(threeMonthsAgo)),
        orderBy('createdAt', 'desc'),
        limit(1000) // Limit to prevent excessive data loading
      );

      const snapshot = await getDocs(ordersQuery);
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
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          confirmedAt: data.confirmedAt,
          deliveredAt: data.deliveredAt,
        } as Order);
      });

      setOrders(ordersList);
      
      // Calculate analytics from the loaded orders
      const analytics = calculateAnalytics(ordersList);
      setAnalyticsData(analytics);
      
    } catch (error) {
      console.error('Error loading orders data:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Real-time order updates (for recent activity)
  useEffect(() => {
    if (!user?.uid) return;

    const ordersRef = collection(FIREBASE_DB, 'orders');
    const recentOrdersQuery = query(
      ordersRef,
      where('restaurantId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50) // Recent orders for real-time updates
    );

    const unsubscribe = onSnapshot(recentOrdersQuery, (snapshot) => {
      // Only update if not currently loading initial data
      if (!loading && analyticsData) {
        const recentOrdersList: Order[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          recentOrdersList.push({
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
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            confirmedAt: data.confirmedAt,
            deliveredAt: data.deliveredAt,
          } as Order);
        });

        // Merge with existing orders and recalculate analytics
        const updatedOrders = [...recentOrdersList, ...orders.filter(o => 
          !recentOrdersList.some(r => r.id === o.id)
        )];
        
        setOrders(updatedOrders);
        const updatedAnalytics = calculateAnalytics(updatedOrders);
        setAnalyticsData(updatedAnalytics);
      }
    }, (error) => {
      console.error('Error listening to order updates:', error);
    });

    return () => unsubscribe();
  }, [user?.uid, loading, analyticsData]);

  // Load data on component mount
  useEffect(() => {
    loadOrdersData();
  }, [user?.uid]);

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrdersData();
    setRefreshing(false);
  };

  // Get data based on time filter
  const getRevenueData = () => {
    if (!analyticsData) return { current: 0, previous: 0, label: 'Today', comparison: 'vs Yesterday' };
    
    switch (selectedTimeFilter) {
      case 'today':
        return {
          current: analyticsData.revenue.today,
          previous: analyticsData.revenue.yesterday,
          label: 'Today',
          comparison: 'vs Yesterday',
        };
      case 'week':
        return {
          current: analyticsData.revenue.thisWeek,
          previous: analyticsData.revenue.lastWeek,
          label: 'This Week',
          comparison: 'vs Last Week',
        };
      case 'month':
        return {
          current: analyticsData.revenue.thisMonth,
          previous: analyticsData.revenue.lastMonth,
          label: 'This Month',
          comparison: 'vs Last Month',
        };
    }
  };

  const getOrdersData = () => {
    if (!analyticsData) return { current: 0, previous: 0 };
    
    switch (selectedTimeFilter) {
      case 'today':
        return {
          current: analyticsData.orders.today,
          previous: analyticsData.orders.yesterday,
        };
      case 'week':
        return {
          current: analyticsData.orders.thisWeek,
          previous: analyticsData.orders.lastWeek,
        };
      case 'month':
        return {
          current: analyticsData.orders.thisMonth,
          previous: analyticsData.orders.lastMonth,
        };
    }
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) {
      return {
        value: current > 0 ? '100.0' : '0.0',
        isPositive: current >= 0,
      };
    }
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0,
    };
  };

  const revenueData = getRevenueData();
  const ordersData = getOrdersData();
  const revenueChange = calculatePercentageChange(revenueData.current, revenueData.previous);
  const ordersChange = calculatePercentageChange(ordersData.current, ordersData.previous);

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
    change: { value: string; isPositive: boolean },
    comparison: string,
    icon: string,
    color: string
  ) => (
    <View style={[styles.metricCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={[styles.changeIndicator, { backgroundColor: change.isPositive ? '#10B981' : '#EF4444' }]}>
          <Ionicons 
            name={change.isPositive ? "trending-up" : "trending-down"} 
            size={12} 
            color="#fff" 
          />
          <Text style={styles.changeValue}>{change.value}%</Text>
        </View>
      </View>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.metricComparison, { color: theme.textMuted }]}>{comparison}</Text>
    </View>
  );

  const renderPerformanceCard = (title: string, value: string, subtitle: string, icon: string, color: string) => (
    <View style={[styles.performanceCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={[styles.performanceIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.performanceContent}>
        <Text style={[styles.performanceValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.performanceTitle, { color: theme.textSecondary }]}>{title}</Text>
        <Text style={[styles.performanceSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      </View>
    </View>
  );

  const renderTopItem = (item: AnalyticsData['topItems'][0], index: number) => (
    <View key={index} style={[styles.topItemCard, { backgroundColor: theme.surface }]}>
      <View style={styles.topItemRank}>
        <View style={[styles.rankBadge, { backgroundColor: index === 0 ? '#F59E0B' : theme.primary }]}>
          <Text style={styles.rankText}>{index + 1}</Text>
        </View>
      </View>
      <View style={styles.topItemInfo}>
        <Text style={[styles.topItemName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.topItemOrders, { color: theme.textSecondary }]}>
          {item.orders} orders • {item.category}
        </Text>
      </View>
      <View style={styles.topItemRevenue}>
        <Text style={[styles.topItemAmount, { color: theme.primary }]}>
          {formatPrice(item.revenue)}
        </Text>
      </View>
    </View>
  );

  const renderActivityItem = (
    activity: {
      time: string;
      action: string;
      amount?: number;
      orderId?: string;
    },
    index: number
  ) => (
    <View key={index} style={[styles.activityItem, { borderBottomColor: theme.separator }]}>
      <View style={styles.activityInfo}>
        <Text style={[styles.activityAction, { color: theme.text }]}>{activity.action}</Text>
        <Text style={[styles.activityTime, { color: theme.textMuted }]}>{activity.time}</Text>
      </View>
      {activity.amount && (
        <Text style={[styles.activityAmount, { color: theme.primary }]}>
          {formatPrice(activity.amount)}
        </Text>
      )}
    </View>
  );

  // Loading screen
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading analytics...</Text>
      </View>
    );
  }

  // No data screen
  if (!analyticsData || orders.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={theme.primaryGradient as [string, string]}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Track your restaurant performance</Text>
        </LinearGradient>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Data Available</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Start accepting orders to see your analytics
          </Text>
          <TouchableOpacity 
            style={[styles.refreshButton, { backgroundColor: theme.primary }]}
            onPress={onRefresh}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>Track your restaurant performance</Text>
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
          </View>
        </View>

        {/* Main Metrics */}
        <View style={styles.metricsContainer}>
          {renderMetricCard(
            revenueData.label + ' Revenue',
            formatPrice(revenueData.current),
            revenueChange,
            revenueData.comparison,
            'trending-up',
            '#10B981'
          )}
          {renderMetricCard(
            revenueData.label + ' Orders',
            ordersData.current.toString(),
            ordersChange,
            revenueData.comparison,
            'receipt',
            '#3B82F6'
          )}
        </View>

        {/* Performance Metrics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Performance Overview</Text>
          <View style={styles.performanceGrid}>
            {renderPerformanceCard(
              'Avg Order Value',
              formatPrice(analyticsData.performance.avgOrderValue),
              `From ${analyticsData.orders.completed} completed orders`,
              'card',
              '#F59E0B'
            )}
            {renderPerformanceCard(
              'Avg Prep Time',
              `${analyticsData.performance.avgPreparationTime} min`,
              'Order to delivery time',
              'time',
              '#6366F1'
            )}
            {renderPerformanceCard(
              'Customer Rating',
              analyticsData.performance.customerRating.toFixed(1),
              'Based on customer reviews',
              'star',
              '#EF4444'
            )}
            {renderPerformanceCard(
              'Repeat Customers',
              `${analyticsData.performance.repeatCustomers}%`,
              'Customer retention rate',
              'people',
              '#10B981'
            )}
          </View>
        </View>

        {/* Order Status Overview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Status Overview</Text>
          <View style={[styles.statusCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <View style={[styles.statusIcon, { backgroundColor: '#10B981' + '20' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusValue, { color: theme.text }]}>
                    {analyticsData.orders.pending}
                  </Text>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Pending</Text>
                </View>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusIcon, { backgroundColor: '#EF4444' + '20' }]}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </View>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusValue, { color: theme.text }]}>
                    {analyticsData.orders.cancelled}
                  </Text>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Cancelled</Text>
                </View>
              </View>
            </View>
            <View style={[styles.successRate, { backgroundColor: '#10B981' + '20' }]}>
              <Ionicons name="trending-up" size={16} color="#10B981" />
              <Text style={[styles.successRateText, { color: '#10B981' }]}>
                {analyticsData.orders.completed + analyticsData.orders.cancelled > 0 
                  ? ((analyticsData.orders.completed / (analyticsData.orders.completed + analyticsData.orders.cancelled)) * 100).toFixed(1)
                  : '0.0'
                }% Success Rate
              </Text>
            </View>
          </View>
        </View>

        {/* Top Selling Items */}
        {analyticsData.topItems.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Selling Items</Text>
            <View style={[styles.topItemsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
              {analyticsData.topItems.map(renderTopItem)}
            </View>
          </View>
        )}

        {/* Recent Activity */}
        {analyticsData.recentActivity.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
            <View style={[styles.activityCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
              {analyticsData.recentActivity.slice(0, 8).map(renderActivityItem)}
            </View>
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
  timeFilterContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
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
  },
  timeFilterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 2,
  },
  changeValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  metricComparison: {
    fontSize: 12,
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
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  performanceCard: {
    width: (screenWidth - 64) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  performanceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  performanceContent: {
    flex: 1,
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  performanceTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  performanceSubtitle: {
    fontSize: 10,
  },
  statusCard: {
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusContent: {
    alignItems: 'center',
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  successRate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  successRateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  topItemsCard: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  topItemRank: {
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
  topItemInfo: {
    flex: 1,
  },
  topItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  topItemOrders: {
    fontSize: 12,
  },
  topItemRevenue: {
    alignItems: 'flex-end',
  },
  topItemAmount: {
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  activityInfo: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  insightsCard: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightItem: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 18,
  },
  insightDivider: {
    height: 1,
    marginVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 24,
  },
  refreshButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dataSummaryCard: {
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dataSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  dataSummaryText: {
    fontSize: 14,
    lineHeight: 18,
  },
});

export default AnalyticsScreen;