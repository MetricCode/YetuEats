// services/orderUtils.ts
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { FIREBASE_DB } from '../FirebaseConfig';

export interface OrderStats {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalSpent: number;
  favoriteRestaurant?: string;
  mostRecentOrderDate?: string;
}

export interface RecentOrder {
  id: string;
  restaurantName: string;
  totalAmount: number;
  status: string;
  orderDate: string;
  orderNumber: string;
}

/**
 * Get comprehensive order statistics for a user
 */
export const getUserOrderStats = async (userId: string): Promise<OrderStats> => {
  try {
    const ordersRef = collection(FIREBASE_DB, 'orders');
    const q = query(
      ordersRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        pendingOrders: 0,
        totalSpent: 0,
      };
    }

    const orders: any[] = [];
    const restaurantCounts: { [key: string]: number } = {};
    let totalSpent = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let pendingOrders = 0;
    let mostRecentOrderDate: string | undefined;

    snapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({ id: doc.id, ...data });

      // Count by status
      switch (data.status) {
        case 'delivered':
          completedOrders++;
          break;
        case 'cancelled':
          cancelledOrders++;
          break;
        case 'pending':
        case 'preparing':
        case 'on_the_way':
          pendingOrders++;
          break;
      }

      // Calculate total spent (only for completed orders)
      if (data.status === 'delivered' && data.pricing?.total) {
        totalSpent += data.pricing.total;
      }

      // Count restaurant orders for favorite
      if (data.restaurantName) {
        restaurantCounts[data.restaurantName] = (restaurantCounts[data.restaurantName] || 0) + 1;
      }

      // Get most recent order date
      if (!mostRecentOrderDate && data.createdAt) {
        try {
          if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
            mostRecentOrderDate = data.createdAt.toDate().toLocaleDateString();
          } else if (data.createdAt.seconds) {
            mostRecentOrderDate = new Date(data.createdAt.seconds * 1000).toLocaleDateString();
          }
        } catch (error) {
          console.warn('Error parsing order date:', error);
        }
      }
    });

    // Find favorite restaurant (most ordered from)
    const favoriteRestaurant = Object.keys(restaurantCounts).reduce((a, b) => 
      restaurantCounts[a] > restaurantCounts[b] ? a : b, ''
    );

    return {
      totalOrders: orders.length,
      completedOrders,
      cancelledOrders,
      pendingOrders,
      totalSpent,
      favoriteRestaurant: favoriteRestaurant || undefined,
      mostRecentOrderDate,
    };
  } catch (error) {
    console.error('Error fetching user order stats:', error);
    return {
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      pendingOrders: 0,
      totalSpent: 0,
    };
  }
};

/**
 * Get user's recent orders (last 3)
 */
export const getUserRecentOrders = async (userId: string): Promise<RecentOrder[]> => {
  try {
    const ordersRef = collection(FIREBASE_DB, 'orders');
    const q = query(
      ordersRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const snapshot = await getDocs(q);
    const recentOrders: RecentOrder[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      
      let orderDate = new Date().toLocaleDateString();
      if (data.createdAt) {
        try {
          if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
            orderDate = data.createdAt.toDate().toLocaleDateString();
          } else if (data.createdAt.seconds) {
            orderDate = new Date(data.createdAt.seconds * 1000).toLocaleDateString();
          }
        } catch (error) {
          console.warn('Error parsing order date:', error);
        }
      }

      recentOrders.push({
        id: doc.id,
        restaurantName: data.restaurantName || 'Unknown Restaurant',
        totalAmount: data.pricing?.total || 0,
        status: data.status || 'pending',
        orderDate,
        orderNumber: `#${doc.id.slice(-6).toUpperCase()}`,
      });
    });

    return recentOrders;
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    return [];
  }
};

/**
 * Get simple order count for quick display
 */
export const getUserOrderCount = async (userId: string): Promise<number> => {
  try {
    const ordersRef = collection(FIREBASE_DB, 'orders');
    const q = query(ordersRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error fetching order count:', error);
    return 0;
  }
};