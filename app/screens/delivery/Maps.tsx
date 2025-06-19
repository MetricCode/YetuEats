import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

const { width, height } = Dimensions.get('window');

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLocation: {
    latitude: number;
    longitude: number;
  };
  deliveryAddress: {
    label: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    latitude: number;
    longitude: number;
  };
  totalAmount: number;
  deliveryFee: number;
  status: 'ready_for_pickup' | 'picked_up' | 'on_the_way' | 'delivered';
  estimatedTime: string;
  distance: string;
  deliveryInstructions?: string;
  createdAt: any;
}

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  type: 'restaurant' | 'delivery' | 'current_location';
  title: string;
  subtitle?: string;
  order?: DeliveryOrder;
}

const DeliveryMapScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<DeliveryOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: -1.286389, // Nairobi coordinates
    longitude: 36.817223,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    loadMapData();
    getCurrentLocation();
  }, [user.uid]);

  const getCurrentLocation = async () => {
    try {
      // In a real app, you would use expo-location or react-native-geolocation
      // For now, using mock location (Nairobi)
      const mockLocation = {
        latitude: -1.286389,
        longitude: 36.817223,
      };
      setCurrentLocation(mockLocation);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Location Error', 'Unable to get your current location');
    }
  };

  const loadMapData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAvailableOrders(),
        loadActiveOrders(),
      ]);
    } catch (error) {
      console.error('Error loading map data:', error);
      Alert.alert('Error', 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableOrders = async () => {
    try {
      const q = query(
        collection(FIREBASE_DB, 'orders'),
        where('status', '==', 'ready_for_pickup'),
        where('deliveryId', '==', null),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders: DeliveryOrder[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          orders.push({
            id: doc.id,
            orderNumber: `#${doc.id.slice(-6).toUpperCase()}`,
            customerName: data.customerName || 'Customer',
            customerPhone: data.customerPhone || '',
            restaurantName: data.restaurantName || 'Restaurant',
            restaurantAddress: data.restaurantAddress || '',
            restaurantLocation: data.restaurantLocation || {
              latitude: -1.286389 + (Math.random() - 0.5) * 0.02,
              longitude: 36.817223 + (Math.random() - 0.5) * 0.02,
            },
            deliveryAddress: {
              ...data.deliveryAddress,
              latitude: data.deliveryAddress?.latitude || -1.286389 + (Math.random() - 0.5) * 0.02,
              longitude: data.deliveryAddress?.longitude || 36.817223 + (Math.random() - 0.5) * 0.02,
            },
            totalAmount: data.pricing?.total || 0,
            deliveryFee: data.pricing?.deliveryFee || 0,
            status: data.status,
            estimatedTime: data.estimatedDeliveryTime || '30 min',
            distance: data.deliveryDistance || '2.5 km',
            deliveryInstructions: data.deliveryInstructions,
            createdAt: data.createdAt,
          });
        });
        setAvailableOrders(orders);
        updateMapMarkers(orders, activeOrders);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading available orders:', error);
      setAvailableOrders([]);
    }
  };

  const loadActiveOrders = async () => {
    try {
      const q = query(
        collection(FIREBASE_DB, 'orders'),
        where('deliveryId', '==', user.uid),
        where('status', 'in', ['picked_up', 'on_the_way']),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders: DeliveryOrder[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          orders.push({
            id: doc.id,
            orderNumber: `#${doc.id.slice(-6).toUpperCase()}`,
            customerName: data.customerName || 'Customer',
            customerPhone: data.customerPhone || '',
            restaurantName: data.restaurantName || 'Restaurant',
            restaurantAddress: data.restaurantAddress || '',
            restaurantLocation: data.restaurantLocation || {
              latitude: -1.286389 + (Math.random() - 0.5) * 0.02,
              longitude: 36.817223 + (Math.random() - 0.5) * 0.02,
            },
            deliveryAddress: {
              ...data.deliveryAddress,
              latitude: data.deliveryAddress?.latitude || -1.286389 + (Math.random() - 0.5) * 0.02,
              longitude: data.deliveryAddress?.longitude || 36.817223 + (Math.random() - 0.5) * 0.02,
            },
            totalAmount: data.pricing?.total || 0,
            deliveryFee: data.pricing?.deliveryFee || 0,
            status: data.status,
            estimatedTime: data.estimatedDeliveryTime || '30 min',
            distance: data.deliveryDistance || '2.5 km',
            deliveryInstructions: data.deliveryInstructions,
            createdAt: data.createdAt,
          });
        });
        setActiveOrders(orders);
        updateMapMarkers(availableOrders, orders);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading active orders:', error);
      setActiveOrders([]);
    }
  };

  const updateMapMarkers = (available: DeliveryOrder[], active: DeliveryOrder[]) => {
    const markers: MapMarker[] = [];

    // Add current location marker
    if (currentLocation) {
      markers.push({
        id: 'current',
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        type: 'current_location',
        title: 'Your Location',
      });
    }

    // Add available order markers (restaurants)
    available.forEach(order => {
      markers.push({
        id: `restaurant-${order.id}`,
        latitude: order.restaurantLocation.latitude,
        longitude: order.restaurantLocation.longitude,
        type: 'restaurant',
        title: order.restaurantName,
        subtitle: `${order.distance} • ${formatPrice(order.deliveryFee)}`,
        order,
      });
    });

    // Add active order markers (both restaurant and delivery location)
    active.forEach(order => {
      if (order.status === 'picked_up') {
        // Show restaurant marker for picked up orders
        markers.push({
          id: `active-restaurant-${order.id}`,
          latitude: order.restaurantLocation.latitude,
          longitude: order.restaurantLocation.longitude,
          type: 'restaurant',
          title: order.restaurantName,
          subtitle: 'Picked Up',
          order,
        });
      }
      
      // Always show delivery location for active orders
      markers.push({
        id: `delivery-${order.id}`,
        latitude: order.deliveryAddress.latitude,
        longitude: order.deliveryAddress.longitude,
        type: 'delivery',
        title: order.customerName,
        subtitle: order.deliveryAddress.street,
        order,
      });
    });

    setMapMarkers(markers);
  };

  const acceptOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(FIREBASE_DB, 'orders', orderId), {
        deliveryId: user.uid,
        status: 'picked_up',
        pickedUpAt: new Date(),
      });
      setShowOrderModal(false);
      Alert.alert('Success', 'Order accepted! Navigate to the restaurant to pick it up.');
    } catch (error) {
      console.error('Error accepting order:', error);
      Alert.alert('Error', 'Failed to accept order');
    }
  };

  const handleMarkerPress = (marker: MapMarker) => {
    if (marker.order) {
      setSelectedOrder(marker.order);
      setShowOrderModal(true);
    }
  };

  const getNavigationDirections = (order: DeliveryOrder) => {
    // In a real app, this would open navigation app with directions
    const destination = order.status === 'picked_up' ? 
      order.deliveryAddress : order.restaurantLocation;
    
    Alert.alert(
      'Navigation',
      `This would open your navigation app with directions to ${
        order.status === 'picked_up' ? 'delivery location' : 'restaurant'
      }`,
      [{ text: 'OK' }]
    );
  };

  const renderOrderModal = () => {
    if (!selectedOrder) return null;

    const isActiveOrder = activeOrders.some(order => order.id === selectedOrder.id);

    return (
      <Modal
        visible={showOrderModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowOrderModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Order Details</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Order Header */}
            <View style={[styles.orderHeader, { backgroundColor: theme.surface }]}>
              <Text style={[styles.orderNumber, { color: theme.text }]}>{selectedOrder.orderNumber}</Text>
              <View style={[styles.statusBadge, { 
                backgroundColor: isActiveOrder ? theme.warning : theme.info 
              }]}>
                <Text style={styles.statusText}>
                  {isActiveOrder ? 'Active' : 'Available'}
                </Text>
              </View>
            </View>

            {/* Restaurant Info */}
            <View style={[styles.infoSection, { backgroundColor: theme.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="restaurant" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Restaurant</Text>
              </View>
              <Text style={[styles.infoText, { color: theme.text }]}>{selectedOrder.restaurantName}</Text>
              <Text style={[styles.infoSubtext, { color: theme.textSecondary }]}>
                {selectedOrder.restaurantAddress}
              </Text>
            </View>

            {/* Customer Info */}
            <View style={[styles.infoSection, { backgroundColor: theme.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="person" size={20} color={theme.success} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Customer</Text>
              </View>
              <Text style={[styles.infoText, { color: theme.text }]}>{selectedOrder.customerName}</Text>
              <Text style={[styles.infoSubtext, { color: theme.textSecondary }]}>
                {selectedOrder.deliveryAddress.street}, {selectedOrder.deliveryAddress.city}
              </Text>
              {selectedOrder.customerPhone && (
                <TouchableOpacity style={styles.phoneButton}>
                  <Ionicons name="call" size={16} color={theme.primary} />
                  <Text style={[styles.phoneText, { color: theme.primary }]}>
                    {selectedOrder.customerPhone}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Delivery Instructions */}
            {selectedOrder.deliveryInstructions && (
              <View style={[styles.infoSection, { backgroundColor: theme.surface }]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="information-circle" size={20} color={theme.warning} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Instructions</Text>
                </View>
                <Text style={[styles.infoText, { color: theme.text }]}>
                  {selectedOrder.deliveryInstructions}
                </Text>
              </View>
            )}

            {/* Order Summary */}
            <View style={[styles.infoSection, { backgroundColor: theme.surface }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="receipt" size={20} color={theme.info} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Summary</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Order Total</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {formatPrice(selectedOrder.totalAmount)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Your Earnings</Text>
                <Text style={[styles.summaryValue, { color: theme.success }]}>
                  {formatPrice(selectedOrder.deliveryFee)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Distance</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {selectedOrder.distance}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Est. Time</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {selectedOrder.estimatedTime}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            {isActiveOrder ? (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={() => getNavigationDirections(selectedOrder)}
              >
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Get Directions</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: theme.success }]}
                onPress={() => acceptOrder(selectedOrder.id)}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Accept Order</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading map...</Text>
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
        <Text style={styles.headerTitle}>Delivery Map</Text>
        <Text style={styles.headerSubtitle}>Find nearby orders and navigate</Text>
      </LinearGradient>

      {/* Map Placeholder */}
      <View style={[styles.mapContainer, { backgroundColor: theme.surface }]}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={64} color={theme.primary} />
          <Text style={[styles.mapPlaceholderText, { color: theme.text }]}>
            Interactive Map View
          </Text>
          <Text style={[styles.mapPlaceholderSubtext, { color: theme.textSecondary }]}>
            Real map integration with markers for restaurants and delivery locations
          </Text>
        </View>
      </View>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity 
          style={[styles.controlButton, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
          onPress={getCurrentLocation}
        >
          <Ionicons name="locate" size={24} color={theme.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.controlButton, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
          onPress={loadMapData}
        >
          <Ionicons name="refresh" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet with Orders */}
      <View style={[styles.bottomSheet, { backgroundColor: theme.surface }]}>
        <View style={[styles.bottomSheetHandle, { backgroundColor: theme.separator }]} />
        
        <View style={styles.ordersContainer}>
          <Text style={[styles.ordersTitle, { color: theme.text }]}>
            Available Orders ({availableOrders.length})
          </Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ordersList}
          >
            {availableOrders.map(order => (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderCard, { backgroundColor: theme.background, shadowColor: theme.shadow }]}
                onPress={() => {
                  setSelectedOrder(order);
                  setShowOrderModal(true);
                }}
              >
                <Text style={[styles.orderCardTitle, { color: theme.text }]}>{order.restaurantName}</Text>
                <Text style={[styles.orderCardSubtitle, { color: theme.textSecondary }]}>
                  {order.distance} • {order.estimatedTime}
                </Text>
                <Text style={[styles.orderCardEarnings, { color: theme.success }]}>
                  {formatPrice(order.deliveryFee)}
                </Text>
              </TouchableOpacity>
            ))}
            
            {availableOrders.length === 0 && (
              <View style={styles.emptyOrders}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No orders available nearby
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Order Details Modal */}
      {renderOrderModal()}
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
    zIndex: 1,
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
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mapPlaceholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  mapControls: {
    position: 'absolute',
    right: 20,
    top: 140,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  ordersContainer: {
    paddingHorizontal: 20,
  },
  ordersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  ordersList: {
    paddingRight: 20,
  },
  orderCard: {
    width: 200,
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  orderCardSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  orderCardEarnings: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyOrders: {
    width: width - 40,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
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
  infoSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 14,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  phoneText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeliveryMapScreen;