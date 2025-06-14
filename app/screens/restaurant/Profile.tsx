import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatCurrency, formatPrice, parseCurrency, validatePrice, getCurrencyPlaceholder } from '../../../services/currency';

const { width } = Dimensions.get('window');

interface RestaurantInfo {
  name: string;
  description: string;
  cuisine: string[];
  phone: string;
  email: string;
  address: string;
  hours: {
    [key: string]: { open: string; close: string; isOpen: boolean };
  };
  rating: number;
  totalReviews: number;
  deliveryRadius: number;
  minimumOrder: number;
  deliveryFee: number;
  estimatedDeliveryTime: string;
  isActive: boolean;
  totalOrders: number;
  monthlyRevenue: number;
  serviceCharge: number;
  taxRate: number;
  autoAcceptOrders: boolean; // New field for auto-accept functionality
  notificationsEnabled: boolean; // Store notifications preference
  createdAt?: any;
  updatedAt?: any;
}

interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  pricing: OrderPricing;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: any;
  updatedAt: any;
  deliveredAt?: any;
  confirmedAt?: any;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  category: string;
}

interface OrderPricing {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

interface RestaurantStats {
  totalOrders: number;
  completedOrders: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  todayRevenue: number;
  averageOrderValue: number;
  pendingOrders: number;
  rating: number;
  totalReviews: number;
  favoriteItem?: string;
}

interface ProfileMenuSection {
  title: string;
  items: ProfileMenuItem[];
}

interface ProfileMenuItem {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  action: 'navigate' | 'toggle' | 'action';
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  iconColor?: string;
  badge?: string;
}

const RestaurantProfileScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // State for restaurant data and statistics
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo>({
    name: '',
    description: '',
    cuisine: [],
    phone: '',
    email: user.email || '',
    address: '',
    hours: {
      monday: { open: '09:00', close: '21:00', isOpen: true },
      tuesday: { open: '09:00', close: '21:00', isOpen: true },
      wednesday: { open: '09:00', close: '21:00', isOpen: true },
      thursday: { open: '09:00', close: '21:00', isOpen: true },
      friday: { open: '09:00', close: '22:00', isOpen: true },
      saturday: { open: '10:00', close: '22:00', isOpen: true },
      sunday: { open: '10:00', close: '20:00', isOpen: true },
    },
    rating: 0,
    totalReviews: 0,
    deliveryRadius: 5.0,
    minimumOrder: 300,
    deliveryFee: 100,
    estimatedDeliveryTime: '30-45 min',
    isActive: false,
    totalOrders: 0,
    monthlyRevenue: 0,
    serviceCharge: 50,
    taxRate: 16,
    autoAcceptOrders: false,
    notificationsEnabled: true,
  });

  const [restaurantStats, setRestaurantStats] = useState<RestaurantStats>({
    totalOrders: 0,
    completedOrders: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    todayRevenue: 0,
    averageOrderValue: 0,
    pendingOrders: 0,
    rating: 0,
    totalReviews: 0,
  });

