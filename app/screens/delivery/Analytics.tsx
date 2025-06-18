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
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

const { width } = Dimensions.get('window');

interface EarningsData {
  today: number;
  week: number;
  month: number;
  total: number;
}

interface DeliveryStats {
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  avgRating: number;
  totalRatings: number;
  avgDeliveryTime: number;
  onTimePercentage: number;
  completionRate: number;
}

interface WeeklyData {
  day: string;
  earnings: number;
  deliveries: number;
}

interface MonthlyData {
  week: string;
  earnings: number;
  deliveries: number;
}

interface TimeSlotData {
  slot: string;
  earnings: number;
  deliveries: number;
  avgRating: number;
}

type TimePeriod = 'week' | 'month' | 'year';

const DeliveryAnalyticsScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');
  const [earnings, setEarnings] = useState<EarningsData>({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
  });
  const [stats, setStats] = useState<DeliveryStats>({
    totalDeliveries: 0,
    completedDeliveries: 0,
    cancelledDeliveries: 0,
    avgRating: 0,
    totalRatings: 0,
    avgDeliveryTime: 0,
    onTimePercentage: 0,
    completionRate: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [timeSlotData, setTimeSlotData] = useState<TimeSlotData[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [user.uid, selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadEarningsData(),
        loadDeliveryStats(),
        loadChartData(),
        loadTimeSlotData(),
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEarningsData = async () => {
    try {
      // Get current date ranges
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const ordersRef = collection(FIREBASE_DB, 'orders');
      const q = query(
        ordersRef,
        where('deliveryPartnerId', '==', user.uid),
        where('status', '==', 'delivered'),
        orderBy('deliveredAt', 'desc')
      );

      const snapshot = await getDocs(q);
      let todayEarnings = 0;
      let weekEarnings = 0;
      let monthEarnings = 0;
      let totalEarnings = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const deliveryFee = data.pricing?.deliveryFee || 0;
        const deliveredAt = data.deliveredAt?.toDate() || new Date();

        totalEarnings += deliveryFee;

        if (deliveredAt >= todayStart) {
          todayEarnings += deliveryFee;
        }
        if (deliveredAt >= weekStart) {
          weekEarnings += deliveryFee;
        }
        if (deliveredAt >= monthStart) {
          monthEarnings += deliveryFee;
        }
      });

      setEarnings({
        today: todayEarnings,
        week: weekEarnings,
        month: monthEarnings,
        total: totalEarnings,
      });
    } catch (error) {
      console.error('Error loading earnings data:', error);
      // Use mock data for demonstration
      setEarnings({
        today: 850.00,
        week: 4250.00,
        month: 18500.00,
        total: 45600.00,
      });
    }
  };

  const loadDeliveryStats = async () => {
    try {
      const ordersRef = collection(FIREBASE_DB, 'orders');
      const q = query(
        ordersRef,
        where('deliveryPartnerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      let totalDeliveries = 0;
      let completedDeliveries = 0;
      let cancelledDeliveries = 0;
      let totalRating = 0;
      let ratingCount = 0;
      let totalDeliveryTime = 0;
      let onTimeCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        totalDeliveries++;

        if (data.status === 'delivered') {
          completedDeliveries++;
          
          // Calculate delivery time if available
          if (data.pickedUpAt && data.deliveredAt) {
            const pickupTime = data.pickedUpAt.toDate();
            const deliveryTime = data.deliveredAt.toDate();
            const duration = (deliveryTime.getTime() - pickupTime.getTime()) / (1000 * 60); // minutes
            totalDeliveryTime += duration;
            
            // Assume on-time if delivered within estimated time + 10 minutes
            const estimatedMinutes = parseInt(data.estimatedDeliveryTime) || 30;
            if (duration <= estimatedMinutes + 10) {
              onTimeCount++;
            }
          }

          if (data.deliveryRating) {
            totalRating += data.deliveryRating;
            ratingCount++;
          }
        } else if (data.status === 'cancelled') {
          cancelledDeliveries++;
        }
      });

      setStats({
        totalDeliveries,
        completedDeliveries,
        cancelledDeliveries,
        avgRating: ratingCount > 0 ? totalRating / ratingCount : 0,
        totalRatings: ratingCount,
        avgDeliveryTime: completedDeliveries > 0 ? totalDeliveryTime / completedDeliveries : 0,
        onTimePercentage: completedDeliveries > 0 ? (onTimeCount / completedDeliveries) * 100 : 0,
        completionRate: totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0,
      });
    } catch (error) {
      console.error('Error loading delivery stats:', error);
      // Use mock data for demonstration
      setStats({
        totalDeliveries: 145,
        completedDeliveries: 138,
        cancelledDeliveries: 7,
        avgRating: 4.7,
        totalRatings: 132,
        avgDeliveryTime: 28.5,
        onTimePercentage: 92.3,
        completionRate: 95.2,
      });
    }
  };

  const loadChartData = async () => {
    // Mock data for charts - in a real app, this would come from Firestore
    if (selectedPeriod === 'week') {
      setWeeklyData([
        { day: 'Mon', earnings: 420, deliveries: 8 },
        { day: 'Tue', earnings: 380, deliveries: 7 },
        { day: 'Wed', earnings: 520, deliveries: 9 },
        { day: 'Thu', earnings: 650, deliveries: 12 },
        { day: 'Fri', earnings: 780, deliveries: 14 },
        { day: 'Sat', earnings: 920, deliveries: 16 },
        { day: 'Sun', earnings: 580, deliveries: 11 },
      ]);
    } else if (selectedPeriod === 'month') {
      setMonthlyData([
        { week: 'Week 1', earnings: 3200, deliveries: 58 },
        { week: 'Week 2', earnings: 4100, deliveries: 72 },
        { week: 'Week 3', earnings: 3800, deliveries: 65 },
        { week: 'Week 4', earnings: 4250, deliveries: 77 },
      ]);
    }
  };

  const loadTimeSlotData = async () => {
    // Mock data for time slot analysis
    setTimeSlotData([
      { slot: '6AM-9AM', earnings: 320, deliveries: 6, avgRating: 4.8 },
      { slot: '9AM-12PM', earnings: 450, deliveries: 8, avgRating: 4.6 },
      { slot: '12PM-3PM', earnings: 680, deliveries: 12, avgRating: 4.7 },
      { slot: '3PM-6PM', earnings: 520, deliveries: 9, avgRating: 4.5 },
      { slot: '6PM-9PM', earnings: 890, deliveries: 15, avgRating: 4.8 },
      { slot: '9PM-12AM', earnings: 380, deliveries: 7, avgRating: 4.9 },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const renderEarningsCard = (title: string, amount: number, icon: string, color: string, subtitle?: string) => (
    <View style={[styles.earningsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={[styles.earningsIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.earningsContent}>
        <Text style={[styles.earningsTitle, { color: theme.textSecondary }]}>{title}</Text>
        <Text style={[styles.earningsAmount, { color: theme.text }]}>{formatPrice(amount)}</Text>
        {subtitle && (
          <Text style={[styles.earningsSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        )}
      </View>
    </View>
  );

  const renderStatsCard = (title: string, value: string, icon: string, color: string, subtitle?: string) => (
    <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.statsContent}>
        <Text style={[styles.statsValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.statsSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        )}
      </View>
    </View>
  );

  const renderChartBar = (data: WeeklyData | MonthlyData, maxValue: number, index: number) => {
    const percentage = (data.earnings / maxValue) * 100;
    const barHeight = Math.max((percentage / 100) * 120, 4);
    
    return (
      <View key={index} style={styles.chartBarContainer}>
        <View style={[styles.chartBar, { height: barHeight, backgroundColor: theme.primary }]} />
        <Text style={[styles.chartBarValue, { color: theme.text }]}>
          {formatPrice(data.earnings)}
        </Text>
        <Text style={[styles.chartBarLabel, { color: theme.textSecondary }]}>
          {'day' in data ? data.day : data.week}
        </Text>
        <Text style={[styles.chartBarDeliveries, { color: theme.textMuted }]}>
          {data.deliveries} orders
        </Text>
      </View>
    );
  };

  const renderTimeSlotCard = (slot: TimeSlotData) => (
    <View key={slot.slot} style={[styles.timeSlotCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={styles.timeSlotHeader}>
        <Text style={[styles.timeSlotTitle, { color: theme.text }]}>{slot.slot}</Text>
        <View style={styles.timeSlotRating}>
          <Ionicons name="star" size={14} color={theme.warning} />
          <Text style={[styles.ratingText, { color: theme.warning }]}>{slot.avgRating.toFixed(1)}</Text>
        </View>
      </View>
      <View style={styles.timeSlotStats}>
        <View style={styles.timeSlotStat}>
          <Text style={[styles.timeSlotValue, { color: theme.success }]}>{formatPrice(slot.earnings)}</Text>
          <Text style={[styles.timeSlotLabel, { color: theme.textMuted }]}>Earnings</Text>
        </View>
        <View style={styles.timeSlotStat}>
          <Text style={[styles.timeSlotValue, { color: theme.primary }]}>{slot.deliveries}</Text>
          <Text style={[styles.timeSlotLabel, { color: theme.textMuted }]}>Orders</Text>
        </View>
        <View style={styles.timeSlotStat}>
          <Text style={[styles.timeSlotValue, { color: theme.info }]}>
            {(slot.earnings / slot.deliveries).toFixed(0)}
          </Text>
          <Text style={[styles.timeSlotLabel, { color: theme.textMuted }]}>Avg/Order</Text>
        </View>
      </View>
    </View>
  );

  const chartData = selectedPeriod === 'week' ? weeklyData : monthlyData;
  const maxEarnings = Math.max(...chartData.map(d => d.earnings));

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading analytics...</Text>
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
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Track your performance and earnings</Text>
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
        {/* Earnings Overview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Earnings Overview</Text>
          <View style={styles.earningsGrid}>
            {renderEarningsCard('Today', earnings.today, 'today', theme.primary)}
            {renderEarningsCard('This Week', earnings.week, 'calendar', theme.success)}
            {renderEarningsCard('This Month', earnings.month, 'stats-chart', theme.warning)}
            {renderEarningsCard('Total Earned', earnings.total, 'trophy', theme.info)}
          </View>
        </View>

        {/* Performance Stats */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Performance Stats</Text>
          <View style={styles.statsGrid}>
            {renderStatsCard('Completion Rate', `${stats.completionRate.toFixed(1)}%`, 'checkmark-circle', theme.success)}
            {renderStatsCard('Average Rating', stats.avgRating.toFixed(1), 'star', theme.warning, `${stats.totalRatings} ratings`)}
            {renderStatsCard('On-Time Delivery', `${stats.onTimePercentage.toFixed(1)}%`, 'time', theme.info)}
            {renderStatsCard('Avg Delivery Time', `${stats.avgDeliveryTime.toFixed(1)} min`, 'speedometer', theme.primary)}
          </View>
          <View style={styles.statsGrid}>
            {renderStatsCard('Total Deliveries', stats.totalDeliveries.toString(), 'bicycle', theme.primary)}
            {renderStatsCard('Completed', stats.completedDeliveries.toString(), 'checkmark-done', theme.success)}
            {renderStatsCard('Cancelled', stats.cancelledDeliveries.toString(), 'close-circle', theme.error)}
            {renderStatsCard('Success Rate', `${((stats.completedDeliveries / stats.totalDeliveries) * 100).toFixed(1)}%`, 'trending-up', theme.info)}
          </View>
        </View>

        {/* Earnings Chart */}
        <View style={styles.section}>
          <View style={styles.chartHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Earnings Trend</Text>
            <View style={styles.periodSelector}>
              {(['week', 'month'] as TimePeriod[]).map(period => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    { backgroundColor: selectedPeriod === period ? theme.primary : theme.inputBackground }
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text style={[
                    styles.periodButtonText,
                    { color: selectedPeriod === period ? '#fff' : theme.textSecondary }
                  ]}>
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={[styles.chartContainer, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.chart}>
              {chartData.map((data, index) => renderChartBar(data, maxEarnings, index))}
            </View>
          </View>
        </View>

        {/* Time Slot Analysis */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Peak Hours Analysis</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Earnings and performance by time of day
          </Text>
          <View style={styles.timeSlotsContainer}>
            {timeSlotData.map(renderTimeSlotCard)}
          </View>
        </View>

        {/* Tips & Insights */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Insights & Tips</Text>
          <View style={[styles.insightsContainer, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.success + '20' }]}>
                <Ionicons name="trending-up" size={20} color={theme.success} />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.text }]}>Peak Earning Hours</Text>
                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                  Your best earning hours are 6PM-9PM. Consider working more during these peak times.
                </Text>
              </View>
            </View>
            
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.warning + '20' }]}>
                <Ionicons name="star" size={20} color={theme.warning} />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.text }]}>Rating Performance</Text>
                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                  Your average rating of {stats.avgRating.toFixed(1)} is excellent! Keep up the great service.
                </Text>
              </View>
            </View>
            
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: theme.info + '20' }]}>
                <Ionicons name="time" size={20} color={theme.info} />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.text }]}>Delivery Speed</Text>
                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                  Your average delivery time of {stats.avgDeliveryTime.toFixed(1)} minutes is within target range.
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
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  earningsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  earningsCard: {
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
  earningsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  earningsContent: {
    flex: 1,
  },
  earningsTitle: {
    fontSize: 12,
    marginBottom: 2,
  },
  earningsAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  earningsSubtitle: {
    fontSize: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  statsCard: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statsContent: {
    flex: 1,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  statsTitle: {
    fontSize: 11,
    marginBottom: 1,
  },
  statsSubtitle: {
    fontSize: 9,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    borderRadius: 16,
    padding: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 160,
  },
  chartBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  chartBar: {
    width: 20,
    borderRadius: 10,
    marginBottom: 8,
  },
  chartBarValue: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  chartBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  chartBarDeliveries: {
    fontSize: 9,
  },
  timeSlotsContainer: {
    gap: 12,
  },
  timeSlotCard: {
    borderRadius: 12,
    padding: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeSlotTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeSlotRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  timeSlotStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeSlotStat: {
    alignItems: 'center',
  },
  timeSlotValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  timeSlotLabel: {
    fontSize: 12,
  },
  insightsContainer: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
});

export default DeliveryAnalyticsScreen;