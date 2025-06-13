// services/orderService.ts
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  limit,
  serverTimestamp,
  DocumentData,
  QuerySnapshot,
  Timestamp
} from 'firebase/firestore';
import { FIREBASE_DB } from '../FirebaseConfig';

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
  subtotal: number;
}

export interface DeliveryAddress {
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface PaymentMethod {
  type: 'card' | 'mobile_money' | 'cash';
  name: string;
}

export interface OrderPricing {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

export type OrderStatus = 'placed' | 'confirmed' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Order {
  id?: string;
  orderNumber?: string;
  userId: string;
  userEmail: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  deliveryInstructions?: string;
  pricing: OrderPricing;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  estimatedDeliveryTime: string;
  actualDeliveryTime?: string;
  createdAt?: any;
  updatedAt?: any;
  cancelledAt?: any;
  cancelReason?: string;
  cancelledBy?: 'customer' | 'restaurant' | 'system';
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  trackingCode?: string;
}

export interface CreateOrderData {
  userId: string;
  userEmail: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  deliveryInstructions?: string;
  pricing: OrderPricing;
  estimatedDeliveryTime: string;
}

export interface OrderFilters {
  userId?: string;
  restaurantId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export class OrderService {
  private static readonly COLLECTION_NAME = 'orders';

  /**
   * Create a new order
   */
  static async createOrder(orderData: CreateOrderData): Promise<string> {
    try {
      // Generate order number
      const orderNumber = this.generateOrderNumber();
      
      const order: Omit<Order, 'id'> = {
        ...orderData,
        orderNumber,
        status: 'placed',
        paymentStatus: orderData.paymentMethod.type === 'cash' ? 'pending' : 'paid',
        trackingCode: this.generateTrackingCode(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(FIREBASE_DB, this.COLLECTION_NAME), order);
      
      // Send notification to restaurant (in real app)
      await this.notifyRestaurant(orderData.restaurantId, docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating order:', error);
      throw new Error('Failed to create order');
    }
  }

  /**
   * Get orders with filters
   */
  static async getOrders(filters: OrderFilters = {}): Promise<Order[]> {
    try {
      let q = collection(FIREBASE_DB, this.COLLECTION_NAME);
      let queryConstraints: any[] = [];

      if (filters.userId) {
        queryConstraints.push(where('userId', '==', filters.userId));
      }

      if (filters.restaurantId) {
        queryConstraints.push(where('restaurantId', '==', filters.restaurantId));
      }

      if (filters.status) {
        queryConstraints.push(where('status', '==', filters.status));
      }

      if (filters.paymentStatus) {
        queryConstraints.push(where('paymentStatus', '==', filters.paymentStatus));
      }

      // Add ordering and limit
      queryConstraints.push(orderBy('createdAt', 'desc'));
      
      if (filters.limit) {
        queryConstraints.push(limit(filters.limit));
      }

      const ordersQuery = query(q, ...queryConstraints);
      const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(ordersQuery);
      
      const orders: Order[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to strings for easier handling
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          cancelledAt: data.cancelledAt?.toDate?.()?.toISOString() || data.cancelledAt,
        } as Order);
      });
      
      return orders;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw new Error('Failed to fetch orders');
    }
  }

