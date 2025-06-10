import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';

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

const OrdersScreen = () => {
  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>('all');

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
      case 'preparing':
        return '#F59E0B';
      case 'on_the_way':
        return '#3B82F6';
      case 'delivered':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'preparing':
        return 'Preparing';
      case 'on_the_way':
        return 'On the way';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'preparing':
        return '👨‍🍳';
      case 'on_the_way':
        return '🚚';
      case 'delivered':
        return '✅';
      case 'cancelled':
        return '❌';
      default:
        return '❓';
    }
  };

  const filteredOrders = selectedFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === selectedFilter);

  const filters: { key: OrderFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'preparing', label: 'Preparing', count: orders.filter(o => o.status === 'preparing').length },
    { key: 'on_the_way', label: 'On the way', count: orders.filter(o => o.status === 'on_the_way').length },
    { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
  ];

  const renderFilterTab = (filter: { key: OrderFilter; label: string; count: number }) => (
    <TouchableOpacity
      key={filter.key}
      style={[
        styles.filterTab,
        selectedFilter === filter.key && styles.activeFilterTab,
      ]}
      onPress={() => setSelectedFilter(filter.key)}
    >
      <Text
        style={[
          styles.filterTabText,
          selectedFilter === filter.key && styles.activeFilterTabText,
        ]}
      >
        {filter.label}
      </Text>
      {filter.count > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{filter.count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Image source={{ uri: item.restaurantImage }} style={styles.restaurantImage} />
        <View style={styles.orderInfo}>
          <Text style={styles.restaurantName}>{item.restaurantName}</Text>
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          <Text style={styles.orderDate}>{item.orderDate}</Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
          {item.deliveryTime && (
            <Text style={styles.deliveryTime}>{item.deliveryTime}</Text>
          )}
        </View>
      </View>

      <View style={styles.orderContent}>
        <View style={styles.itemsList}>
          {item.items.map((orderItem, index) => (
            <View key={orderItem.id} style={styles.orderItem}>
              <Text style={styles.itemName}>
                {orderItem.quantity}x {orderItem.name}
              </Text>
              <Text style={styles.itemPrice}>${orderItem.price.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalAmount}>${item.totalAmount.toFixed(2)}</Text>
          </View>
          
          <View style={styles.actionButtons}>
            {item.status === 'delivered' && (
              <>
                <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Rate Order</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Reorder</Text>
                </TouchableOpacity>
              </>
            )}
            {item.status === 'on_the_way' && (
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Track Order</Text>
              </TouchableOpacity>
            )}
            {item.status === 'preparing' && (
              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancel Order</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No orders yet</Text>
      <Text style={styles.emptySubtitle}>
        When you place orders, they'll appear here
      </Text>
      <TouchableOpacity style={styles.browseButton}>
        <Text style={styles.browseButtonText}>Browse Restaurants</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
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
        />
      ) : (
        renderEmptyState()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  activeFilterTab: {
    backgroundColor: '#FF6B35',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeFilterTabText: {
    color: '#fff',
  },
  filterBadge: {
    marginLeft: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 6,
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
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  restaurantImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  orderInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusIcon: {
    fontSize: 12,
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
    color: '#FF6B35',
  },
  orderContent: {
    padding: 16,
  },
  itemsList: {
    marginBottom: 16,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemName: {
    fontSize: 14,
    color: '#2D3748',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  orderFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrdersScreen;