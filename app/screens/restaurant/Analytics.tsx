import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

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
    completed: number;
    cancelled: number;
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
  }>;
  recentActivity: Array<{
    time: string;
    action: string;
    amount?: number;
  }>;
}

type TimeFilter = 'today' | 'week' | 'month';

const AnalyticsScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilter>('today');

  const analyticsData: AnalyticsData = {
    revenue: {
      today: 1250.50,
      yesterday: 980.25,
      thisWeek: 7845.75,
      lastWeek: 6920.50,
      thisMonth: 28450.25,
      lastMonth: 24680.75,
    },
    orders: {
      today: 34,
      yesterday: 28,
      thisWeek: 198,
      lastWeek: 174,
      completed: 186,
      cancelled: 12,
    },
    performance: {
      avgOrderValue: 36.78,
      avgPreparationTime: 18,
      customerRating: 4.7,
      repeatCustomers: 68,
    },
    topItems: [
      { name: 'Margherita Pizza', orders: 45, revenue: 764.55 },
      { name: 'Caesar Salad', orders: 32, revenue: 415.68 },
      { name: 'Chicken Pasta', orders: 28, revenue: 448.00 },
      { name: 'Chocolate Brownie', orders: 22, revenue: 197.78 },
      { name: 'Fresh Orange Juice', orders: 18, revenue: 89.82 },
    ],
    recentActivity: [
      { time: '2 min ago', action: 'Order completed', amount: 24.99 },
      { time: '5 min ago', action: 'New order received', amount: 32.50 },
      { time: '8 min ago', action: 'Order completed', amount: 18.75 },
      { time: '12 min ago', action: 'Menu item updated' },
      { time: '15 min ago', action: 'Order cancelled', amount: 15.50 },
    ],
  };

  const getRevenueData = () => {
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
          current: analyticsData.orders.thisWeek * 4,
          previous: analyticsData.orders.lastWeek * 4,
        };
    }
  };

  const calculatePercentageChange = (current: number, previous: number) => {
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

  const renderTopItem = (item: typeof analyticsData.topItems[0], index: number) => (
    <View key={index} style={[styles.topItemCard, { backgroundColor: theme.surface }]}>
      <View style={styles.topItemRank}>
        <View style={[styles.rankBadge, { backgroundColor: index === 0 ? '#F59E0B' : theme.primary }]}>
          <Text style={styles.rankText}>{index + 1}</Text>
        </View>
      </View>
      <View style={styles.topItemInfo}>
        <Text style={[styles.topItemName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.topItemOrders, { color: theme.textSecondary }]}>
          {item.orders} orders
        </Text>
      </View>
      <View style={styles.topItemRevenue}>
        <Text style={[styles.topItemAmount, { color: theme.primary }]}>
          ${item.revenue.toFixed(2)}
        </Text>
      </View>
    </View>
  );

  const renderActivityItem = (activity: typeof analyticsData.recentActivity[0], index: number) => (
    <View key={index} style={[styles.activityItem, { borderBottomColor: theme.separator }]}>
      <View style={styles.activityInfo}>
        <Text style={[styles.activityAction, { color: theme.text }]}>{activity.action}</Text>
        <Text style={[styles.activityTime, { color: theme.textMuted }]}>{activity.time}</Text>
      </View>
      {activity.amount && (
        <Text style={[styles.activityAmount, { color: theme.primary }]}>
          ${activity.amount.toFixed(2)}
        </Text>
      )}
    </View>
  );

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
            `${revenueData.current.toFixed(2)}`,
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
              `${analyticsData.performance.avgOrderValue.toFixed(2)}`,
              '+5% from last period',
              'card',
              '#F59E0B'
            )}
            {renderPerformanceCard(
              'Avg Prep Time',
              `${analyticsData.performance.avgPreparationTime} min`,
              '-2 min improvement',
              'time',
              '#6366F1'
            )}
            {renderPerformanceCard(
              'Customer Rating',
              analyticsData.performance.customerRating.toFixed(1),
              'Based on 247 reviews',
              'star',
              '#EF4444'
            )}
            {renderPerformanceCard(
              'Repeat Customers',
              `${analyticsData.performance.repeatCustomers}%`,
              '+8% this month',
              'people',
              '#10B981'
            )}
          </View>
        </View>

        {/* Order Status Overview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Status This Week</Text>
          <View style={[styles.statusCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <View style={[styles.statusIcon, { backgroundColor: '#10B981' + '20' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusValue, { color: theme.text }]}>
                    {analyticsData.orders.completed}
                  </Text>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Completed</Text>
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
                {((analyticsData.orders.completed / (analyticsData.orders.completed + analyticsData.orders.cancelled)) * 100).toFixed(1)}% Success Rate
              </Text>
            </View>
          </View>
        </View>

        {/* Top Selling Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Selling Items</Text>
          <View style={[styles.topItemsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            {analyticsData.topItems.map(renderTopItem)}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
          <View style={[styles.activityCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            {analyticsData.recentActivity.map(renderActivityItem)}
          </View>
        </View>

        {/* Insights & Recommendations */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Insights & Recommendations</Text>
          <View style={[styles.insightsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: '#10B981' + '20' }]}>
                <Ionicons name="bulb" size={20} color="#10B981" />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.text }]}>Peak Hours</Text>
                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                  Your busiest time is 7-9 PM. Consider offering happy hour discounts during slower periods.
                </Text>
              </View>
            </View>
            <View style={[styles.insightDivider, { backgroundColor: theme.separator }]} />
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: '#F59E0B' + '20' }]}>
                <Ionicons name="star" size={20} color="#F59E0B" />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.text }]}>Popular Items</Text>
                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                  Margherita Pizza is your top seller. Consider creating combo deals with your Caesar Salad.
                </Text>
              </View>
            </View>
            <View style={[styles.insightDivider, { backgroundColor: theme.separator }]} />
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: '#3B82F6' + '20' }]}>
                <Ionicons name="time" size={20} color="#3B82F6" />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.text }]}>Preparation Time</Text>
                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                  Your average prep time has improved by 2 minutes. Great job maintaining efficiency!
                </Text>
              </View>
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
});

export default AnalyticsScreen;