  /**
   * Get a single order by ID
   */
  static async getOrder(orderId: string): Promise<Order | null> {
    try {
      const orders = await this.getOrders({ limit: 1 });
      return orders.find(order => order.id === orderId) || null;
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(
    orderId: string, 
    status: OrderStatus, 
    additionalData?: Partial<Order>
  ): Promise<void> {
    try {
      const orderRef = doc(FIREBASE_DB, this.COLLECTION_NAME, orderId);
      
      const updateData: any = {
        status,
        updatedAt: serverTimestamp(),
        ...additionalData,
      };

      // Handle special status updates
      if (status === 'cancelled') {
        updateData.cancelledAt = serverTimestamp();
      }

      if (status === 'delivered') {
        updateData.actualDeliveryTime = serverTimestamp();
      }

      await updateDoc(orderRef, updateData);
      
      // Send status update notification (in real app)
      await this.sendStatusNotification(orderId, status);
      
    } catch (error) {
      console.error('Error updating order status:', error);
      throw new Error('Failed to update order status');
    }
  }

  /**
   * Update payment status
   */
  static async updatePaymentStatus(
    orderId: string, 
    paymentStatus: PaymentStatus
  ): Promise<void> {
    try {
      const orderRef = doc(FIREBASE_DB, this.COLLECTION_NAME, orderId);
      
      await updateDoc(orderRef, {
        paymentStatus,
        updatedAt: serverTimestamp(),
      });
      
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw new Error('Failed to update payment status');
    }
  }

  /**
   * Cancel an order
   */
  static async cancelOrder(
    orderId: string, 
    cancelReason: string, 
    cancelledBy: 'customer' | 'restaurant' | 'system' = 'customer'
  ): Promise<void> {
    try {
      await this.updateOrderStatus(orderId, 'cancelled', {
        cancelReason,
        cancelledBy,
      });
      
      // Handle refund if payment was made
      await this.processRefundIfNeeded(orderId);
      
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw new Error('Failed to cancel order');
    }
  }

  /**
   * Assign driver to order
   */
  static async assignDriver(
    orderId: string, 
    driverId: string, 
    driverName: string, 
    driverPhone: string
  ): Promise<void> {
    try {
      await this.updateOrderStatus(orderId, 'on_the_way', {
        driverId,
        driverName,
        driverPhone,
      });
      
    } catch (error) {
      console.error('Error assigning driver:', error);
      throw new Error('Failed to assign driver');
    }
  }

  /**
   * Get customer orders
   */
  static async getCustomerOrders(
    userId: string, 
    status?: OrderStatus, 
    limitCount: number = 20
  ): Promise<Order[]> {
    return this.getOrders({
      userId,
      status,
      limit: limitCount,
    });
  }

  /**
   * Get restaurant orders
   */
  static async getRestaurantOrders(
    restaurantId: string, 
    status?: OrderStatus, 
    limitCount: number = 50
  ): Promise<Order[]> {
    return this.getOrders({
      restaurantId,
      status,
      limit: limitCount,
    });
  }

  /**
   * Get active orders (not delivered or cancelled)
   */
  static async getActiveOrders(userId?: string, restaurantId?: string): Promise<Order[]> {
    try {
      const allOrders = await this.getOrders({
        userId,
        restaurantId,
        limit: 100,
      });
      
      return allOrders.filter(order => 
        !['delivered', 'cancelled'].includes(order.status)
      );
    } catch (error) {
      console.error('Error fetching active orders:', error);
      throw new Error('Failed to fetch active orders');
    }
  }

  /**
   * Get order statistics
   */
  static async getOrderStatistics(
    userId?: string, 
    restaurantId?: string
  ): Promise<{
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    totalSpent?: number;
    totalRevenue?: number;
  }> {
    try {
      const orders = await this.getOrders({ userId, restaurantId });
      
      const stats = {
        total: orders.length,
        completed: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
        pending: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
        totalSpent: userId ? orders.reduce((sum, o) => sum + o.pricing.total, 0) : undefined,
        totalRevenue: restaurantId ? orders
          .filter(o => o.status === 'delivered')
          .reduce((sum, o) => sum + o.pricing.total, 0) : undefined,
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting order statistics:', error);
      throw new Error('Failed to get order statistics');
    }
  }

  /**
   * Search orders
   */
  static searchOrders(
    orders: Order[], 
    searchQuery: string
  ): Order[] {
    if (!searchQuery.trim()) return orders;
    
    const query = searchQuery.toLowerCase().trim();
    return orders.filter(order => 
      order.orderNumber?.toLowerCase().includes(query) ||
      order.restaurantName.toLowerCase().includes(query) ||
      order.trackingCode?.toLowerCase().includes(query) ||
      order.items.some(item => item.name.toLowerCase().includes(query))
    );
  }

  /**
   * Filter orders by date range
   */
  static filterOrdersByDateRange(
    orders: Order[], 
    startDate: Date, 
    endDate: Date
  ): Order[] {
    return orders.filter(order => {
      if (!order.createdAt) return false;
      
      const orderDate = typeof order.createdAt === 'string' 
        ? new Date(order.createdAt) 
        : order.createdAt.toDate();
        
      return orderDate >= startDate && orderDate <= endDate;
    });
  }

  /**
   * Get estimated delivery time based on order and restaurant data
   */
  static calculateEstimatedDeliveryTime(
    restaurantEstimate: string,
    orderComplexity: number = 1
  ): string {
    // Parse restaurant estimate (e.g., "30-45 min")
    const match = restaurantEstimate.match(/(\d+)-?(\d+)?\s*min/);
    if (!match) return restaurantEstimate;
    
    const minTime = parseInt(match[1]);
    const maxTime = parseInt(match[2] || match[1]);
    
    // Adjust based on order complexity
    const adjustedMin = Math.round(minTime * orderComplexity);
    const adjustedMax = Math.round(maxTime * orderComplexity);
    
    return `${adjustedMin}-${adjustedMax} min`;
  }

  /**
   * Generate order number
   */
  private static generateOrderNumber(): string {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Generate tracking code
   */
  private static generateTrackingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Send notification to restaurant (placeholder)
   */
  private static async notifyRestaurant(restaurantId: string, orderId: string): Promise<void> {
    // In a real app, this would send push notifications, emails, or SMS
    console.log(`New order notification sent to restaurant ${restaurantId} for order ${orderId}`);
  }

  /**
   * Send status update notification (placeholder)
   */
  private static async sendStatusNotification(orderId: string, status: OrderStatus): Promise<void> {
    // In a real app, this would send push notifications to the customer
    console.log(`Status update notification sent for order ${orderId}: ${status}`);
  }

  /**
   * Process refund if payment was made (placeholder)
   */
  private static async processRefundIfNeeded(orderId: string): Promise<void> {
    // In a real app, this would integrate with payment processors for refunds
    console.log(`Processing refund for cancelled order ${orderId}`);
  }

  /**
   * Format order for display
   */
  static formatOrderForDisplay(order: Order) {
    return {
      ...order,
      formattedDate: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '',
      formattedTime: order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : '',
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      statusColor: this.getStatusColor(order.status),
      canCancel: this.canCancelOrder(order),
      canReorder: order.status === 'delivered',
    };
  }

  /**
   * Get status color for UI
   */
  private static getStatusColor(status: OrderStatus): string {
    switch (status) {
      case 'placed':
      case 'confirmed':
        return '#F59E0B'; // Orange
      case 'preparing':
        return '#3B82F6'; // Blue
      case 'ready':
      case 'on_the_way':
        return '#8B5CF6'; // Purple
      case 'delivered':
        return '#10B981'; // Green
      case 'cancelled':
        return '#EF4444'; // Red
      default:
        return '#6B7280'; // Gray
    }
  }

  /**
   * Check if order can be cancelled
   */
  private static canCancelOrder(order: Order): boolean {
    return ['placed', 'confirmed'].includes(order.status) && 
           order.paymentStatus !== 'refunded';
  }

  /**
   * Get user-friendly status text
   */
  static getStatusText(status: OrderStatus): string {
    switch (status) {
      case 'placed':
        return 'Order Placed';
      case 'confirmed':
        return 'Order Confirmed';
      case 'preparing':
        return 'Being Prepared';
      case 'ready':
        return 'Ready for Pickup';
      case 'on_the_way':
        return 'On the Way';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  /**
   * Get payment status text
   */
  static getPaymentStatusText(status: PaymentStatus): string {
    switch (status) {
      case 'pending':
        return 'Payment Pending';
      case 'paid':
        return 'Paid';
      case 'failed':
        return 'Payment Failed';
      case 'refunded':
        return 'Refunded';
      default:
        return status;
    }
  }

  /**
   * Calculate order preparation complexity
   */
  static calculateOrderComplexity(items: OrderItem[]): number {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const hasSpecialInstructions = items.some(item => item.specialInstructions);
    
    let complexity = 1;
    
    // Increase complexity based on item count
    if (itemCount > 5) complexity += 0.2;
    if (itemCount > 10) complexity += 0.3;
    
    // Increase complexity for special instructions
    if (hasSpecialInstructions) complexity += 0.1;
    
    return Math.min(complexity, 2); // Cap at 2x
  }

  /**
   * Validate order data before creation
   */
  static validateOrderData(orderData: CreateOrderData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!orderData.userId) errors.push('User ID is required');
    if (!orderData.restaurantId) errors.push('Restaurant ID is required');
    if (!orderData.items || orderData.items.length === 0) errors.push('Order must contain at least one item');
    if (!orderData.deliveryAddress) errors.push('Delivery address is required');
    if (!orderData.paymentMethod) errors.push('Payment method is required');
    if (!orderData.pricing || orderData.pricing.total <= 0) errors.push('Valid pricing is required');

    // Validate items
    orderData.items.forEach((item, index) => {
      if (!item.name) errors.push(`Item ${index + 1}: Name is required`);
      if (!item.price || item.price <= 0) errors.push(`Item ${index + 1}: Valid price is required`);
      if (!item.quantity || item.quantity <= 0) errors.push(`Item ${index + 1}: Valid quantity is required`);
    });

    // Validate delivery address
    if (orderData.deliveryAddress) {
      if (!orderData.deliveryAddress.street) errors.push('Street address is required');
      if (!orderData.deliveryAddress.city) errors.push('City is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Usage example:
/*
import { OrderService, CreateOrderData } from '../services/orderService';

// Create an order
const orderData: CreateOrderData = {
  userId: user.uid,
  userEmail: user.email!,
  restaurantId: 'restaurant123',
  restaurantName: 'Pizza Palace',
  items: [
    {
      menuItemId: 'item123',
      name: 'Margherita Pizza',
      price: 15.99,
      quantity: 2,
      specialInstructions: 'Extra cheese',
      subtotal: 31.98,
    }
  ],
  deliveryAddress: {
    label: 'Home',
    street: '123 Main St',
    city: 'Nairobi',
    state: 'Nairobi County',
    zipCode: '00100',
    country: 'Kenya',
  },
  paymentMethod: {
    type: 'mobile_money',
    name: 'M-Pesa',
  },
  pricing: {
    subtotal: 31.98,
    serviceCharge: 3.20,
    tax: 5.12,
    deliveryFee: 2.50,
    total: 42.80,
  },
  estimatedDeliveryTime: '30-45 min',
};

const orderId = await OrderService.createOrder(orderData);

// Get customer orders
const customerOrders = await OrderService.getCustomerOrders(user.uid);

// Update order status
await OrderService.updateOrderStatus(orderId, 'preparing');

// Cancel order
await OrderService.cancelOrder(orderId, 'Customer requested cancellation');
*/