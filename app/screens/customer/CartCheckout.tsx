import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  isAvailable: boolean;
  preparationTime: number;
  restaurantId: string;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

interface Restaurant {
  id: string;
  name: string;
  deliveryFee: number;
  minimumOrder: number;
  serviceCharge: number;
  taxRate: number;
  estimatedDeliveryTime: string;
  address: string;
  phone: string;
  imageUrl?: string;
}

interface DeliveryAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'mobile_money' | 'cash';
  name: string;
  details: string;
  isDefault: boolean;
}

const CartCheckoutScreen = ({ 
  user, 
  cart, 
  onBack, 
  onOrderPlaced,
  userData // Add this new prop
}: { 
  user: User;
  cart: CartItem[];
  onBack: () => void;
  onOrderPlaced: () => void;
  userData?: {
    name?: string;
    phoneNumber?: string;
    [key: string]: any;
  };
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddress | null>(null);
  const [paymentMethods] = useState<PaymentMethod[]>([
    { id: '1', type: 'mobile_money', name: 'M-Pesa', details: '**** 123', isDefault: true },
    { id: '2', type: 'card', name: 'Visa Card', details: '**** 4532', isDefault: false },
    { id: '3', type: 'cash', name: 'Cash on Delivery', details: 'Pay when delivered', isDefault: false },
  ]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [updatedCart, setUpdatedCart] = useState<CartItem[]>(cart);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      if (cart.length > 0) {
        await loadRestaurant(cart[0].menuItem.restaurantId);
        await loadAddresses();
      }
      
      // Set default payment method
      const defaultPayment = paymentMethods.find(p => p.isDefault);
      if (defaultPayment) {
        setSelectedPayment(defaultPayment);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load checkout information');
    } finally {
      setLoading(false);
    }
  };

  const loadRestaurant = async (restaurantId: string) => {
    try {
      const restaurantDoc = await getDoc(doc(FIREBASE_DB, 'restaurants', restaurantId));
      
      if (restaurantDoc.exists()) {
        const data = restaurantDoc.data();
        setRestaurant({
          id: restaurantDoc.id,
          name: data.name || 'Unknown Restaurant',
          deliveryFee: data.deliveryFee || 0,
          minimumOrder: data.minimumOrder || 0,
          serviceCharge: data.serviceCharge || 0,
          taxRate: data.taxRate || 0,
          estimatedDeliveryTime: data.estimatedDeliveryTime || '30-45 min',
          address: data.address || '',
          phone: data.phone || '',
          imageUrl: data.imageUrl || 'https://via.placeholder.com/50x50?text=Restaurant',
        });
      }
    } catch (error) {
      console.error('Error loading restaurant:', error);
    }
  };

  const loadAddresses = async () => {
    // Mock addresses - in real app, load from userService
    const mockAddresses: DeliveryAddress[] = [
      {
        id: '1',
        label: 'Home',
        street: '123 Riverside Drive',
        city: 'Nairobi',
        state: 'Nairobi County',
        zipCode: '00100',
        country: 'Kenya',
        isDefault: true,
      },
      {
        id: '2',
        label: 'Office',
        street: '456 Kenyatta Avenue',
        city: 'Nairobi',
        state: 'Nairobi County',
        zipCode: '00200',
        country: 'Kenya',
        isDefault: false,
      },
    ];
    
    setAddresses(mockAddresses);
    const defaultAddress = mockAddresses.find(addr => addr.isDefault);
    if (defaultAddress) {
      setSelectedAddress(defaultAddress);
    }
  };

  const updateItemQuantity = (itemIndex: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      // Remove item from cart
      const newCart = updatedCart.filter((_, index) => index !== itemIndex);
      setUpdatedCart(newCart);
      
      if (newCart.length === 0) {
        Alert.alert('Cart Empty', 'Your cart is now empty', [
          { text: 'OK', onPress: onBack }
        ]);
      }
    } else {
      // Update quantity
      const newCart = updatedCart.map((item, index) => 
        index === itemIndex ? { ...item, quantity: newQuantity } : item
      );
      setUpdatedCart(newCart);
    }
  };

  const removeItem = (itemIndex: number) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => updateItemQuantity(itemIndex, 0)
        }
      ]
    );
  };

  const getSubtotal = () => {
    return updatedCart.reduce((total, item) => total + (item.menuItem.price * item.quantity), 0);
  };

  const getServiceCharge = () => {
    return restaurant ? (getSubtotal() * restaurant.serviceCharge / 100) : 0;
  };

  const getTax = () => {
    return restaurant ? (getSubtotal() * restaurant.taxRate / 100) : 0;
  };

  const getDeliveryFee = () => {
    return restaurant?.deliveryFee || 0;
  };

  const getTotal = () => {
    return getSubtotal() + getServiceCharge() + getTax() + getDeliveryFee();
  };

  const canPlaceOrder = () => {
    if (!restaurant || !selectedAddress || !selectedPayment) return false;
    return getSubtotal() >= restaurant.minimumOrder;
  };

  const placeOrder = async () => {
    if (!canPlaceOrder() || !restaurant || !selectedAddress || !selectedPayment) {
      Alert.alert('Error', 'Please complete all required fields');
      return;
    }

    try {
      setPlacing(true);

      // Get user's name from various possible sources
      const userName = user.displayName || 
                      userData?.name || 
                      selectedAddress.label || 
                      user.email?.split('@')[0] || 
                      'Customer';

      const orderData = {
        userId: user.uid,
        userEmail: user.email || '',
        
        // Add customer information for restaurant display
        customerName: userName,
        customerPhone: userData?.phoneNumber || 'No phone provided',
        
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantImage: restaurant.imageUrl || 'https://via.placeholder.com/50x50?text=Restaurant',
        
        items: updatedCart.map(item => ({
          menuItemId: item.menuItem.id,
          name: item.menuItem.name,
          price: item.menuItem.price,
          quantity: item.quantity,
          ...(item.specialInstructions && { specialInstructions: item.specialInstructions }),
          subtotal: item.menuItem.price * item.quantity,
        })),
        
        deliveryAddress: {
          label: selectedAddress.label,
          street: selectedAddress.street,
          city: selectedAddress.city,
          state: selectedAddress.state,
          zipCode: selectedAddress.zipCode,
          country: selectedAddress.country,
        },
        
        paymentMethod: {
          type: selectedPayment.type,
          name: selectedPayment.name,
        },
        
        ...(deliveryInstructions.trim() && { deliveryInstructions: deliveryInstructions.trim() }),
        
        pricing: {
          subtotal: getSubtotal(),
          serviceCharge: getServiceCharge(),
          tax: getTax(),
          deliveryFee: getDeliveryFee(),
          total: getTotal(),
        },
        
        status: 'pending',
        paymentStatus: selectedPayment.type === 'cash' ? 'pending' : 'paid',
        estimatedDeliveryTime: restaurant.estimatedDeliveryTime,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const orderRef = await addDoc(collection(FIREBASE_DB, 'orders'), orderData);
      
      Alert.alert(
        'Order Placed Successfully!',
        `Your order #${orderRef.id.slice(-6).toUpperCase()} has been placed. Estimated delivery: ${restaurant.estimatedDeliveryTime}`,
        [{ text: 'OK', onPress: onOrderPlaced }]
      );
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const renderCartItem = (item: CartItem, index: number) => (
    <View key={index} style={[styles.cartItem, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <Image 
        source={{ uri: item.menuItem.imageUrl }} 
        style={styles.itemImage}
        resizeMode="cover"
      />
      
      <View style={styles.itemDetails}>
        <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
          {item.menuItem.name}
        </Text>
        
        {item.specialInstructions && (
          <Text style={[styles.specialInstructions, { color: theme.textSecondary }]} numberOfLines={2}>
            Note: {item.specialInstructions}
          </Text>
        )}
        
        <View style={styles.itemFooter}>
          <Text style={[styles.itemPrice, { color: theme.primary }]}>
            {formatPrice(item.menuItem.price)}
          </Text>
          
          <View style={styles.quantityControls}>
            <TouchableOpacity 
              style={[styles.quantityButton, { backgroundColor: theme.inputBackground }]}
              onPress={() => updateItemQuantity(index, item.quantity - 1)}
            >
              <Ionicons name="remove" size={16} color={theme.text} />
            </TouchableOpacity>
            
            <Text style={[styles.quantityText, { color: theme.text }]}>{item.quantity}</Text>
            
            <TouchableOpacity 
              style={[styles.quantityButton, { backgroundColor: theme.inputBackground }]}
              onPress={() => updateItemQuantity(index, item.quantity + 1)}
            >
              <Ionicons name="add" size={16} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => removeItem(index)}
      >
        <Ionicons name="trash-outline" size={20} color={theme.error} />
      </TouchableOpacity>
    </View>
  );

  const renderAddressModal = () => (
    <Modal
      visible={showAddressModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowAddressModal(false)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Delivery Address</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.modalContent}>
          {addresses.map((address) => (
            <TouchableOpacity
              key={address.id}
              style={[
                styles.addressOption,
                { 
                  backgroundColor: theme.surface,
                  borderColor: selectedAddress?.id === address.id ? theme.primary : theme.border
                }
              ]}
              onPress={() => {
                setSelectedAddress(address);
                setShowAddressModal(false);
              }}
            >
              <View style={styles.addressInfo}>
                <View style={styles.addressHeader}>
                  <Text style={[styles.addressLabel, { color: theme.text }]}>{address.label}</Text>
                  {address.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: theme.success }]}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.addressText, { color: theme.textSecondary }]}>
                  {address.street}
                </Text>
                <Text style={[styles.addressText, { color: theme.textSecondary }]}>
                  {address.city}, {address.state} {address.zipCode}
                </Text>
              </View>
              
              {selectedAddress?.id === address.id && (
                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderPaymentModal = () => (
    <Modal
      visible={showPaymentModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Payment Method</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.modalContent}>
          {paymentMethods.map((payment) => (
            <TouchableOpacity
              key={payment.id}
              style={[
                styles.paymentOption,
                { 
                  backgroundColor: theme.surface,
                  borderColor: selectedPayment?.id === payment.id ? theme.primary : theme.border
                }
              ]}
              onPress={() => {
                setSelectedPayment(payment);
                setShowPaymentModal(false);
              }}
            >
              <View style={styles.paymentIconContainer}>
                <Ionicons 
                  name={
                    payment.type === 'mobile_money' ? 'phone-portrait' :
                    payment.type === 'card' ? 'card' : 'cash'
                  } 
                  size={24} 
                  color={theme.primary} 
                />
              </View>
              
              <View style={styles.paymentInfo}>
                <Text style={[styles.paymentName, { color: theme.text }]}>{payment.name}</Text>
                <Text style={[styles.paymentDetails, { color: theme.textSecondary }]}>{payment.details}</Text>
              </View>
              
              {selectedPayment?.id === payment.id && (
                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading checkout...</Text>
      </View>
    );
  }

  if (updatedCart.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="bag-outline" size={64} color={theme.textMuted} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Your cart is empty</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Add some delicious items to get started
        </Text>
        <TouchableOpacity 
          style={[styles.browseButton, { backgroundColor: theme.primary }]}
          onPress={onBack}
        >
          <Text style={styles.browseButtonText}>Browse Menu</Text>
        </TouchableOpacity>
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
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 24 }} />
        </View>
        
        {restaurant && (
          <View style={styles.restaurantInfo}>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
            <Text style={styles.deliveryTime}>Est. delivery: {restaurant.estimatedDeliveryTime}</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Cart Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Order Items ({updatedCart.length})
          </Text>
          {updatedCart.map(renderCartItem)}
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Delivery Address</Text>
          <TouchableOpacity 
            style={[styles.selectionCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
            onPress={() => setShowAddressModal(true)}
          >
            <View style={styles.selectionContent}>
              <Ionicons name="location" size={24} color={theme.primary} />
              <View style={styles.selectionDetails}>
                {selectedAddress ? (
                  <>
                    <Text style={[styles.selectionTitle, { color: theme.text }]}>
                      {selectedAddress.label}
                    </Text>
                    <Text style={[styles.selectionSubtitle, { color: theme.textSecondary }]}>
                      {selectedAddress.street}, {selectedAddress.city}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.selectionPlaceholder, { color: theme.textMuted }]}>
                    Select delivery address
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Method</Text>
          <TouchableOpacity 
            style={[styles.selectionCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
            onPress={() => setShowPaymentModal(true)}
          >
            <View style={styles.selectionContent}>
              <Ionicons 
                name={
                  selectedPayment?.type === 'mobile_money' ? 'phone-portrait' :
                  selectedPayment?.type === 'card' ? 'card' : 'cash'
                } 
                size={24} 
                color={theme.primary} 
              />
              <View style={styles.selectionDetails}>
                {selectedPayment ? (
                  <>
                    <Text style={[styles.selectionTitle, { color: theme.text }]}>
                      {selectedPayment.name}
                    </Text>
                    <Text style={[styles.selectionSubtitle, { color: theme.textSecondary }]}>
                      {selectedPayment.details}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.selectionPlaceholder, { color: theme.textMuted }]}>
                    Select payment method
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Delivery Instructions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Delivery Instructions (Optional)</Text>
          <TextInput
            style={[
              styles.instructionsInput,
              { 
                backgroundColor: theme.surface, 
                color: theme.text,
                borderColor: theme.border
              }
            ]}
            placeholder="Add delivery instructions (e.g., apartment number, gate code, etc.)"
            placeholderTextColor={theme.placeholder}
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Subtotal</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{formatPrice(getSubtotal())}</Text>
            </View>
            
            {getServiceCharge() > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Service Charge ({restaurant?.serviceCharge}%)
                </Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{formatPrice(getServiceCharge())}</Text>
              </View>
            )}
            
            {getTax() > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Tax ({restaurant?.taxRate}%)
                </Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{formatPrice(getTax())}</Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Delivery Fee</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {getDeliveryFee() === 0 ? 'Free' : formatPrice(getDeliveryFee())}
              </Text>
            </View>
            
            <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryTotalLabel, { color: theme.text }]}>Total</Text>
              <Text style={[styles.summaryTotalValue, { color: theme.primary }]}>{formatPrice(getTotal())}</Text>
            </View>
          </View>
        </View>

        {/* Minimum Order Warning */}
        {restaurant && getSubtotal() < restaurant.minimumOrder && (
          <View style={[styles.warningCard, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
            <Ionicons name="warning-outline" size={20} color={theme.warning} />
            <Text style={[styles.warningText, { color: theme.warning }]}>
              Minimum order amount is {formatPrice(restaurant.minimumOrder)}. 
              Add {formatPrice(restaurant.minimumOrder - getSubtotal())} more to proceed.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Place Order Button */}
      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity 
          style={[
            styles.placeOrderButton,
            { 
              backgroundColor: canPlaceOrder() ? theme.primary : theme.textMuted,
              opacity: canPlaceOrder() ? 1 : 0.6
            }
          ]}
          onPress={placeOrder}
          disabled={!canPlaceOrder() || placing}
        >
          {placing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.placeOrderButtonText}>
                Place Order • {formatPrice(getTotal())}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      {renderAddressModal()}
      {renderPaymentModal()}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
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
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  restaurantInfo: {
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  deliveryTime: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cartItem: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  specialInstructions: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectionSubtitle: {
    fontSize: 14,
  },
  selectionPlaceholder: {
    fontSize: 16,
  },
  instructionsInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  addressOption: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressInfo: {
    flex: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  defaultBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 14,
    marginBottom: 2,
  },
  paymentOption: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentDetails: {
    fontSize: 14,
  },
});

export default CartCheckoutScreen;