  // Form state for editing
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    minimumOrder: '300',
    deliveryFee: '100',
    serviceCharge: '50',
    deliveryRadius: '5.0',
    estimatedDeliveryTime: '30-45 min',
    selectedCuisines: [] as string[],
  });

  // Hours form state
  const [hoursForm, setHoursForm] = useState(restaurantInfo.hours);

  const daysOfWeek = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  const timeSlots = [
    '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30',
    '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30',
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30',
  ];

  // Calculate restaurant statistics from orders
  const calculateRestaurantStats = (ordersList: Order[]): RestaurantStats => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - (now.getDay() * 24 * 60 * 60 * 1000));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Helper function to check if date is in range
    const isInRange = (orderDate: any, startDate: Date) => {
      let date: Date;
      if (orderDate?.toDate) {
        date = orderDate.toDate();
      } else if (orderDate?.seconds) {
        date = new Date(orderDate.seconds * 1000);
      } else if (orderDate instanceof Date) {
        date = orderDate;
      } else {
        return false;
      }
      return date >= startDate;
    };

    // Filter orders by timeframes
    const todayOrders = ordersList.filter(o => isInRange(o.createdAt, startOfToday));
    const weekOrders = ordersList.filter(o => isInRange(o.createdAt, startOfWeek));
    const monthOrders = ordersList.filter(o => isInRange(o.createdAt, startOfMonth));

    // Calculate revenue for completed orders
    const calculateRevenue = (orders: Order[]) => 
      orders.filter(o => o.status === 'delivered' && o.paymentStatus === 'paid')
            .reduce((sum, o) => sum + (o.pricing?.total || 0), 0);

    // Calculate stats
    const completedOrders = ordersList.filter(o => o.status === 'delivered').length;
    const pendingOrders = ordersList.filter(o => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length;
    
    // Average order value from completed orders
    const completedOrdersWithValue = ordersList.filter(o => o.status === 'delivered' && o.pricing?.total);
    const averageOrderValue = completedOrdersWithValue.length > 0 
      ? completedOrdersWithValue.reduce((sum, o) => sum + (o.pricing?.total || 0), 0) / completedOrdersWithValue.length
      : 0;

    // Find most popular item
    const itemCounts = new Map<string, number>();
    ordersList.filter(o => o.status === 'delivered').forEach(order => {
      order.items?.forEach(item => {
        const count = itemCounts.get(item.name) || 0;
        itemCounts.set(item.name, count + (item.quantity || 1));
      });
    });
    
    const favoriteItem = itemCounts.size > 0 
      ? Array.from(itemCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : undefined;

    return {
      totalOrders: ordersList.length,
      completedOrders,
      monthlyRevenue: calculateRevenue(monthOrders),
      weeklyRevenue: calculateRevenue(weekOrders),
      todayRevenue: calculateRevenue(todayOrders),
      averageOrderValue,
      pendingOrders,
      rating: restaurantInfo.rating || 4.5, // Default rating
      totalReviews: restaurantInfo.totalReviews || 0,
      favoriteItem,
    };
  };

  // Load restaurant data and orders statistics
  const loadRestaurantData = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      
      // Load restaurant info
      const docRef = doc(FIREBASE_DB, 'restaurants', user.uid);
      const docSnap = await getDoc(docRef);
      
      let restaurantData: RestaurantInfo;
      
      if (docSnap.exists()) {
        restaurantData = docSnap.data() as RestaurantInfo;
        
        // Ensure all new fields exist with defaults
        restaurantData = {
          ...restaurantData,
          autoAcceptOrders: restaurantData.autoAcceptOrders ?? false,
          notificationsEnabled: restaurantData.notificationsEnabled ?? true,
        };
      } else {
        // First time setup - create default restaurant profile
        restaurantData = {
          ...restaurantInfo,
          name: user.displayName || 'My Restaurant',
          email: user.email || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(docRef, restaurantData);
      }
      
      setRestaurantInfo(restaurantData);
      setHoursForm(restaurantData.hours);
      
      // Update edit form
      setEditForm({
        name: restaurantData.name,
        description: restaurantData.description,
        phone: restaurantData.phone,
        email: restaurantData.email,
        address: restaurantData.address,
        minimumOrder: restaurantData.minimumOrder.toString(),
        deliveryFee: restaurantData.deliveryFee.toString(),
        serviceCharge: restaurantData.serviceCharge.toString(),
        deliveryRadius: restaurantData.deliveryRadius.toString(),
        estimatedDeliveryTime: restaurantData.estimatedDeliveryTime,
        selectedCuisines: [...restaurantData.cuisine],
      });

      // Load orders for statistics
      await loadOrdersStats();
      
    } catch (error) {
      console.error('Error loading restaurant data:', error);
      Alert.alert('Error', 'Failed to load restaurant information');
    } finally {
      setLoading(false);
    }
  };

  // Load orders statistics
  const loadOrdersStats = async () => {
    if (!user?.uid) return;

    try {
      // Get orders from last 3 months for comprehensive stats
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const ordersRef = collection(FIREBASE_DB, 'orders');
      const ordersQuery = query(
        ordersRef,
        where('restaurantId', '==', user.uid),
        where('createdAt', '>=', Timestamp.fromDate(threeMonthsAgo)),
        orderBy('createdAt', 'desc'),
        limit(1000)
      );

      const snapshot = await getDocs(ordersQuery);
      const ordersList: Order[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        ordersList.push({
          id: doc.id,
          orderNumber: data.orderNumber || `#${doc.id.slice(-6).toUpperCase()}`,
          userId: data.userId || '',
          userEmail: data.userEmail || '',
          restaurantId: data.restaurantId || '',
          restaurantName: data.restaurantName || '',
          items: data.items || [],
          pricing: data.pricing || {
            subtotal: 0,
            serviceCharge: 0,
            tax: 0,
            deliveryFee: 0,
            total: 0,
          },
          status: data.status || 'pending',
          paymentStatus: data.paymentStatus || 'pending',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          confirmedAt: data.confirmedAt,
          deliveredAt: data.deliveredAt,
        } as Order);
      });

      // Calculate and update stats
      const stats = calculateRestaurantStats(ordersList);
      setRestaurantStats(stats);
      
      // Update restaurant document with latest stats
      const docRef = doc(FIREBASE_DB, 'restaurants', user.uid);
      await updateDoc(docRef, {
        totalOrders: stats.totalOrders,
        monthlyRevenue: stats.monthlyRevenue,
        updatedAt: serverTimestamp(),
      });
      
    } catch (error) {
      console.error('Error loading orders stats:', error);
    }
  };

  // Auto-accept orders functionality
  useEffect(() => {
    if (!user?.uid || !restaurantInfo.autoAcceptOrders) return;

    console.log('Setting up auto-accept listener for restaurant:', user.uid);

    const ordersRef = collection(FIREBASE_DB, 'orders');
    const pendingOrdersQuery = query(
      ordersRef,
      where('restaurantId', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(pendingOrdersQuery, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const order = change.doc.data();
          const orderId = change.doc.id;
          
          console.log('New pending order detected:', orderId);
          
          // Auto-accept after a brief delay (to ensure the order is fully created)
          setTimeout(async () => {
            try {
              await updateDoc(doc(FIREBASE_DB, 'orders', orderId), {
                status: 'confirmed',
                confirmedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              
              console.log('Order auto-accepted:', orderId);
              
              // You could add a notification here if needed
              
            } catch (error) {
              console.error('Error auto-accepting order:', error);
            }
          }, 2000); // 2 second delay
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid, restaurantInfo.autoAcceptOrders]);

  // Save restaurant data to Firestore
  const saveRestaurantData = async (updatedInfo: Partial<RestaurantInfo>) => {
    try {
      setSaving(true);
      const docRef = doc(FIREBASE_DB, 'restaurants', user.uid);
      
      const dataToSave = {
        ...updatedInfo,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(docRef, dataToSave);
      
      // Update local state
      setRestaurantInfo(prev => ({ ...prev, ...updatedInfo }));
      
      return true;
    } catch (error) {
      console.error('Error saving restaurant data:', error);
      Alert.alert('Error', 'Failed to save restaurant information');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadRestaurantData();
  }, [user.uid]);

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadRestaurantData();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(FIREBASE_AUTH);
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  const toggleRestaurantStatus = async () => {
    const newStatus = !restaurantInfo.isActive;
    
    Alert.alert(
      newStatus ? 'Open Restaurant' : 'Close Restaurant',
      newStatus 
        ? 'This will start accepting new orders again.' 
        : 'This will stop accepting new orders. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus ? 'Open' : 'Close',
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            const success = await saveRestaurantData({ isActive: newStatus });
            if (success) {
              // Local state is updated in saveRestaurantData
            }
          },
        },
      ]
    );
  };

  const toggleNotifications = async (enabled: boolean) => {
    const success = await saveRestaurantData({ notificationsEnabled: enabled });
    if (!success) {
      // Revert the switch if save failed
      return;
    }
  };

  const toggleAutoAcceptOrders = async (enabled: boolean) => {
    Alert.alert(
      enabled ? 'Enable Auto-Accept' : 'Disable Auto-Accept',
      enabled 
        ? 'New orders will be automatically accepted. You can still manually manage order preparation and delivery status.'
        : 'You will need to manually accept each new order.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: enabled ? 'Enable' : 'Disable',
          onPress: async () => {
            const success = await saveRestaurantData({ autoAcceptOrders: enabled });
            if (!success) {
              // Revert the switch if save failed
              return;
            }
          },
        },
      ]
    );
  };

  const toggleCuisine = (cuisine: string) => {
    setEditForm(prev => ({
      ...prev,
      selectedCuisines: prev.selectedCuisines.includes(cuisine)
        ? prev.selectedCuisines.filter(c => c !== cuisine)
        : [...prev.selectedCuisines, cuisine]
    }));
  };

  const toggleDayOpen = (day: string) => {
    setHoursForm(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen
      }
    }));
  };

  const updateDayHours = (day: string, field: 'open' | 'close', value: string) => {
    setHoursForm(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const copyHoursToAll = (day: string) => {
    const sourceHours = hoursForm[day];
    const updatedHours = { ...hoursForm };
    
    daysOfWeek.forEach(({ key }) => {
      updatedHours[key] = { ...sourceHours };
    });
    
    setHoursForm(updatedHours);
  };

  const validateAndSaveHours = async () => {
    // Validate that open time is before close time for open days
    const validationErrors: string[] = [];
    
    Object.entries(hoursForm).forEach(([day, hours]) => {
      if (hours.isOpen) {
        const openTime = new Date(`1970-01-01T${hours.open}:00`);
        const closeTime = new Date(`1970-01-01T${hours.close}:00`);
        
        if (openTime >= closeTime) {
          validationErrors.push(`${day.charAt(0).toUpperCase() + day.slice(1)}: Opening time must be before closing time`);
        }
      }
    });

    if (validationErrors.length > 0) {
      Alert.alert('Invalid Hours', validationErrors.join('\n'));
      return;
    }

    // Save to Firestore
    const success = await saveRestaurantData({ hours: hoursForm });
    
    if (success) {
      setShowHoursModal(false);
      Alert.alert('Success', 'Operating hours updated successfully!');
    }
  };

  const getCurrentDayStatus = () => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[new Date().getDay()];
    const todayHours = restaurantInfo.hours[currentDay];
    
    if (!todayHours || !todayHours.isOpen) {
      return 'Closed today';
    }
    
    return `${todayHours.open} - ${todayHours.close}`;
  };

  const validateAndSave = async () => {
    // Validate required fields
    if (!editForm.name.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return;
    }

    if (!editForm.phone.trim()) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }

    if (!editForm.email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    if (!editForm.address.trim()) {
      Alert.alert('Error', 'Address is required');
      return;
    }

    if (editForm.selectedCuisines.length === 0) {
      Alert.alert('Error', 'Please select at least one cuisine type');
      return;
    }

    // Validate pricing fields
    if (!validatePrice(editForm.minimumOrder)) {
      Alert.alert('Error', 'Please enter a valid minimum order amount');
      return;
    }

    if (!validatePrice(editForm.deliveryFee)) {
      Alert.alert('Error', 'Please enter a valid delivery fee');
      return;
    }

    if (!validatePrice(editForm.serviceCharge)) {
      Alert.alert('Error', 'Please enter a valid service charge');
      return;
    }

    // Prepare data for saving
    const updatedData = {
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim(),
      address: editForm.address.trim(),
      minimumOrder: parseFloat(editForm.minimumOrder),
      deliveryFee: parseFloat(editForm.deliveryFee),
      serviceCharge: parseFloat(editForm.serviceCharge),
      deliveryRadius: parseFloat(editForm.deliveryRadius),
      estimatedDeliveryTime: editForm.estimatedDeliveryTime,
      cuisine: editForm.selectedCuisines,
    };

    // Save to Firestore
    const success = await saveRestaurantData(updatedData);
    
    if (success) {
      setShowEditModal(false);
      Alert.alert('Success', 'Restaurant information updated successfully!');
    }
  };

  const resetForm = () => {
    setEditForm({
      name: restaurantInfo.name,
      description: restaurantInfo.description,
      phone: restaurantInfo.phone,
      email: restaurantInfo.email,
      address: restaurantInfo.address,
      minimumOrder: restaurantInfo.minimumOrder.toString(),
      deliveryFee: restaurantInfo.deliveryFee.toString(),
      serviceCharge: restaurantInfo.serviceCharge.toString(),
      deliveryRadius: restaurantInfo.deliveryRadius.toString(),
      estimatedDeliveryTime: restaurantInfo.estimatedDeliveryTime,
      selectedCuisines: [...restaurantInfo.cuisine],
    });
  };

  const resetHoursForm = () => {
    setHoursForm(restaurantInfo.hours);
  };

  const profileSections: ProfileMenuSection[] = [
    {
      title: 'Restaurant Management',
      items: [
        {
          id: '1',
          icon: 'storefront-outline',
          title: 'Restaurant Information',
          subtitle: 'Update name, description, and contact details',
          action: 'navigate',
          iconColor: '#4F46E5',
          onPress: () => {
            resetForm();
            setShowEditModal(true);
          },
        },
        {
          id: '2',
          icon: 'time-outline',
          title: 'Operating Hours',
          subtitle: `Today: ${getCurrentDayStatus()}`,
          action: 'navigate',
          iconColor: '#059669',
          onPress: () => {
            resetHoursForm();
            setShowHoursModal(true);
          },
        },
        {
          id: '3',
          icon: 'location-outline',
          title: 'Delivery Settings',
          subtitle: `${restaurantInfo.deliveryRadius}km radius • ${formatPrice(restaurantInfo.deliveryFee)} fee`,
          action: 'navigate',
          iconColor: '#DC2626',
          onPress: () => console.log('Navigate to Delivery Settings'),
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          id: '5',
          icon: restaurantInfo.isActive ? 'pause-circle-outline' : 'play-circle-outline',
          title: 'Restaurant Status',
          subtitle: restaurantInfo.isActive ? 'Currently accepting orders' : 'Currently closed',
          action: 'action',
          iconColor: restaurantInfo.isActive ? '#10B981' : '#EF4444',
          onPress: toggleRestaurantStatus,
        },
        {
          id: '6',
          icon: 'notifications-outline',
          title: 'Order Notifications',
          subtitle: 'Get notified of new orders',
          action: 'toggle',
          hasToggle: true,
          toggleValue: restaurantInfo.notificationsEnabled,
          iconColor: '#8B5CF6',
          onToggle: toggleNotifications,
        },
        {
          id: '7',
          icon: 'checkmark-circle-outline',
          title: 'Auto Accept Orders',
          subtitle: restaurantInfo.autoAcceptOrders ? 'Orders accepted automatically' : 'Manual order acceptance',
          action: 'toggle',
          hasToggle: true,
          toggleValue: restaurantInfo.autoAcceptOrders,
          iconColor: '#06B6D4',
          onToggle: toggleAutoAcceptOrders,
        },
        {
          id: '8',
          icon: isDarkMode ? 'sunny-outline' : 'moon-outline',
          title: 'Dark Mode',
          subtitle: isDarkMode ? 'Switch to light theme' : 'Switch to dark theme',
          action: 'toggle',
          hasToggle: true,
          toggleValue: isDarkMode,
          iconColor: isDarkMode ? '#F59E0B' : '#6B7280',
          onToggle: toggleTheme,
        },
      ],
    },
    {
      title: 'Business & Analytics',
      items: [
        {
          id: '11',
          icon: 'star-outline',
          title: 'Reviews & Ratings',
          subtitle: `${restaurantStats.rating}/5 (${restaurantStats.totalReviews} reviews)`,
          action: 'navigate',
          iconColor: '#F59E0B',
          onPress: () => console.log('Navigate to Reviews'),
          badge: restaurantStats.totalReviews > 0 ? '3 new' : undefined,
        },
        {
          id: '12',
          icon: 'megaphone-outline',
          title: 'Promotions & Offers',
          subtitle: 'Create and manage special deals',
          action: 'navigate',
          iconColor: '#EC4899',
          onPress: () => console.log('Navigate to Promotions'),
        },
      ],
    },
    {
      title: 'Financial',
      items: [
        {
          id: '13',
          icon: 'card-outline',
          title: 'Payment Settings',
          subtitle: 'Manage payout methods and banking',
          action: 'navigate',
          iconColor: '#059669',
          onPress: () => console.log('Navigate to Payment Settings'),
        },
        {
          id: '14',
          icon: 'wallet-outline',
          title: 'Revenue Reports',
          subtitle: `${formatCurrency(restaurantStats.monthlyRevenue)} this month • ${formatPrice(restaurantStats.averageOrderValue)} avg order`,
          action: 'navigate',
          iconColor: '#7C3AED',
          onPress: () => console.log('Navigate to Revenue Reports'),
        },
        {
          id: '15',
          icon: 'document-text-outline',
          title: 'Tax Documents',
          subtitle: `Tax rate: ${restaurantInfo.taxRate}% • Service: ${formatPrice(restaurantInfo.serviceCharge)}`,
          action: 'navigate',
          iconColor: '#6366F1',
          onPress: () => console.log('Navigate to Tax Documents'),
        },
      ],
    },
  ];

  const availableCuisines = [
    'Italian', 'Mediterranean', 'Pizza', 'Pasta', 'Seafood', 'Vegetarian', 
    'Chinese', 'Indian', 'Mexican', 'Japanese', 'Continental', 'Local Kenyan',
    'Fast Food', 'Healthy', 'Desserts', 'Beverages'
  ];

  const renderMenuItem = (item: ProfileMenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, { backgroundColor: theme.surface }]}
      onPress={item.onPress}
      disabled={item.action === 'toggle'}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: item.iconColor + '15' }]}>
          <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
        </View>
        <View style={styles.menuItemText}>
          <View style={styles.menuTitleRow}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
            {item.badge && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </View>
          {item.subtitle && (
            <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
          )}
        </View>
      </View>
      <View style={styles.menuItemRight}>
        {item.hasToggle ? (
          <Switch
            value={item.toggleValue}
            onValueChange={item.onToggle}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={item.toggleValue ? '#fff' : '#f4f3f4'}
            ios_backgroundColor={theme.border}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section: ProfileMenuSection) => (
    <View key={section.title} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
        {section.items.map((item, index) => (
          <View key={item.id}>
            {renderMenuItem(item)}
            {index < section.items.length - 1 && <View style={[styles.separator, { backgroundColor: theme.separator }]} />}
          </View>
        ))}
      </View>
    </View>
  );

  const renderTimeSelector = (value: string, onSelect: (time: string) => void, placeholder: string) => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.timeScrollView}
    >
      {timeSlots.map((time) => (
        <TouchableOpacity
          key={time}
          style={[
            styles.timeSlot,
            {
              backgroundColor: value === time ? theme.primary : theme.inputBackground,
              borderColor: value === time ? theme.primary : theme.border,
            }
          ]}
          onPress={() => onSelect(time)}
        >
          <Text style={[
            styles.timeSlotText,
            { color: value === time ? '#fff' : theme.text }
          ]}>
            {time}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderHoursModal = () => (
    <Modal
      visible={showHoursModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={[styles.modalContainer, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowHoursModal(false)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Operating Hours</Text>
          <TouchableOpacity onPress={validateAndSaveHours} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[styles.saveButton, { color: theme.primary }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          {daysOfWeek.map(({ key, label }) => (
            <View key={key} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <View style={styles.dayTitleRow}>
                  <Text style={[styles.dayTitle, { color: theme.text }]}>{label}</Text>
                  <Switch
                    value={hoursForm[key].isOpen}
                    onValueChange={() => toggleDayOpen(key)}
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor={hoursForm[key].isOpen ? '#fff' : '#f4f3f4'}
                    ios_backgroundColor={theme.border}
                  />
                </View>
                {hoursForm[key].isOpen && (
                  <TouchableOpacity
                    style={[styles.copyButton, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}
                    onPress={() => copyHoursToAll(key)}
                  >
                    <Ionicons name="copy-outline" size={16} color={theme.primary} />
                    <Text style={[styles.copyButtonText, { color: theme.primary }]}>Copy to all days</Text>
                  </TouchableOpacity>
                )}
              </View>

              {hoursForm[key].isOpen && (
                <View style={styles.timeSelectors}>
                  <View style={styles.timeGroup}>
                    <Text style={[styles.timeLabel, { color: theme.text }]}>Opening Time</Text>
                    {renderTimeSelector(
                      hoursForm[key].open,
                      (time) => updateDayHours(key, 'open', time),
                      'Select opening time'
                    )}
                  </View>
                  
                  <View style={styles.timeGroup}>
                    <Text style={[styles.timeLabel, { color: theme.text }]}>Closing Time</Text>
                    {renderTimeSelector(
                      hoursForm[key].close,
                      (time) => updateDayHours(key, 'close', time),
                      'Select closing time'
                    )}
                  </View>
                </View>
              )}

              {!hoursForm[key].isOpen && (
                <View style={[styles.closedIndicator, { backgroundColor: theme.error + '20' }]}>
                  <Ionicons name="close-circle" size={20} color={theme.error} />
                  <Text style={[styles.closedText, { color: theme.error }]}>Closed</Text>
                </View>
              )}
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={[styles.modalContainer, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowEditModal(false)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Restaurant Info</Text>
          <TouchableOpacity onPress={validateAndSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[styles.saveButton, { color: theme.primary }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Information */}
          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Restaurant Name *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Enter restaurant name"
              placeholderTextColor={theme.placeholder}
              value={editForm.name}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Description</Text>
            <TextInput
              style={[styles.formInput, styles.textArea, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Describe your restaurant, specialties, atmosphere..."
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={3}
              value={editForm.description}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, description: text }))}
            />
          </View>

          {/* Contact Information */}
          <Text style={[styles.sectionLabel, { color: theme.text }]}>Contact Information</Text>
          
          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Phone Number *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="+254 XXX XXX XXX"
              placeholderTextColor={theme.placeholder}
              value={editForm.phone}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Email *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="restaurant@example.com"
              placeholderTextColor={theme.placeholder}
              value={editForm.email}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Address *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="Street address, City, County"
              placeholderTextColor={theme.placeholder}
              value={editForm.address}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, address: text }))}
            />
          </View>

          {/* Pricing Information */}
          <Text style={[styles.sectionLabel, { color: theme.text }]}>Pricing & Delivery</Text>

          <View style={styles.formRow}>
            <View style={[styles.formSection, { flex: 1, marginRight: 10 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Minimum Order</Text>
              <View style={[styles.currencyInputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>KES</Text>
                <TextInput
                  style={[styles.currencyInput, { color: theme.text }]}
                  placeholder={getCurrencyPlaceholder('mains')}
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                  value={editForm.minimumOrder}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, minimumOrder: text }))}
                />
              </View>
            </View>
            
            <View style={[styles.formSection, { flex: 1, marginLeft: 10 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Delivery Fee</Text>
              <View style={[styles.currencyInputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>KES</Text>
                <TextInput
                  style={[styles.currencyInput, { color: theme.text }]}
                  placeholder="100"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                  value={editForm.deliveryFee}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, deliveryFee: text }))}
                />
              </View>
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formSection, { flex: 1, marginRight: 10 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Service Charge</Text>
              <View style={[styles.currencyInputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>KES</Text>
                <TextInput
                  style={[styles.currencyInput, { color: theme.text }]}
                  placeholder="50"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                  value={editForm.serviceCharge}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, serviceCharge: text }))}
                />
              </View>
            </View>
            
            <View style={[styles.formSection, { flex: 1, marginLeft: 10 }]}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Delivery Radius</Text>
              <View style={[styles.currencyInputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.currencyInput, { color: theme.text }]}
                  placeholder="5.0"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                  value={editForm.deliveryRadius}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, deliveryRadius: text }))}
                />
                <Text style={[styles.currencySuffix, { color: theme.textSecondary }]}>km</Text>
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Estimated Delivery Time</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
              placeholder="25-35 min"
              placeholderTextColor={theme.placeholder}
              value={editForm.estimatedDeliveryTime}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, estimatedDeliveryTime: text }))}
            />
          </View>

          {/* Cuisine Types */}
          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Cuisine Types *</Text>
            <Text style={[styles.formHelper, { color: theme.textSecondary }]}>
              Select all cuisine types that apply to your restaurant
            </Text>
            <View style={styles.cuisineSelector}>
              {availableCuisines.map((cuisine) => (
                <TouchableOpacity
                  key={cuisine}
                  style={[
                    styles.cuisineChip,
                    { 
                      backgroundColor: editForm.selectedCuisines.includes(cuisine) ? theme.primary : theme.inputBackground,
                      borderColor: editForm.selectedCuisines.includes(cuisine) ? theme.primary : theme.border
                    }
                  ]}
                  onPress={() => toggleCuisine(cuisine)}
                >
                  <Text style={[
                    styles.cuisineChipText,
                    { color: editForm.selectedCuisines.includes(cuisine) ? '#fff' : theme.text }
                  ]}>
                    {cuisine}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Loading screen
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading restaurant information...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.statusIndicator}>
              <View style={[
                styles.statusDot,
                { backgroundColor: restaurantInfo.isActive ? '#10B981' : '#EF4444' }
              ]} />
              <Text style={styles.statusText}>
                {restaurantInfo.isActive ? 'Open' : 'Closed'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Restaurant Header */}
        <View style={styles.restaurantHeader}>
          <View style={styles.restaurantImageContainer}>
            <Image
              source={{
                uri: restaurantInfo.name 
                  ? 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
                  : `https://ui-avatars.com/api/?name=${restaurantInfo.name || 'Restaurant'}&background=FF6B35&color=fff&size=200`,
              }}
              style={styles.restaurantImage}
            />
            <TouchableOpacity style={[styles.editImageButton, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.restaurantName}>
            {restaurantInfo.name || 'Complete Your Profile'}
          </Text>
          {restaurantInfo.cuisine.length > 0 && (
            <View style={styles.cuisineContainer}>
              {restaurantInfo.cuisine.slice(0, 3).map((cuisine, index) => (
                <Text key={index} style={styles.cuisineTag}>
                  {cuisine}{index < restaurantInfo.cuisine.slice(0, 3).length - 1 ? ' • ' : ''}
                </Text>
              ))}
            </View>
          )}
          
          {/* Enhanced Restaurant Stats with Real Data */}
          <View style={[styles.statsContainer, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.95)' }]}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="star" size={15} color="#F59E0B" />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#2D3748' }]}>
                {restaurantStats.rating.toFixed(1) || 'N/A'}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? theme.textSecondary : '#6B7280' }]}>
                Rating
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="receipt" size={15} color="#3B82F6" />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#2D3748' }]}>
                {restaurantStats.totalOrders}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? theme.textSecondary : '#6B7280' }]}>
                Orders
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="wallet" size={15} color="#10B981" />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#2D3748' }]}>
                {restaurantStats.monthlyRevenue > 0 
                  ? formatCurrency(restaurantStats.monthlyRevenue / 1000).replace('KES ', '') + 'k'
                  : '0'
                }
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? theme.textSecondary : '#6B7280' }]}>
                Revenue
              </Text>
            </View>
          </View>

          {/* Additional Stats Row */}
          <View style={[styles.additionalStatsContainer, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
            <View style={styles.additionalStatItem}>
              <Text style={[styles.additionalStatNumber, { color: theme.text }]}>
                {formatPrice(restaurantStats.averageOrderValue)}
              </Text>
              <Text style={[styles.additionalStatLabel, { color: theme.textSecondary }]}>
                Avg Order
              </Text>
            </View>
            {restaurantStats.favoriteItem && (
              <View style={styles.additionalStatItem}>
                <Ionicons name="heart" size={16} color="#EF4444" />
                <Text style={[styles.favoriteItemText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {restaurantStats.favoriteItem}
                </Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Setup Notice for New Restaurants */}
        {(!restaurantInfo.name || restaurantInfo.cuisine.length === 0) && (
          <View style={[styles.setupNotice, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
            <Ionicons name="information-circle" size={24} color={theme.warning} />
            <View style={styles.setupNoticeText}>
              <Text style={[styles.setupNoticeTitle, { color: theme.text }]}>Complete Your Setup</Text>
              <Text style={[styles.setupNoticeSubtitle, { color: theme.textSecondary }]}>
                Add your restaurant information to start accepting orders
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.setupButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                resetForm();
                setShowEditModal(true);
              }}
            >
              <Text style={styles.setupButtonText}>Setup</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Auto-Accept Status Alert */}
        {restaurantInfo.autoAcceptOrders && restaurantInfo.isActive && (
          <View style={[styles.autoAcceptNotice, { backgroundColor: theme.success + '20', borderColor: theme.success }]}>
            <Ionicons name="checkmark-circle" size={20} color={theme.success} />
            <Text style={[styles.autoAcceptText, { color: theme.success }]}>
              Auto-accept is enabled. New orders will be automatically confirmed.
            </Text>
          </View>
        )}

        {/* Quick Info Cards */}
        <View style={styles.quickInfoContainer}>
          <View style={[styles.quickInfoCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
            <View style={styles.quickInfoHeader}>
              <Ionicons name="time" size={20} color={theme.success} />
              <Text style={[styles.quickInfoTitle, { color: theme.text }]}>Today's Status</Text>
            </View>
            <Text style={[styles.quickInfoText, { color: theme.textSecondary }]}>
              Currently: {restaurantInfo.isActive ? 'Open' : 'Closed'}
            </Text>
            <Text style={[styles.quickInfoText, { color: theme.textSecondary }]}>
              {getCurrentDayStatus()}
            </Text>
            {restaurantStats.todayRevenue > 0 && (
              <Text style={[styles.quickInfoRevenue, { color: theme.primary }]}>
                Today's Revenue: {formatPrice(restaurantStats.todayRevenue)}
              </Text>
            )}
          </View>
        </View>

        {/* Menu Sections */}
        {profileSections.map(renderSection)}

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LinearGradient
              colors={isDarkMode ? ['rgba(239, 68, 68, 0.2)', 'rgba(248, 113, 113, 0.2)'] : ['#FEE2E2', '#FECACA']}
              style={styles.signOutGradient}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: theme.textMuted }]}>YetuEats Restaurant v1.0.0</Text>
          <Text style={[styles.copyrightText, { color: theme.textMuted }]}>© 2025 YetuEats. All rights reserved.</Text>
        </View>
      </ScrollView>

      {renderEditModal()}
      {renderHoursModal()}
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
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  headerGradient: {
    paddingBottom: 35,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 25,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  restaurantHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  restaurantImageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  restaurantImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff',
    borderWidth: 5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  editImageButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  restaurantName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cuisineContainer: {
    flexDirection: 'row',
    marginBottom: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cuisineTag: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    marginBottom: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statDivider: {
    width: 2,
    height: 50,
    marginHorizontal: 20,
    borderRadius: 1,
  },
  additionalStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    borderRadius: 16,
  },
  additionalStatItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  additionalStatNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  additionalStatLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  favoriteItemText: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 100,
  },
  scrollView: {
    flex: 1,
    marginTop: -25,
  },
  scrollContent: {
    paddingTop: 35,
    paddingBottom: 40,
  },
  setupNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  setupNoticeText: {
    flex: 1,
    marginLeft: 12,
  },
  setupNoticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  setupNoticeSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  setupButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 12,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  autoAcceptNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  autoAcceptText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  quickInfoContainer: {
    paddingHorizontal: 24,
    marginBottom: 35,
    gap: 16,
  },
  quickInfoCard: {
    padding: 20,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  quickInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickInfoTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  quickInfoText: {
    fontSize: 15,
    marginBottom: 4,
    lineHeight: 20,
  },
  quickInfoRevenue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 24,
    marginBottom: 16,
    letterSpacing: 0.4,
  },
  sectionContent: {
    marginHorizontal: 24,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 80,
  },
  separator: {
    height: 1,
    marginLeft: 76,
    opacity: 0.6,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemText: {
    flex: 1,
    paddingRight: 12,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  menuSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    opacity: 0.8,
  },
  menuItemRight: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  signOutContainer: {
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 30,
  },
  signOutButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signOutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 24,
  },
  versionText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  copyrightText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  saveButton: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    marginTop: 8,
    letterSpacing: 0.3,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  formHelper: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  formInput: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
  },
  currencyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  currencySuffix: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  currencyInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  cuisineSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cuisineChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cuisineChipText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  // Operating Hours Modal Styles
  daySection: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dayHeader: {
    paddingBottom: 16,
  },
  dayTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  timeSelectors: {
    gap: 16,
  },
  timeGroup: {
    marginBottom: 8,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  timeScrollView: {
    marginBottom: 8,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 2,
    minWidth: 70,
    alignItems: 'center',
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  closedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  closedText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
});

export default RestaurantProfileScreen;