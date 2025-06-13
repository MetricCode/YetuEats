import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, getDocs, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  specialInstructions?: string;
  subtotal: number;
}

interface DeliveryAddress {
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface PaymentMethod {
  type: string;
  name: string;
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
  restaurantName: string;
  restaurantImage: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  orderDate: string;
  deliveryTime?: string;
  orderNumber: string;
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  deliveryInstructions?: string;
  pricing: OrderPricing;
  paymentStatus: string;
}

type OrderFilter = 'all' | 'pending' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';

const OrdersScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Set up real-time listener for orders
    const setupListener = () => {
      const ordersRef = collection(FIREBASE_DB, 'orders');
      const q = query(
        ordersRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribeListener = onSnapshot(q, (snapshot) => {
        const ordersData: Order[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          // Handle different timestamp formats
          let orderDate = new Date().toLocaleDateString();
          
          if (data.createdAt) {
            try {
              if (data.createdAt instanceof Timestamp) {
                orderDate = data.createdAt.toDate().toLocaleDateString();
              } else if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
                orderDate = data.createdAt.toDate().toLocaleDateString();
              } else if (data.createdAt.seconds) {
                orderDate = new Date(data.createdAt.seconds * 1000).toLocaleDateString();
              } else if (typeof data.createdAt === 'string') {
                orderDate = new Date(data.createdAt).toLocaleDateString();
              } else if (data.createdAt instanceof Date) {
                orderDate = data.createdAt.toLocaleDateString();
              }
            } catch (error) {
              console.warn('Error parsing createdAt:', error);
            }
          }

          ordersData.push({
            id: doc.id,
            restaurantName: data.restaurantName || 'Unknown Restaurant',
            restaurantImage: data.restaurantImage || 'https://via.placeholder.com/50x50?text=Restaurant',
            items: (data.items || []).map((item: any) => ({
              id: item.menuItemId || item.id || Math.random().toString(),
              name: item.name || 'Unknown Item',
              quantity: item.quantity || 1,
              price: item.price || 0,
              specialInstructions: item.specialInstructions,
              subtotal: item.subtotal || (item.price * item.quantity) || 0,
            })),
            totalAmount: data.pricing?.total || 0,
            status: data.status || 'pending',
            orderDate,
            deliveryTime: data.estimatedDeliveryTime,
            orderNumber: `#${doc.id.slice(-6).toUpperCase()}`,
            deliveryAddress: data.deliveryAddress || {},
            paymentMethod: data.paymentMethod || {},
            deliveryInstructions: data.deliveryInstructions,
            pricing: data.pricing || {
              subtotal: 0,
              serviceCharge: 0,
              tax: 0,
              deliveryFee: 0,
              total: 0,
            },
            paymentStatus: data.paymentStatus || 'pending',
          });
        });
        
        setOrders(ordersData);
        setLoading(false);
        setRefreshing(false);
      }, (error) => {
        console.error('Error fetching orders:', error);
        setLoading(false);
        setRefreshing(false);
      });

      setUnsubscribe(() => unsubscribeListener);
    };

    setupListener();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user.uid]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    
    try {
      // Fetch fresh data from Firestore
      const ordersRef = collection(FIREBASE_DB, 'orders');
      const q = query(
        ordersRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const ordersData: Order[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Handle different timestamp formats
        let orderDate = new Date().toLocaleDateString();
        
        if (data.createdAt) {
          try {
            if (data.createdAt instanceof Timestamp) {
              orderDate = data.createdAt.toDate().toLocaleDateString();
            } else if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
              orderDate = data.createdAt.toDate().toLocaleDateString();
            } else if (data.createdAt.seconds) {
              orderDate = new Date(data.createdAt.seconds * 1000).toLocaleDateString();
            } else if (typeof data.createdAt === 'string') {
              orderDate = new Date(data.createdAt).toLocaleDateString();
            } else if (data.createdAt instanceof Date) {
              orderDate = data.createdAt.toLocaleDateString();
            }
          } catch (error) {
            console.warn('Error parsing createdAt:', error);
          }
        }

        ordersData.push({
          id: doc.id,
          restaurantName: data.restaurantName || 'Unknown Restaurant',
          restaurantImage: data.restaurantImage || 'https://via.placeholder.com/50x50?text=Restaurant',
          items: (data.items || []).map((item: any) => ({
            id: item.menuItemId || item.id || Math.random().toString(),
            name: item.name || 'Unknown Item',
            quantity: item.quantity || 1,
            price: item.price || 0,
            specialInstructions: item.specialInstructions,
            subtotal: item.subtotal || (item.price * item.quantity) || 0,
          })),
          totalAmount: data.pricing?.total || 0,
          status: data.status || 'pending',
          orderDate,
          deliveryTime: data.estimatedDeliveryTime,
          orderNumber: `#${doc.id.slice(-6).toUpperCase()}`,
          deliveryAddress: data.deliveryAddress || {},
          paymentMethod: data.paymentMethod || {},
          deliveryInstructions: data.deliveryInstructions,
          pricing: data.pricing || {
            subtotal: 0,
            serviceCharge: 0,
            tax: 0,
            deliveryFee: 0,
            total: 0,
          },
          paymentStatus: data.paymentStatus || 'pending',
        });
      });
      
      setOrders(ordersData);
    } catch (error) {
      console.error('Error refreshing orders:', error);
      Alert.alert('Error', 'Failed to refresh orders. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [user.uid]);

  const cancelOrder = async (orderId: string) => {
    try {
      const orderRef = doc(FIREBASE_DB, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'cancelled',
        updatedAt: new Date(),
      });
      
      // Show success message
      Alert.alert('Success', 'Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      Alert.alert('Error', 'Failed to cancel order. Please try again.');
    }
  };

  const handleCancelOrder = (order: Order) => {
    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel order ${order.orderNumber}?`,
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => cancelOrder(order.id),
        },
      ]
    );
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return '#9CA3AF';
      case 'preparing': return '#F59E0B';
      case 'on_the_way': return '#3B82F6';
      case 'delivered': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return theme.textMuted;
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'preparing': return 'Preparing';
      case 'on_the_way': return 'On the way';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'preparing': return 'restaurant-outline';
      case 'on_the_way': return 'car-outline';
      case 'delivered': return 'checkmark-circle';
      case 'cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const filteredOrders = selectedFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === selectedFilter);

  const filters: { key: OrderFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
    { key: 'preparing', label: 'Preparing', count: orders.filter(o => o.status === 'preparing').length },
    { key: 'on_the_way', label: 'On the way', count: orders.filter(o => o.status === 'on_the_way').length },
    { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
    { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length },
  ];

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

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
      onPress={() => handleOrderPress(item)}
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
          {item.items.slice(0, 2).map((orderItem, index) => (
            <View key={`${orderItem.id}-${index}`} style={styles.orderItem}>
              <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                {orderItem.quantity}x {orderItem.name}
              </Text>
              <Text style={[styles.itemPrice, { color: theme.textSecondary }]}>
                {formatPrice(orderItem.price)}
              </Text>
            </View>
          ))}
          {item.items.length > 2 && (
            <Text style={[styles.moreItems, { color: theme.textMuted }]}>
              +{item.items.length - 2} more items
            </Text>
          )}
        </View>

        {/* Order Footer */}
        <View style={[styles.orderFooter, { borderTopColor: theme.separator }]}>
          <View style={styles.totalContainer}>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total:</Text>
            <Text style={[styles.totalAmount, { color: theme.primary }]}>
              {formatPrice(item.totalAmount)}
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
            {(item.status === 'pending' || item.status === 'preparing') && (
              <TouchableOpacity 
                style={[styles.secondaryButton, { backgroundColor: theme.inputBackground }]}
                onPress={() => handleCancelOrder(item)}
              >
                <Ionicons name="close-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderOrderDetailsModal = () => {
    if (!selectedOrder) return null;

    return (
      <Modal
        visible={showOrderModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowOrderModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Order Details</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Order Status */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <View style={styles.statusHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) }]}>
                  <Ionicons 
                    name={getStatusIcon(selectedOrder.status) as any} 
                    size={16} 
                    color="#fff" 
                    style={styles.statusIcon}
                  />
                  <Text style={styles.statusText}>{getStatusText(selectedOrder.status)}</Text>
                </View>
                <Text style={[styles.orderNumber, { color: theme.text, fontSize: 18, fontWeight: 'bold' }]}>
                  {selectedOrder.orderNumber}
                </Text>
              </View>
              
              <Text style={[styles.restaurantName, { color: theme.text, fontSize: 16, marginTop: 8 }]}>
                {selectedOrder.restaurantName}
              </Text>
              <Text style={[styles.orderDate, { color: theme.textSecondary, marginTop: 4 }]}>
                Ordered on {selectedOrder.orderDate}
              </Text>
              {selectedOrder.deliveryTime && (
                <Text style={[styles.deliveryTime, { color: theme.primary, marginTop: 4 }]}>
                  Est. delivery: {selectedOrder.deliveryTime}
                </Text>
              )}
            </View>

            {/* Order Items */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Items Ordered</Text>
              {selectedOrder.items.map((item, index) => (
                <View key={`${item.id}-${index}`} style={styles.detailItem}>
                  <View style={styles.itemLeft}>
                    <Text style={[styles.itemQuantity, { color: theme.primary }]}>{item.quantity}x</Text>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                      {item.specialInstructions && (
                        <Text style={[styles.specialInstructions, { color: theme.textSecondary }]}>
                          Note: {item.specialInstructions}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.itemPrice, { color: theme.text }]}>
                    {formatPrice(item.subtotal)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Delivery Address */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Delivery Address</Text>
              <View style={styles.addressContainer}>
                <Ionicons name="location" size={20} color={theme.primary} />
                <View style={styles.addressDetails}>
                  <Text style={[styles.addressLabel, { color: theme.text }]}>
                    {selectedOrder.deliveryAddress.label}
                  </Text>
                  <Text style={[styles.addressText, { color: theme.textSecondary }]}>
                    {selectedOrder.deliveryAddress.street}
                  </Text>
                  <Text style={[styles.addressText, { color: theme.textSecondary }]}>
                    {selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.state} {selectedOrder.deliveryAddress.zipCode}
                  </Text>
                </View>
              </View>
              {selectedOrder.deliveryInstructions && (
                <View style={[styles.instructionsContainer, { backgroundColor: theme.inputBackground }]}>
                  <Text style={[styles.instructionsLabel, { color: theme.textSecondary }]}>Delivery Instructions:</Text>
                  <Text style={[styles.instructionsText, { color: theme.text }]}>
                    {selectedOrder.deliveryInstructions}
                  </Text>
                </View>
              )}
            </View>

            {/* Payment Method */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Method</Text>
              <View style={styles.paymentContainer}>
                <Ionicons 
                  name={
                    selectedOrder.paymentMethod.type === 'mobile_money' ? 'phone-portrait' :
                    selectedOrder.paymentMethod.type === 'card' ? 'card' : 'cash'
                  } 
                  size={20} 
                  color={theme.primary} 
                />
                <Text style={[styles.paymentText, { color: theme.text }]}>
                  {selectedOrder.paymentMethod.name}
                </Text>
                <View style={[
                  styles.paymentStatus,
                  { backgroundColor: selectedOrder.paymentStatus === 'paid' ? theme.success : theme.warning }
                ]}>
                  <Text style={styles.paymentStatusText}>
                    {selectedOrder.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Order Summary */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Summary</Text>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {formatPrice(selectedOrder.pricing.subtotal)}
                </Text>
              </View>
              
              {selectedOrder.pricing.serviceCharge > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Service Charge</Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    {formatPrice(selectedOrder.pricing.serviceCharge)}
                  </Text>
                </View>
              )}
              
              {selectedOrder.pricing.tax > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Tax</Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    {formatPrice(selectedOrder.pricing.tax)}
                  </Text>
                </View>
              )}
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Delivery Fee</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {selectedOrder.pricing.deliveryFee === 0 ? 'Free' : formatPrice(selectedOrder.pricing.deliveryFee)}
                </Text>
              </View>
              
              <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryTotalLabel, { color: theme.text }]}>Total</Text>
                <Text style={[styles.summaryTotalValue, { color: theme.primary }]}>
                  {formatPrice(selectedOrder.pricing.total)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading orders...
        </Text>
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
            <Text style={styles.headerTitle}>My Orders</Text>
            <Text style={styles.headerSubtitle}>Track your delicious meals</Text>
          </View>
        </View>
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

      {/* Order Details Modal */}
      {renderOrderDetailsModal()}
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
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
  moreItems: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
    minWidth: 30,
  },
  itemInfo: {
    flex: 1,
  },
  specialInstructions: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressDetails: {
    marginLeft: 12,
    flex: 1,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    marginBottom: 2,
  },
  instructionsContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  instructionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 18,
  },
  paymentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  paymentStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paymentStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OrdersScreen;