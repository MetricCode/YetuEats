import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
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
  limit
} from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

const { width: screenWidth } = Dimensions.get('window');

// Type definitions for order-related data
interface OrderItem {
  id?: string;
  name?: string;
  quantity?: number;
  price?: number;
  subtotal?: number;
  specialInstructions?: string;
}

interface DeliveryAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  label?: string;
  customerName?: string;
  phone?: string;
}

interface PaymentMethod {
  id?: string;
  name?: string;
  type?: string;
  details?: any;
}

interface OrderPricing {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

// Update the Order interface with enhanced customer fields
interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  deliveryInstructions?: string;
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
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  user?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

type OrderStatus = Order['status'];
type FilterType = 'all' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';

const RestaurantOrdersScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('pending'); // Default to pending for restaurants
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Filter options with counts
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    pending: 0,
    confirmed: 0,
    preparing: 0,
    ready: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
  });

  // Extract customer info utility function
  const extractCustomerInfo = (order: Order) => {
    const customerName = 
      order.customerName ||
      order.customer?.name ||
      order.user?.name ||
      order.deliveryAddress?.customerName ||
      order.deliveryAddress?.label ||
      order.userEmail?.split('@')[0] ||
      'Unknown Customer';
  
    const customerPhone = 
      order.customerPhone ||
      order.customer?.phone ||
      order.user?.phone ||
      order.deliveryAddress?.phone ||
      order.deliveryAddress?.phone ||
      'No phone provided';
  
    const customerEmail = 
      order.userEmail ||
      order.customer?.email ||
      order.user?.email ||
      'No email provided';
  
    return {
      name: customerName,
      phone: customerPhone,
      email: customerEmail
    };
  };
  
    // Real-time order listener
    useEffect(() => {
      if (!user) return;
  
      const ordersRef = collection(FIREBASE_DB, 'orders');
      const ordersQuery = query(
        ordersRef,
        where('restaurantId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
  
      const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
        const ordersList: Order[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const customerInfo = extractCustomerInfo(data as Order);
          
          ordersList.push({
            id: doc.id,
            orderNumber: data.orderNumber || `#${doc.id.slice(-6).toUpperCase()}`,
            userId: data.userId || '',
            userEmail: data.userEmail || '',
            customerName: customerInfo.name,
            customerPhone: customerInfo.phone,
            customer: data.customer,
            user: data.user,
            restaurantId: data.restaurantId || '',
            restaurantName: data.restaurantName || '',
            items: data.items || [],
            deliveryAddress: data.deliveryAddress || {},
            paymentMethod: data.paymentMethod || {},
            deliveryInstructions: data.deliveryInstructions || '',
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
          } as Order);
        });
  
        setOrders(ordersList);
        updateFilterCounts(ordersList);
        setLoading(false);
      }, (error) => {
        console.error('Error listening to orders:', error);
        setLoading(false);
      });
  
      return () => unsubscribe();
    }, [user]);

  // Update filter counts
  const updateFilterCounts = (ordersList: Order[]) => {
    const counts = {
      all: ordersList.length,
      pending: ordersList.filter(o => o.status === 'pending').length,
      confirmed: ordersList.filter(o => o.status === 'confirmed').length,
      preparing: ordersList.filter(o => o.status === 'preparing').length,
      ready: ordersList.filter(o => o.status === 'ready').length,
      out_for_delivery: ordersList.filter(o => o.status === 'out_for_delivery').length,
      delivered: ordersList.filter(o => o.status === 'delivered').length,
      cancelled: ordersList.filter(o => o.status === 'cancelled').length,
    };
    setFilterCounts(counts);
  };

  // Filter orders based on selected filter
  useEffect(() => {
    if (selectedFilter === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.status === selectedFilter));
    }
  }, [orders, selectedFilter]);

  // Accept/Confirm order
  const acceptOrder = async (orderId: string) => {
    setUpdating(true);
    try {
      const orderRef = doc(FIREBASE_DB, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      Alert.alert('Success', 'Order accepted successfully!');
    } catch (error) {
      console.error('Error accepting order:', error);
      Alert.alert('Error', 'Failed to accept order. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Reject/Cancel order
  const rejectOrder = async (orderId: string) => {
    Alert.alert(
      'Reject Order',
      'Are you sure you want to reject this order? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              const orderRef = doc(FIREBASE_DB, 'orders', orderId);
              await updateDoc(orderRef, {
                status: 'cancelled',
                updatedAt: serverTimestamp(),
              });
              
              Alert.alert('Order Rejected', 'The order has been rejected.');
            } catch (error) {
              console.error('Error rejecting order:', error);
              Alert.alert('Error', 'Failed to reject order. Please try again.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdating(true);
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
      
      // Close modal if order details are showing
      if (showOrderDetails && selectedOrder?.id === orderId) {
        setShowOrderDetails(false);
      }

      // Show success message with estimated time
      let message = `Order updated to ${getStatusText(newStatus)}`;
      if (newStatus === 'confirmed') {
        message += '\nEstimated preparation time: 15-30 minutes';
      } else if (newStatus === 'ready') {
        message += '\nCustomer has been notified for pickup/delivery';
      }
      
      Alert.alert('Success', message);
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Refresh orders
  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Get status color
  const getStatusColor = (status: OrderStatus) => {
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

  // Get status text
  const getStatusText = (status: OrderStatus) => {
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

  // Get next status options
  const getNextStatusOptions = (currentStatus: OrderStatus): OrderStatus[] => {
    switch (currentStatus) {
      case 'pending':
        return ['confirmed', 'cancelled'];
      case 'confirmed':
        return ['preparing', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['out_for_delivery', 'delivered'];
      case 'out_for_delivery':
        return ['delivered'];
      default:
        return [];
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
      } else if (timestamp instanceof Date) {
        orderTime = timestamp;
      } else if (typeof timestamp === 'string') {
        orderTime = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        orderTime = new Date(timestamp);
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

  // Calculate preparation time
  const getPreparationTime = (order: Order) => {
    try {
      const baseTime = 15;
      const items = order.items || [];
      const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      return baseTime + (itemCount * 2);
    } catch (error) {
      console.warn('Error calculating prep time:', error);
      return 30;
    }
  };

  const renderFilterTab = (filter: FilterType, label: string) => {
    const isSelected = selectedFilter === filter;
    const count = filterCounts[filter];
    
    return (
      <TouchableOpacity
        key={filter}
        style={[
          styles.filterTab,
          { 
            backgroundColor: isSelected ? theme.primary : theme.inputBackground,
            borderColor: isSelected ? theme.primary : 'transparent'
          }
        ]}
        onPress={() => setSelectedFilter(filter)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.filterTabText,
          { color: isSelected ? '#fff' : theme.textSecondary }
        ]}>
          {label}
        </Text>
        {count > 0 && (
          <View style={[
            styles.filterBadge,
            { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : theme.primary }
          ]}>
            <Text style={styles.filterBadgeText}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderOrderCard = ({ item: order }: { item: Order }) => {
    const isPending = order.status === 'pending';
    const customerInfo = extractCustomerInfo(order);
    const customerAddress = `${order.deliveryAddress?.street || ''}, ${order.deliveryAddress?.city || ''}`.trim();

    return (
      <TouchableOpacity
        style={[
          styles.orderCard, 
          { 
            backgroundColor: theme.surface, 
            shadowColor: theme.shadow,
            borderLeftWidth: isPending ? 4 : 0,
            borderLeftColor: isPending ? '#F59E0B' : 'transparent'
          }
        ]}
        onPress={() => {
          setSelectedOrder(order);
          setShowOrderDetails(true);
        }}
        activeOpacity={0.7}
      >
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <View style={styles.orderTitleRow}>
              <Text style={[styles.orderNumber, { color: theme.text }]}>
                {order.orderNumber}
              </Text>
              {isPending && (
                <View style={[styles.newOrderBadge, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.newOrderText}>NEW</Text>
                </View>
              )}
            </View>
            <Text style={[styles.customerName, { color: theme.textSecondary }]}>
              {customerInfo.name}
            </Text>
            <Text style={[styles.orderTime, { color: theme.textMuted }]}>
              {getTimeAgo(order.createdAt)}
            </Text>
          </View>
          
          <View style={styles.orderStatus}>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: getStatusColor(order.status) }
            ]}>
              <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
            </View>
            <Text style={[styles.orderAmount, { color: theme.primary }]}>
              {formatPrice(order.pricing?.total || 0)}
            </Text>
          </View>
        </View>

        {/* Customer Details */}
        <View style={styles.customerDetails}>
          {order.customerPhone && order.customerPhone !== 'No phone provided' && (
            <View style={styles.customerRow}>
              <Ionicons name="call" size={14} color={theme.textMuted} />
              <Text style={[styles.customerDetailText, { color: theme.textSecondary }]} numberOfLines={1}>
                {order.customerPhone}
              </Text>
            </View>
          )}
          <View style={styles.customerRow}>
            <Ionicons name="location" size={14} color={theme.textMuted} />
            <Text style={[styles.customerDetailText, { color: theme.textSecondary }]} numberOfLines={1}>
              {customerAddress || 'No address provided'}
            </Text>
          </View>
          <View style={styles.customerRow}>
            <Ionicons name="card" size={14} color={theme.textMuted} />
            <Text style={[styles.customerDetailText, { color: theme.textSecondary }]}>
              {order.paymentMethod?.name || 'Unknown'} • {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.orderItems}>
          <Text style={[styles.itemsLabel, { color: theme.textSecondary }]}>
            {(order.items || []).length} item{((order.items || []).length > 1) ? 's' : ''}:
          </Text>
          <Text style={[styles.itemsList, { color: theme.text }]} numberOfLines={2}>
            {(order.items || []).map(item => `${item.quantity || 1}x ${item.name || 'Unknown Item'}`).join(', ')}
          </Text>
        </View>

        {/* Quick Actions for Pending Orders */}
        {isPending && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.rejectButton, { backgroundColor: theme.error + '20', borderColor: theme.error }]}
              onPress={() => rejectOrder(order.id)}
              disabled={updating}
            >
              <Ionicons name="close" size={16} color={theme.error} />
              <Text style={[styles.rejectButtonText, { color: theme.error }]}>Reject</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: theme.success }]}
              onPress={() => acceptOrder(order.id)}
              disabled={updating}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Special Instructions */}
        {order.deliveryInstructions && (
          <View style={[styles.specialInstructions, { backgroundColor: theme.warning + '20' }]}>
            <Ionicons name="alert-circle" size={14} color={theme.warning} />
            <Text style={[styles.specialInstructionsText, { color: theme.warning }]}>
              {order.deliveryInstructions}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderStatusActionButton = (status: OrderStatus, isPrimary: boolean = false) => (
    <TouchableOpacity
      key={status}
      style={[
        styles.statusActionButton,
        isPrimary && styles.primaryActionButton,
        { 
          backgroundColor: isPrimary ? getStatusColor(status) : theme.inputBackground,
          borderColor: getStatusColor(status)
        }
      ]}
      onPress={() => {
        Alert.alert(
          'Update Order Status',
          `Change order status to "${getStatusText(status)}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm',
              onPress: () => updateOrderStatus(selectedOrder!.id, status)
            }
          ]
        );
      }}
      disabled={updating}
    >
      <Text style={[
        styles.statusActionText,
        { color: isPrimary ? '#fff' : getStatusColor(status) }
      ]}>
        {getStatusText(status)}
      </Text>
    </TouchableOpacity>
  );

  const renderOrderDetailsModal = () => {
    if (!selectedOrder) return null;

    const customerInfo = extractCustomerInfo(selectedOrder);
    const nextStatusOptions = getNextStatusOptions(selectedOrder.status);
    const prepTime = getPreparationTime(selectedOrder);

    return (
      <Modal
        visible={showOrderDetails}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowOrderDetails(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Order Details
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Order Summary */}
            <View style={[styles.detailsSection, { backgroundColor: theme.surface }]}>
              <View style={styles.detailsHeader}>
                <Text style={[styles.detailsTitle, { color: theme.text }]}>
                  {selectedOrder.orderNumber}
                </Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(selectedOrder.status) }
                ]}>
                  <Text style={styles.statusText}>
                    {getStatusText(selectedOrder.status)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.orderSummary}>
                <Text style={[styles.summaryAmount, { color: theme.primary }]}>
                  {formatPrice(selectedOrder.pricing?.total || 0)}
                </Text>
                <Text style={[styles.summaryTime, { color: theme.textSecondary }]}>
                  Ordered {getTimeAgo(selectedOrder.createdAt)}
                </Text>
                <Text style={[styles.summaryItems, { color: theme.textMuted }]}>
                  {(selectedOrder.items || []).length} items • Est. {prepTime} min
                </Text>
              </View>
            </View>

            {/* Customer Information */}
            <View style={[styles.detailsSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Customer Information</Text>
              <View style={styles.customerInfo}>
                <View style={styles.customerRow}>
                  <Ionicons name="person" size={18} color={theme.textSecondary} />
                  <Text style={[styles.customerText, { color: theme.text }]}>
                    {customerInfo.name}
                  </Text>
                </View>
                
                <View style={styles.customerRow}>
                  <Ionicons name="mail" size={18} color={theme.textSecondary} />
                  <Text style={[styles.customerText, { color: theme.text }]}>
                    {customerInfo.email}
                  </Text>
                </View>
                
                {customerInfo.phone && customerInfo.phone !== 'No phone provided' && (
                  <View style={styles.customerRow}>
                    <Ionicons name="call" size={18} color={theme.textSecondary} />
                    <TouchableOpacity 
                      onPress={() => {
                        Alert.alert(
                          'Call Customer',
                          `Do you want to call ${customerInfo.phone}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Call', 
                              onPress: () => console.log('Calling:', customerInfo.phone)
                            }
                          ]
                        );
                      }}
                      style={styles.phoneButton}
                    >
                      <Text style={[styles.customerText, styles.phoneText, { color: theme.primary }]}>
                        {customerInfo.phone}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Order Items */}
            <View style={[styles.detailsSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Items</Text>
              {(selectedOrder.items || []).map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: theme.text }]}>
                      {item.quantity || 1}x {item.name || 'Unknown Item'}
                    </Text>
                    {item.specialInstructions && (
                      <Text style={[styles.itemInstructions, { color: theme.warning }]}>
                        Note: {item.specialInstructions}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.itemPrice, { color: theme.textSecondary }]}>
                    {formatPrice(item.subtotal || ((item.price || 0) * (item.quantity || 1)))}
                  </Text>
                </View>
              ))}
            </View>

            {/* Order Total */}
            <View style={[styles.detailsSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Total</Text>
              <View style={styles.totalBreakdown}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                  <Text style={[styles.totalValue, { color: theme.text }]}>
                    {formatPrice(selectedOrder.pricing?.subtotal || 0)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Service Charge</Text>
                  <Text style={[styles.totalValue, { color: theme.text }]}>
                    {formatPrice(selectedOrder.pricing?.serviceCharge || 0)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Tax</Text>
                  <Text style={[styles.totalValue, { color: theme.text }]}>
                    {formatPrice(selectedOrder.pricing?.tax || 0)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Delivery Fee</Text>
                  <Text style={[styles.totalValue, { color: theme.text }]}>
                    {formatPrice(selectedOrder.pricing?.deliveryFee || 0)}
                  </Text>
                </View>
                <View style={[styles.totalRow, styles.totalRowFinal]}>
                  <Text style={[styles.totalLabel, styles.totalLabelFinal, { color: theme.text }]}>
                    Total
                  </Text>
                  <Text style={[styles.totalValue, styles.totalValueFinal, { color: theme.primary }]}>
                    {formatPrice(selectedOrder.pricing?.total || 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Payment Information */}
            <View style={[styles.detailsSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Information</Text>
              <View style={styles.paymentInfo}>
                <View style={styles.paymentRow}>
                  <Text style={[styles.paymentLabel, { color: theme.textSecondary }]}>Method</Text>
                  <Text style={[styles.paymentValue, { color: theme.text }]}>
                    {selectedOrder.paymentMethod?.name || 'Unknown'}
                  </Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={[styles.paymentLabel, { color: theme.textSecondary }]}>Status</Text>
                  <View style={styles.paymentStatusContainer}>
                    <Ionicons 
                      name={selectedOrder.paymentStatus === 'paid' ? 'checkmark-circle' : 'time'} 
                      size={16} 
                      color={selectedOrder.paymentStatus === 'paid' ? theme.success : theme.warning} 
                    />
                    <Text style={[
                      styles.paymentStatusValue,
                      { color: selectedOrder.paymentStatus === 'paid' ? theme.success : theme.warning }
                    ]}>
                      {(selectedOrder.paymentStatus || 'pending').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Special Instructions */}
            {selectedOrder.deliveryInstructions && (
              <View style={[styles.detailsSection, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Special Instructions</Text>
                <View style={[styles.instructionsContainer, { backgroundColor: theme.warning + '20' }]}>
                  <Ionicons name="alert-circle" size={18} color={theme.warning} />
                  <Text style={[styles.instructionsText, { color: theme.text }]}>
                    {selectedOrder.deliveryInstructions}
                  </Text>
                </View>
              </View>
            )}

            {/* Status Actions */}
            {nextStatusOptions.length > 0 && (
              <View style={[styles.detailsSection, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Update Status</Text>
                <View style={styles.statusActions}>
                  {nextStatusOptions.map((status, index) => 
                    renderStatusActionButton(status, index === 0)
                  )}
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={64} color={theme.textMuted} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {selectedFilter === 'all' ? 'No Orders Yet' : `No ${getStatusText(selectedFilter as OrderStatus)} Orders`}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {selectedFilter === 'all' 
          ? 'Orders will appear here when customers place them'
          : `No orders with ${getStatusText(selectedFilter as OrderStatus).toLowerCase()} status`
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading orders...</Text>
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
          <View>
            <Text style={styles.headerTitle}>Restaurant Orders</Text>
            <Text style={styles.headerSubtitle}>Manage incoming orders</Text>
          </View>
          
          {/* Order Stats */}
          <View style={styles.headerStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{filterCounts.pending}</Text>
              <Text style={styles.statLabel}>New</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{filterCounts.preparing}</Text>
              <Text style={styles.statLabel}>Preparing</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: theme.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {renderFilterTab('pending', 'New Orders')}
          {renderFilterTab('confirmed', 'Confirmed')}
          {renderFilterTab('preparing', 'Preparing')}
          {renderFilterTab('ready', 'Ready')}
          {renderFilterTab('out_for_delivery', 'Out for Delivery')}
          {renderFilterTab('delivered', 'Delivered')}
          {renderFilterTab('all', 'All')}
        </ScrollView>
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
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
        ListEmptyComponent={renderEmptyState}
      />

      {renderOrderDetailsModal()}
      
      {/* Loading Overlay */}
      {updating && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: theme.surface }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingOverlayText, { color: theme.text }]}>
              Updating order...
            </Text>
          </View>
        </View>
      )}
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  headerStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
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
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  filterBadge: {
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
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  customerDetails: {
    marginBottom: 12,
    gap: 4,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerDetailText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
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
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  specialInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
  },
  specialInstructionsText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
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
  
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
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
  detailsSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  orderSummary: {
    alignItems: 'center',
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryTime: {
    fontSize: 14,
    marginBottom: 2,
  },
  summaryItems: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  customerInfo: {
    gap: 12,
  },
  customerText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemInstructions: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalBreakdown: {
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalLabelFinal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalValueFinal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  paymentInfo: {
    gap: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentStatusValue: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
  },
  instructionsText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  statusActions: {
    flexDirection: 'row',
    gap: 12,
  },
  statusActionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  primaryActionButton: {
    borderWidth: 0,
  },
  statusActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingOverlayText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  phoneButton: {
    marginLeft: 12,
    flex: 1,
  },
  phoneText: {
    textDecorationLine: 'underline',
  },
  addressColumn: {
    marginLeft: 12,
    flex: 1,
  },
});

export default RestaurantOrdersScreen;