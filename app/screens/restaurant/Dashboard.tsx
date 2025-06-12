import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { useTheme } from '../../../contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    specialInstructions?: string;
  }>;
  totalAmount: number;
  status: 'new' | 'preparing' | 'ready' | 'picked_up';
  orderTime: string;
  estimatedTime?: string;
  paymentStatus: 'paid' | 'pending';
}

interface Analytics {
  dailyRevenue: number;
  dailyOrders: number;
  avgOrderValue: number;
  completionRate: number;
  popularItems: string[];
}

const RestaurantDashboardScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode } = useTheme();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'orders'>('overview');
  const [isOnline, setIsOnline] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Mock data
  const analytics: Analytics = {
    dailyRevenue: 1250.50,
    dailyOrders: 34,
    avgOrderValue: 36.78,
    completionRate: 94.2,
    popularItems: ['Margherita Pizza', 'Caesar Salad', 'Chicken Pasta'],
  };

  const recentOrders: Order[] = [
    {
      id: '1',
      orderNumber: '#ORD001',
      customerName: 'John Doe',
      items: [
        { name: 'Margherita Pizza', quantity: 1 },
        { name: 'Caesar Salad', quantity: 1 },
      ],
      totalAmount: 24.99,
      status: 'new',
      orderTime: '2 min ago',
      paymentStatus: 'paid',
    },
    {
      id: '2',
      orderNumber: '#ORD002',
      customerName: 'Sarah Smith',
      items: [
        { name: 'Chicken Pasta', quantity: 2, specialInstructions: 'Extra cheese' },
      ],
      totalAmount: 32.50,
      status: 'preparing',
      orderTime: '5 min ago',
      estimatedTime: '15 min',
      paymentStatus: 'paid',
    },
    {
      id: '3',
      orderNumber: '#ORD003',
      customerName: 'Mike Johnson',
      items: [
        { name: 'Burger Deluxe', quantity: 1 },
        { name: 'French Fries', quantity: 1 },
      ],
      totalAmount: 18.75,
      status: 'ready',
      orderTime: '12 min ago',
      paymentStatus: 'paid',
    },
  ];

  React.useEffect(() => {
    if (!isOnline) {
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
  }, [isOnline, pulseAnim]);

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'new': return '#F59E0B';
      case 'preparing': return '#3B82F6';
      case 'ready': return '#10B981';
      case 'picked_up': return '#6B7280';
      default: return theme.textMuted;
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'new': return 'New Order';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'picked_up': return 'Picked Up';
      default: return 'Unknown';
    }
  };

  const handleStatusUpdate = (orderId: string, newStatus: Order['status']) => {
    console.log(`Update order ${orderId} to ${newStatus}`);
  };

  const toggleOnlineStatus = () => {
    setIsOnline(!isOnline);
  };

  const renderAnalyticsCard = (title: string, value: string, subtitle: string, icon: string, color: string) => (
    <View style={[styles.analyticsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={styles.analyticsHeader}>
        <View style={[styles.analyticsIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <Text style={[styles.analyticsValue, { color: theme.text }]}>{value}</Text>
      </View>
      <Text style={[styles.analyticsTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.analyticsSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
    </View>
  );

  const renderOrderCard = ({ item }: { item: Order }) => (
    <View style={[styles.orderCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={[styles.orderNumber, { color: theme.text }]}>{item.orderNumber}</Text>
          <Text style={[styles.customerName, { color: theme.textSecondary }]}>{item.customerName}</Text>
          <Text style={[styles.orderTime, { color: theme.textMuted }]}>{item.orderTime}</Text>
        </View>
        <View style={styles.orderStatus}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
          <Text style={[styles.orderAmount, { color: theme.primary }]}>${item.totalAmount.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        {item.items.map((orderItem, index) => (
          <View key={index} style={styles.orderItem}>
            <Text style={[styles.itemText, { color: theme.text }]}>
              {orderItem.quantity}x {orderItem.name}
            </Text>
            {orderItem.specialInstructions && (
              <Text style={[styles.specialInstructions, { color: theme.warning }]}>
                Note: {orderItem.specialInstructions}
              </Text>
            )}
          </View>
        ))}
      </View>

      {item.estimatedTime && (
        <View style={[styles.estimatedTime, { backgroundColor: theme.info + '20' }]}>
          <Ionicons name="time-outline" size={16} color={theme.info} />
          <Text style={[styles.estimatedTimeText, { color: theme.info }]}>
            Estimated: {item.estimatedTime}
          </Text>
        </View>
      )}

      <View style={styles.orderActions}>
        {item.status === 'new' && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, styles.acceptButton, { backgroundColor: theme.success }]}
              onPress={() => handleStatusUpdate(item.id, 'preparing')}
            >
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton, { backgroundColor: theme.error }]}
            >
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'preparing' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.readyButton, { backgroundColor: theme.primary }]}
            onPress={() => handleStatusUpdate(item.id, 'ready')}
          >
            <Text style={styles.actionButtonText}>Mark Ready</Text>
          </TouchableOpacity>
        )}
        {item.status === 'ready' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.completedButton, { backgroundColor: theme.success }]}
            onPress={() => handleStatusUpdate(item.id, 'picked_up')}
          >
            <Text style={styles.actionButtonText}>Mark Picked Up</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderOverview = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Analytics Cards */}
      <View style={styles.analyticsGrid}>
        {renderAnalyticsCard(
          'Daily Revenue',
          `$${analytics.dailyRevenue.toFixed(2)}`,
          '+12% from yesterday',
          'trending-up',
          '#10B981'
        )}
        {renderAnalyticsCard(
          'Orders Today',
          analytics.dailyOrders.toString(),
          `${analytics.completionRate}% completion`,
          'receipt',
          '#3B82F6'
        )}
        {renderAnalyticsCard(
          'Avg Order Value',
          `$${analytics.avgOrderValue.toFixed(2)}`,
          '+5% from last week',
          'card',
          '#F59E0B'
        )}
        {renderAnalyticsCard(
          'Rating',
          '4.8',
          'Based on 247 reviews',
          'star',
          '#EF4444'
        )}
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
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Popular Items Today</Text>
        <View style={[styles.popularItemsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
          {analytics.popularItems.map((item, index) => (
            <View key={index} style={styles.popularItem}>
              <View style={[styles.popularRank, { backgroundColor: theme.primary }]}>
                <Text style={styles.popularRankText}>{index + 1}</Text>
              </View>
              <Text style={[styles.popularItemName, { color: theme.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderOrders = () => (
    <FlatList
      data={recentOrders}
      renderItem={renderOrderCard}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.ordersList}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.restaurantInfo}>
            <Text style={styles.restaurantName}>Rose Garden Restaurant</Text>
            <Text style={styles.headerSubtitle}>Manage your orders & analytics</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Online Status Toggle */}
        <Animated.View style={[styles.statusContainer, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity 
            style={[styles.statusToggle, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}
            onPress={toggleOnlineStatus}
          >
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: '#fff' }]} />
            </View>
            <Text style={styles.statusText}>
              {isOnline ? 'Online - Accepting Orders' : 'Offline - Closed'}
            </Text>
            <Ionicons 
              name={isOnline ? "checkmark-circle" : "close-circle"} 
              size={20} 
              color="#fff" 
            />
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && { borderBottomColor: theme.primary }]}
          onPress={() => setSelectedTab('overview')}
        >
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
          <Text style={[
            styles.tabText,
            { color: selectedTab === 'orders' ? theme.primary : theme.textSecondary }
          ]}>
            Orders ({recentOrders.filter(o => o.status !== 'picked_up').length})
          </Text>
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
  header: {
    paddingTop: 50,
    paddingBottom: 20,
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
    fontSize: 24,
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
    marginTop: 10,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    justifyContent: 'center',
  },
  statusIndicator: {
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    marginBottom: 10,
  },
  analyticsCard: {
    width: (screenWidth - 60) / 2,
    marginRight: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  analyticsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  analyticsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  analyticsSubtitle: {
    fontSize: 12,
  },
  section: {
    marginBottom: 32,
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
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
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
  orderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderItems: {
    marginBottom: 12,
  },
  orderItem: {
    marginBottom: 4,
  },
  itemText: {
    fontSize: 14,
  },
  specialInstructions: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  estimatedTime: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  estimatedTimeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {},
  rejectButton: {},
  readyButton: {},
  completedButton: {},
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
    paddingVertical: 8,
  },
  popularRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  popularRankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  popularItemName: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default RestaurantDashboardScreen;