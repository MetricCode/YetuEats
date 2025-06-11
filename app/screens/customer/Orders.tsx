import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { useTheme } from '../../../contexts/ThemeContext';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  restaurantName: string;
  restaurantImage: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  orderDate: string;
  deliveryTime?: string;
  orderNumber: string;
}

type OrderFilter = 'all' | 'preparing' | 'on_the_way' | 'delivered';

const OrdersScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const orders: Order[] = [
    {
      id: '1',
      restaurantName: 'Rose Garden Restaurant',
      restaurantImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
      items: [
        { id: '1', name: 'Margherita Pizza', quantity: 1, price: 12.99 },
        { id: '2', name: 'Caesar Salad', quantity: 1, price: 8.99 },
      ],
      totalAmount: 24.97,
      status: 'on_the_way',
      orderDate: '2024-06-10',
      deliveryTime: '15 min',
      orderNumber: '#ORD001',
    },
    {
      id: '2',
      restaurantName: 'Spice Kitchen',
      restaurantImage: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop',
      items: [
        { id: '1', name: 'Chicken Curry', quantity: 2, price: 15.99 },
        { id: '2', name: 'Naan Bread', quantity: 3, price: 4.99 },
      ],
      totalAmount: 46.96,
      status: 'preparing',
      orderDate: '2024-06-10',
      orderNumber: '#ORD002',
    },
    {
      id: '3',
      restaurantName: 'Burger Palace',
      restaurantImage: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop',
      items: [
        { id: '1', name: 'Classic Burger', quantity: 1, price: 9.99 },
        { id: '2', name: 'French Fries', quantity: 1, price: 4.99 },
        { id: '3', name: 'Coke', quantity: 2, price: 3.99 },
      ],
      totalAmount: 22.96,
      status: 'delivered',
      orderDate: '2024-06-09',
      orderNumber: '#ORD003',
    },
    {
      id: '4',
      restaurantName: 'Thai Garden',
      restaurantImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
      items: [
        { id: '1', name: 'Pad Thai', quantity: 1, price: 13.99 },
      ],
      totalAmount: 16.48,
      status: 'delivered',
      orderDate: '2024-06-08',
      orderNumber: '#ORD004',
    },
  ];

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'preparing': return '#F59E0B';
      case 'on_the_way': return '#3B82F6';
      case 'delivered': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return theme.textMuted;
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'preparing': return 'Preparing';
      case 'on_the_way': return 'On the way';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'preparing': return 'restaurant-outline';
      case 'on_the_way': return 'car-outline';
      case 'delivered': return 'checkmark-circle';
      case 'cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  const filteredOrders = selectedFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === selectedFilter);

  const filters: { key: OrderFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'preparing', label: 'Preparing', count: orders.filter(o => o.status === 'preparing').length },
    { key: 'on_the_way', label: 'On the way', count: orders.filter(o => o.status === 'on_the_way').length },
    { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
  ];

  const renderFilterTab = (filter: { key: OrderFilter; label: string; count: number }) => {
    const isActive = selectedFilter === filter.key;
    
    return (
      <TouchableOpacity
        key={filter.key}
        style={[
          styles.filterTab,
          { backgroundColor: isActive ? theme.primary : theme.inputBackground },
        ]}
        onPress={() => setSelectedFilter(filter.key)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.filterTabText,
            { color: isActive ? '#fff' : theme.textSecondary },
          ]}
        >
          {filter.label}
        </Text>
        {filter.count > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : theme.primary }]}>
            <Text style={styles.filterBadgeText}>{filter.count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity 
      style={[styles.orderCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      activeOpacity={0.7}
    >
      {/* Order Header */}
      <View style={styles.orderHeader}>
        <Image source={{ uri: item.restaurantImage }} style={styles.restaurantImage} />
        <View style={styles.orderInfo}>
          <Text style={[styles.restaurantName, { color: theme.text }]}>{item.restaurantName}</Text>
          <Text style={[styles.orderNumber, { color: theme.textSecondary }]}>{item.orderNumber}</Text>
          <Text style={[styles.orderDate, { color: theme.textMuted }]}>{item.orderDate}</Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Ionicons 
              name={getStatusIcon(item.status) as any} 
              size={14} 
              color="#fff" 
              style={styles.statusIcon}
            />
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
          {item.deliveryTime && (
            <Text style={[styles.deliveryTime, { color: theme.primary }]}>{item.deliveryTime}</Text>
          )}
        </View>
      </View>

      {/* Order Items */}
      <View style={styles.orderContent}>
        <View style={styles.itemsList}>
          {item.items.map((orderItem, index) => (
            <View key={orderItem.id} style={styles.orderItem}>
              <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                {orderItem.quantity}x {orderItem.name}
              </Text>
              <Text style={[styles.itemPrice, { color: theme.textSecondary }]}>
                ${orderItem.price.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Order Footer */}
        <View style={[styles.orderFooter, { borderTopColor: theme.separator }]}>
          <View style={styles.totalContainer}>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total:</Text>
            <Text style={[styles.totalAmount, { color: theme.primary }]}>
              ${item.totalAmount.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.actionButtons}>
            {item.status === 'delivered' && (
              <>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.inputBackground }]}>
                  <Ionicons name="star-outline" size={16} color={theme.textSecondary} />
                  <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Rate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
                  <Ionicons name="repeat-outline" size={16} color="#fff" />
                  <Text style={styles.primaryButtonText}>Reorder</Text>
                </TouchableOpacity>
              </>
            )}
            {item.status === 'on_the_way' && (
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
                <Ionicons name="location-outline" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Track Order</Text>
              </TouchableOpacity>
            )}
            {item.status === 'preparing' && (
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: theme.inputBackground }]}>
                <Ionicons name="close-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <LinearGradient
        colors={[theme.primary + '20', theme.primary + '10']}
        style={styles.emptyIconContainer}
      >
        <Ionicons name="receipt-outline" size={48} color={theme.primary} />
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No orders yet</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        When you place orders, they'll appear here
      </Text>
      <TouchableOpacity style={styles.browseButton}>
        <LinearGradient
          colors={theme.primaryGradient as [string, string]}
          style={styles.browseButtonGradient}
        >
          <Text style={styles.browseButtonText}>Browse Restaurants</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSubtitle}>Track your delicious meals</Text>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {filters.map(renderFilterTab)}
        </ScrollView>
      </View>

      {/* Orders List */}
      {filteredOrders.length > 0 ? (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
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
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {renderEmptyState()}
        </ScrollView>
      )}
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
  filterContainer: {
    borderBottomWidth: 1,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 25,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterBadge: {
    marginLeft: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  ordersList: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyScrollContainer: {
    flexGrow: 1,
  },
  orderCard: {
    borderRadius: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    padding: 16,
  },
  restaurantImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 12,
  },
  orderInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 13,
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  deliveryTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  itemsList: {
    marginBottom: 16,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  itemName: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderFooter: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 4,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  browseButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  browseButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrdersScreen;