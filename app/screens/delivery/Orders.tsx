import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  deliveryAddress: {
    label: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  deliveryFee: number;
  status: 'ready_for_pickup' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';
  estimatedTime: string;
  distance: string;
  deliveryInstructions?: string;
  pickedUpAt?: any;
  deliveredAt?: any;
  createdAt: any;
  rating?: number;
  feedback?: string;
}

type OrderFilter = 'all' | 'active' | 'completed' | 'cancelled';

const DeliveryOrdersScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [user.uid]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      const q = query(
        collection(FIREBASE_DB, 'orders'),
        where('deliveryPartnerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersList: DeliveryOrder[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          let orderDate = new Date().toLocaleDateString();
          if (data.createdAt) {
            try {
              if (data.createdAt instanceof Timestamp) {
                orderDate = data.createdAt.toDate().toLocaleDateString();
              } else if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
                orderDate = data.createdAt.toDate().toLocaleDateString();
              }
            } catch (error) {
              console.warn('Error parsing createdAt:', error);
            }
          }

          ordersList.push({
            id: doc.id,
            orderNumber: `#${doc.id.slice(-6).toUpperCase()}`,
            customerName: data.customerName || 'Customer',
            customerPhone: data.customerPhone || '',
            restaurantName: data.restaurantName || 'Restaurant',
            restaurantAddress: data.restaurantAddress || '',
            restaurantPhone: data.restaurantPhone || '',
            deliveryAddress: data.deliveryAddress || {},
            items: data.items || [],
            totalAmount: data.pricing?.total || 0,
            deliveryFee: data.pricing?.deliveryFee || 0,
            status: data.status,
            estimatedTime: data.estimatedDeliveryTime || '30 min',
            distance: data.deliveryDistance || '2.5 km',
            deliveryInstructions: data.deliveryInstructions,
            pickedUpAt: data.pickedUpAt,
            deliveredAt: data.deliveredAt,
            createdAt: data.createdAt,
            rating: data.deliveryRating,
            feedback: data.deliveryFeedback,
          });
        });
        
        setOrders(ordersList);
        setLoading(false);
        setRefreshing(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading orders:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === 'on_the_way') {
        updateData.pickedUpAt = new Date();
      } else if (newStatus === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      await updateDoc(doc(FIREBASE_DB, 'orders', orderId), updateData);
      Alert.alert('Success', 'Order status updated successfully!');
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const makePhoneCall = (phoneNumber: string) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  const openMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    Linking.openURL(url);
  };

  const getStatusColor = (status: DeliveryOrder['status']) => {
    switch (status) {
      case 'ready_for_pickup': return theme.info;
      case 'picked_up': return theme.warning;
      case 'on_the_way': return theme.primary;
      case 'delivered': return theme.success;
      case 'cancelled': return theme.error;
      default: return theme.textMuted;
    }
  };

  const getStatusText = (status: DeliveryOrder['status']) => {
    switch (status) {
      case 'ready_for_pickup': return 'Ready for Pickup';
      case 'picked_up': return 'Picked Up';
      case 'on_the_way': return 'On the Way';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  const filteredOrders = orders.filter(order => {
    switch (selectedFilter) {
      case 'active':
        return ['ready_for_pickup', 'picked_up', 'on_the_way'].includes(order.status);
      case 'completed':
        return order.status === 'delivered';
      case 'cancelled':
        return order.status === 'cancelled';
      default:
        return true;
    }
  });

  const filters: { key: OrderFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'active', label: 'Active', count: orders.filter(o => ['ready_for_pickup', 'picked_up', 'on_the_way'].includes(o.status)).length },
    { key: 'completed', label: 'Completed', count: orders.filter(o => o.status === 'delivered').length },
    { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length },
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

  const renderOrder = ({ item }: { item: DeliveryOrder }) => (
    <TouchableOpacity 
      style={[styles.orderCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      activeOpacity={0.7}
      onPress={() => {
        setSelectedOrder(item);
        setShowOrderModal(true);
      }}
    >
      {/* Order Header */}
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={[styles.orderNumber, { color: theme.text }]}>{item.orderNumber}</Text>
          <Text style={[styles.customerName, { color: theme.textSecondary }]}>{item.customerName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      {/* Order Details */}
      <View style={styles.orderContent}>
        <View style={styles.locationInfo}>
          <View style={styles.locationRow}>
            <Ionicons name="restaurant" size={16} color={theme.primary} />
            <Text style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.restaurantName}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={theme.success} />
            <Text style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.deliveryAddress.street}, {item.deliveryAddress.city}
            </Text>
          </View>
        </View>

        {/* Order Meta */}
        <View style={styles.orderMeta}>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Distance</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{item.distance}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Earnings</Text>
            <Text style={[styles.metaValue, { color: theme.success }]}>{formatPrice(item.deliveryFee)}</Text>
          </View>
          {item.rating && (
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Rating</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={12} color={theme.warning} />
                <Text style={[styles.ratingText, { color: theme.warning }]}>{item.rating.toFixed(1)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {['ready_for_pickup', 'picked_up', 'on_the_way'].includes(item.status) && (
          <View style={styles.actionButtons}>
            {item.status === 'ready_for_pickup' && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: theme.warning }]}
                onPress={() => updateOrderStatus(item.id, 'picked_up')}
              >
                <Text style={styles.actionButtonText}>Mark Picked Up</Text>
              </TouchableOpacity>
            )}
            {item.status === 'picked_up' && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={() => updateOrderStatus(item.id, 'on_the_way')}
              >
                <Text style={styles.actionButtonText}>On the Way</Text>
              </TouchableOpacity>
            )}
            {item.status === 'on_the_way' && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: theme.success }]}
                onPress={() => updateOrderStatus(item.id, 'delivered')}
              >
                <Text style={styles.actionButtonText}>Mark Delivered</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.callButton, { backgroundColor: theme.inputBackground }]}
              onPress={() => makePhoneCall(item.customerPhone)}
            >
              <Ionicons name="call" size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
        )}
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
                <Text style={[styles.orderNumber, { color: theme.text, fontSize: 20 }]}>
                  {selectedOrder.orderNumber}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(selectedOrder.status)}</Text>
                </View>
              </View>
              
              <View style={styles.orderTimeline}>
                <Text style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                  Order placed: {selectedOrder.createdAt?.toDate?.()?.toLocaleString() || 'Unknown'}
                </Text>
                {selectedOrder.pickedUpAt && (
                  <Text style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                    Picked up: {selectedOrder.pickedUpAt.toDate().toLocaleString()}
                  </Text>
                )}
                {selectedOrder.deliveredAt && (
                  <Text style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                    Delivered: {selectedOrder.deliveredAt.toDate().toLocaleString()}
                  </Text>
                )}
              </View>
            </View>

            {/* Restaurant Info */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="restaurant" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Restaurant</Text>
              </View>
              <Text style={[styles.infoText, { color: theme.text }]}>{selectedOrder.restaurantName}</Text>
              <Text style={[styles.infoSubtext, { color: theme.textSecondary }]}>
                {selectedOrder.restaurantAddress}
              </Text>
              {selectedOrder.restaurantPhone && (
                <TouchableOpacity 
                  style={styles.contactButton}
                  onPress={() => makePhoneCall(selectedOrder.restaurantPhone)}
                >
                  <Ionicons name="call" size={16} color={theme.primary} />
                  <Text style={[styles.contactText, { color: theme.primary }]}>
                    Call Restaurant
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.contactButton}
                onPress={() => openMaps(selectedOrder.restaurantAddress)}
              >
                <Ionicons name="navigate" size={16} color={theme.success} />
                <Text style={[styles.contactText, { color: theme.success }]}>
                  Get Directions
                </Text>
              </TouchableOpacity>
            </View>

            {/* Customer Info */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="person" size={20} color={theme.success} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Customer</Text>
              </View>
              <Text style={[styles.infoText, { color: theme.text }]}>{selectedOrder.customerName}</Text>
              <Text style={[styles.infoSubtext, { color: theme.textSecondary }]}>
                {selectedOrder.deliveryAddress.street}
              </Text>
              <Text style={[styles.infoSubtext, { color: theme.textSecondary }]}>
                {selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.state} {selectedOrder.deliveryAddress.zipCode}
              </Text>
              {selectedOrder.customerPhone && (
                <TouchableOpacity 
                  style={styles.contactButton}
                  onPress={() => makePhoneCall(selectedOrder.customerPhone)}
                >
                  <Ionicons name="call" size={16} color={theme.primary} />
                  <Text style={[styles.contactText, { color: theme.primary }]}>
                    Call Customer
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.contactButton}
                onPress={() => openMaps(`${selectedOrder.deliveryAddress.street}, ${selectedOrder.deliveryAddress.city}`)}
              >
                <Ionicons name="navigate" size={16} color={theme.success} />
                <Text style={[styles.contactText, { color: theme.success }]}>
                  Get Directions
                </Text>
              </TouchableOpacity>
            </View>

            {/* Delivery Instructions */}
            {selectedOrder.deliveryInstructions && (
              <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="information-circle" size={20} color={theme.warning} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Delivery Instructions</Text>
                </View>
                <Text style={[styles.infoText, { color: theme.text }]}>
                  {selectedOrder.deliveryInstructions}
                </Text>
              </View>
            )}

            {/* Order Items */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list" size={20} color={theme.info} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Items</Text>
              </View>
              {selectedOrder.items.map((item, index) => (
                <View key={index} style={styles.orderItem}>
                  <Text style={[styles.itemQuantity, { color: theme.primary }]}>{item.quantity}x</Text>
                  <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.itemPrice, { color: theme.textSecondary }]}>
                    {formatPrice(item.price)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Order Summary */}
            <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="receipt" size={20} color={theme.info} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Earnings Summary</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Order Total</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {formatPrice(selectedOrder.totalAmount)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Distance</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {selectedOrder.distance}
                </Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryTotalLabel, { color: theme.text }]}>Your Earnings</Text>
                <Text style={[styles.summaryTotalValue, { color: theme.success }]}>
                  {formatPrice(selectedOrder.deliveryFee)}
                </Text>
              </View>
            </View>

            {/* Rating & Feedback */}
            {selectedOrder.rating && (
              <View style={[styles.detailSection, { backgroundColor: theme.surface }]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="star" size={20} color={theme.warning} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Customer Rating</Text>
                </View>
                <View style={styles.ratingRow}>
                  <Text style={[styles.ratingValue, { color: theme.text }]}>{selectedOrder.rating.toFixed(1)}</Text>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Ionicons
                        key={star}
                        name={star <= selectedOrder.rating! ? "star" : "star-outline"}
                        size={16}
                        color={theme.warning}
                      />
                    ))}
                  </View>
                </View>
                {selectedOrder.feedback && (
                  <Text style={[styles.feedbackText, { color: theme.textSecondary }]}>
                    "{selectedOrder.feedback}"
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          {['ready_for_pickup', 'picked_up', 'on_the_way'].includes(selectedOrder.status) && (
            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
              <View style={styles.modalActions}>
                {selectedOrder.status === 'ready_for_pickup' && (
                  <TouchableOpacity 
                    style={[styles.modalActionButton, { backgroundColor: theme.warning }]}
                    onPress={() => {
                      updateOrderStatus(selectedOrder.id, 'picked_up');
                      setShowOrderModal(false);
                    }}
                  >
                    <Text style={styles.modalActionText}>Mark Picked Up</Text>
                  </TouchableOpacity>
                )}
                {selectedOrder.status === 'picked_up' && (
                  <TouchableOpacity 
                    style={[styles.modalActionButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      updateOrderStatus(selectedOrder.id, 'on_the_way');
                      setShowOrderModal(false);
                    }}
                  >
                    <Text style={styles.modalActionText}>On the Way</Text>
                  </TouchableOpacity>
                )}
                {selectedOrder.status === 'on_the_way' && (
                  <TouchableOpacity 
                    style={[styles.modalActionButton, { backgroundColor: theme.success }]}
                    onPress={() => {
                      updateOrderStatus(selectedOrder.id, 'delivered');
                      setShowOrderModal(false);
                    }}
                  >
                    <Text style={styles.modalActionText}>Mark Delivered</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading orders...</Text>
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
          <Text style={styles.headerTitle}>My Orders</Text>
          <Text style={styles.headerSubtitle}>Track your delivery history</Text>
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
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={[theme.primary + '20', theme.primary + '10']}
              style={styles.emptyIconContainer}
            >
              <Ionicons name="bicycle-outline" size={48} color={theme.primary} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No orders found</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              {selectedFilter === 'all' 
                ? 'Your delivery orders will appear here' 
                : `No ${selectedFilter} orders found`}
            </Text>
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 0,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderContent: {
    padding: 16,
  },
  locationInfo: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
    marginBottom: 12,
  },
  orderTimeline: {
    marginTop: 8,
  },
  timelineLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 14,
    marginBottom: 2,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  contactText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 30,
  },
  itemName: {
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 12,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  feedbackText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  modalFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeliveryOrdersScreen;