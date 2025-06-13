import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Dimensions,
  Image,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

const { width: screenWidth } = Dimensions.get('window');

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  isAvailable: boolean;
  preparationTime: number;
  tags: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  restaurantId: string;
  restaurantName?: string;
  restaurantImage?: string;
  restaurantRating?: number;
  restaurantCuisine?: string[];
}

interface Restaurant {
  id: string;
  name: string;
  cuisine: string[];
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  minimumOrder: number;
  imageUrl?: string;
  isActive: boolean;
  totalOrders: number;
  description?: string;
  address?: string;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

interface FoodCategory {
  id: string;
  name: string;
  icon: string;
  bgColor: string;
}

interface PromoOffer {
  id: string;
  title: string;
  subtitle: string;
  discount: string;
  bgColor: string[];
  image: string;
}

const CustomerHomeScreen = ({ 
  user, 
  onNavigateToMenu, 
  onNavigateToCart 
}: { 
  user: User;
  onNavigateToMenu?: (restaurantId: string) => void;
  onNavigateToCart?: (cart: CartItem[]) => void;
}) => {
  const { theme, isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const scrollX = useRef(new Animated.Value(0)).current;

  const promoOffers: PromoOffer[] = [
    {
      id: '1',
      title: 'UP TO',
      subtitle: 'On your first order',
      discount: '30% OFF',
      bgColor: ['#FF6B35', '#F7931E'],
      image: 'restaurant-outline',
    },
    {
      id: '2',
      title: 'FREE',
      subtitle: 'Delivery on orders above KES 500',
      discount: 'DELIVERY',
      bgColor: ['#4F46E5', '#7C3AED'],
      image: 'car-outline',
    },
    {
      id: '3',
      title: 'SAVE',
      subtitle: 'On weekend orders',
      discount: '25% OFF',
      bgColor: ['#059669', '#10B981'],
      image: 'gift-outline',
    },
  ];

  const categories: FoodCategory[] = [
    { id: 'all', name: 'All', icon: 'grid-outline', bgColor: '#F0F8FF' },
    { id: 'mains', name: 'Main Courses', icon: 'restaurant-outline', bgColor: '#FFF8DC' },
    { id: 'appetizers', name: 'Appetizers', icon: 'pizza-outline', bgColor: '#FFF3E0' },
    { id: 'desserts', name: 'Desserts', icon: 'ice-cream-outline', bgColor: '#FFF0F5' },
    { id: 'beverages', name: 'Beverages', icon: 'cafe-outline', bgColor: '#E8F5E8' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadRestaurants(), loadMenuItems()]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load restaurants and menu items');
    } finally {
      setLoading(false);
    }
  };

  // Fixed restaurant loading - now gets restaurant data from the 'restaurants' collection
  const loadRestaurants = async () => {
    try {
      console.log('Loading restaurants...');
      
      // Check if restaurants collection exists, if not create mock data
      const restaurantsQuery = query(
        collection(FIREBASE_DB, 'restaurants'),
        where('isActive', '==', true),
        limit(10)
      );
      
      const restaurantsSnapshot = await getDocs(restaurantsQuery);
      const restaurantsList: Restaurant[] = [];
      
      if (restaurantsSnapshot.empty) {
        console.log('No restaurants found in Firestore, using mock data');
        // Create some mock restaurants for display
        const mockRestaurants: Restaurant[] = [
          {
            id: 'mock-1',
            name: 'Savannah Grill',
            cuisine: ['African', 'Grilled'],
            rating: 4.5,
            deliveryTime: '25-35 min',
            deliveryFee: 0,
            minimumOrder: 500,
            imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
            isActive: true,
            totalOrders: 1250,
            description: 'Authentic African cuisine with grilled specialties',
            address: 'Westlands, Nairobi',
          },
          {
            id: 'mock-2',
            name: 'Nairobi Bites',
            cuisine: ['Local', 'Fast Food'],
            rating: 4.2,
            deliveryTime: '20-30 min',
            deliveryFee: 100,
            minimumOrder: 300,
            imageUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop',
            isActive: true,
            totalOrders: 890,
            description: 'Quick bites and local favorites',
            address: 'CBD, Nairobi',
          },
        ];
        setRestaurants(mockRestaurants);
      } else {
        restaurantsSnapshot.forEach((doc) => {
          const data = doc.data();
          restaurantsList.push({
            id: doc.id,
            name: data.name || 'Unknown Restaurant',
            cuisine: data.cuisine || [],
            rating: data.rating || 0,
            deliveryTime: data.estimatedDeliveryTime || '30-45 min',
            deliveryFee: data.deliveryFee || 0,
            minimumOrder: data.minimumOrder || 0,
            imageUrl: data.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'Restaurant')}&background=FF6B35&color=fff&size=400`,
            isActive: data.isActive || false,
            totalOrders: data.totalOrders || 0,
            description: data.description,
            address: data.address,
          });
        });
        
        setRestaurants(restaurantsList);
      }
      
      console.log('Restaurants loaded:', restaurantsList.length);
    } catch (error) {
      console.error('Error loading restaurants:', error);
      // Fallback to empty array on error
      setRestaurants([]);
    }
  };

  // Fixed menu items loading with proper restaurant data fetching
  const loadMenuItems = async () => {
    try {
      console.log('Loading menu items...');
      
      const menuItemsQuery = query(
        collection(FIREBASE_DB, 'menuItems'),
        where('isAvailable', '==', true),
        limit(20)
      );
      
      const menuItemsSnapshot = await getDocs(menuItemsQuery);
      const menuItemsList: MenuItem[] = [];
      
      if (menuItemsSnapshot.empty) {
        console.log('No menu items found in Firestore');
        setMenuItems([]);
        return;
      }

      // Get unique restaurant IDs
      const restaurantIds = new Set<string>();
      const menuItemsData: any[] = [];
      
      menuItemsSnapshot.forEach((doc) => {
        const data = doc.data();
        menuItemsData.push({ id: doc.id, ...data });
        if (data.restaurantId) {
          restaurantIds.add(data.restaurantId);
        }
      });

      console.log('Found menu items:', menuItemsData.length);
      console.log('Unique restaurant IDs:', Array.from(restaurantIds));

      // Fetch restaurant details for each unique restaurant ID
      const restaurantMap = new Map<string, Restaurant>();
      
      for (const restaurantId of restaurantIds) {
        try {
          // Correct way to get document by ID
          const restaurantDoc = await getDoc(doc(FIREBASE_DB, 'restaurants', restaurantId));
          
          if (restaurantDoc.exists()) {
            const restaurantData = restaurantDoc.data();
            restaurantMap.set(restaurantId, {
              id: restaurantDoc.id,
              name: restaurantData.name || 'Unknown Restaurant',
              cuisine: restaurantData.cuisine || [],
              rating: restaurantData.rating || 0,
              deliveryTime: restaurantData.estimatedDeliveryTime || '30-45 min',
              deliveryFee: restaurantData.deliveryFee || 0,
              minimumOrder: restaurantData.minimumOrder || 0,
              imageUrl: restaurantData.imageUrl,
              isActive: restaurantData.isActive || false,
              totalOrders: restaurantData.totalOrders || 0,
            });
          } else {
            console.log(`Restaurant not found: ${restaurantId}`);
            // Create a fallback restaurant entry
            restaurantMap.set(restaurantId, {
              id: restaurantId,
              name: 'Restaurant',
              cuisine: ['Various'],
              rating: 4.0,
              deliveryTime: '30-45 min',
              deliveryFee: 100,
              minimumOrder: 500,
              imageUrl: `https://ui-avatars.com/api/?name=Restaurant&background=FF6B35&color=fff&size=400`,
              isActive: true,
              totalOrders: 0,
            });
          }
        } catch (error) {
          console.error(`Error loading restaurant ${restaurantId}:`, error);
        }
      }

      // Combine menu items with restaurant data
      menuItemsData.forEach((item) => {
        const restaurant = restaurantMap.get(item.restaurantId);
        menuItemsList.push({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          imageUrl: item.imageUrl,
          isAvailable: item.isAvailable,
          preparationTime: item.preparationTime,
          tags: item.tags || [],
          isVegetarian: item.isVegetarian,
          isVegan: item.isVegan,
          isGlutenFree: item.isGlutenFree,
          restaurantId: item.restaurantId,
          restaurantName: restaurant?.name,
          restaurantImage: restaurant?.imageUrl,
          restaurantRating: restaurant?.rating,
          restaurantCuisine: restaurant?.cuisine,
        });
      });
      
      console.log('Menu items with restaurant data:', menuItemsList.length);
      setMenuItems(menuItemsList);
    } catch (error) {
      console.error('Error loading menu items:', error);
      setMenuItems([]);
    }
  };

  const addToCart = (menuItem: MenuItem) => {
    const existingItem = cart.find(item => item.menuItem.id === menuItem.id);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.menuItem.id === menuItem.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { menuItem, quantity: 1 }]);
    }
    
    Alert.alert('Added to Cart', `${menuItem.name} has been added to your cart!`);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.menuItem.price * item.quantity), 0);
  };

  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderPromoOffer = ({ item, index }: { item: PromoOffer; index: number }) => (
    <TouchableOpacity 
      style={[styles.promoCard, { width: screenWidth - 80 }]}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={item.bgColor as [string, string]}
        style={styles.promoGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.promoContent}>
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoTitle}>{item.title}</Text>
            <Text style={styles.promoDiscount}>{item.discount}</Text>
            <Text style={styles.promoSubtitle}>{item.subtitle}</Text>
            <TouchableOpacity style={styles.orderNowButton}>
              <Text style={styles.orderNowText}>Order Now</Text>
              <Ionicons name="arrow-forward" size={16} color="#2D3748" style={styles.orderArrow} />
            </TouchableOpacity>
          </View>
          <View style={styles.promoImageContainer}>
            <View style={styles.promoIconBackground}>
              <Ionicons name={item.image as any} size={40} color="#fff" />
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderCategory = ({ item }: { item: FoodCategory }) => {
    const isSelected = selectedCategory === item.id;
    return (
      <TouchableOpacity 
        style={[
          styles.categoryCard,
          { backgroundColor: isDarkMode ? theme.surface : item.bgColor },
          isSelected && { borderColor: theme.primary, borderWidth: 2 }
        ]}
        onPress={() => setSelectedCategory(item.id)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.categoryIconContainer,
          { backgroundColor: isSelected ? theme.primary : '#fff' }
        ]}>
          <Ionicons 
            name={item.icon as any} 
            size={24} 
            color={isSelected ? '#fff' : theme.primary}
          />
        </View>
        <Text style={[styles.categoryName, { color: theme.text }]}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity 
      style={[styles.menuItemCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      activeOpacity={0.8}
      onPress={() => onNavigateToMenu?.(item.restaurantId)}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: item.imageUrl }} 
          style={styles.menuItemImage}
          resizeMode="cover"
        />
        {item.isVegetarian && (
          <View style={[styles.dietBadge, { backgroundColor: '#10B981' }]}>
            <Text style={styles.dietBadgeText}>V</Text>
          </View>
        )}
      </View>
      
      <View style={styles.menuItemContent}>
        <Text style={[styles.menuItemName, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        
        <Text style={[styles.restaurantName, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.restaurantName}
        </Text>
        
        <Text style={[styles.menuItemDescription, { color: theme.textMuted }]} numberOfLines={2}>
          {item.description}
        </Text>
        
        <View style={styles.menuItemFooter}>
          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: theme.primary }]}>
              {formatPrice(item.price)}
            </Text>
            <View style={[styles.prepTimeContainer, { backgroundColor: theme.info + '20' }]}>
              <Ionicons name="time-outline" size={12} color={theme.info} />
              <Text style={[styles.prepTime, { color: theme.info }]}>{item.preparationTime}min</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.addToCartButton, { backgroundColor: theme.primary }]}
            onPress={() => addToCart(item)}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRestaurant = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity 
      style={[styles.restaurantCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      activeOpacity={0.8}
      onPress={() => onNavigateToMenu?.(item.id)}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: item.imageUrl }} 
          style={styles.restaurantImage}
          resizeMode="cover"
        />
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
        </View>
      </View>
      
      <View style={styles.restaurantContent}>
        <Text style={[styles.restaurantCardName, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        
        <Text style={[styles.cuisineText, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.cuisine.join(' • ')}
        </Text>
        
        <View style={styles.restaurantDetails}>
          <View style={[styles.detailBadge, { backgroundColor: theme.success + '20' }]}>
            <Ionicons name="time-outline" size={12} color={theme.success} />
            <Text style={[styles.detailText, { color: theme.success }]}>{item.deliveryTime}</Text>
          </View>
          
          <View style={[styles.detailBadge, { backgroundColor: item.deliveryFee === 0 ? theme.success + '20' : theme.warning + '20' }]}>
            <Ionicons name="car-outline" size={12} color={item.deliveryFee === 0 ? theme.success : theme.warning} />
            <Text style={[styles.detailText, { color: item.deliveryFee === 0 ? theme.success : theme.warning }]}>
              {item.deliveryFee === 0 ? 'Free' : formatPrice(item.deliveryFee)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading delicious options...</Text>
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
          <View style={styles.locationContainer}>
            <Text style={styles.deliveryLabel}>Delivery To</Text>
            <TouchableOpacity style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#fff" style={styles.locationIcon} />
              <Text style={styles.locationText}>Nairobi, Kenya</Text>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
            </TouchableOpacity>
            
            {/* Cart Button */}
            {cart.length > 0 && (
              <TouchableOpacity 
                style={styles.cartButton}
                onPress={() => onNavigateToCart?.(cart)}
              >
                <Ionicons name="bag-outline" size={24} color="#fff" />
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{getCartItemCount()}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Welcome Message */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>
            Hello {user.displayName?.split(' ')[0] || 'Food Lover'}! 👋
          </Text>
          <Text style={styles.welcomeSubtext}>What would you like to eat today?</Text>
        </View>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.inputBackground }]}>
            <Ionicons name="search-outline" size={20} color={theme.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search foods and restaurants"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.placeholder}
            />
          </View>
          <TouchableOpacity style={[styles.filterButton, { backgroundColor: theme.primary }]}>
            <Ionicons name="options-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Promo Offers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Special Offers</Text>
            <TouchableOpacity>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <Animated.FlatList
            data={promoOffers}
            renderItem={renderPromoOffer}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promoList}
            snapToInterval={screenWidth - 60}
            decelerationRate="fast"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
          />
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Categories</Text>
          </View>
          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        {/* Popular Restaurants */}
        {restaurants.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Popular Restaurants</Text>
              <TouchableOpacity>
                <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={restaurants}
              renderItem={renderRestaurant}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.restaurantsList}
            />
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {selectedCategory === 'all' ? 'Popular Dishes' : categories.find(c => c.id === selectedCategory)?.name}
            </Text>
            <Text style={[styles.itemCount, { color: theme.textSecondary }]}>
              {filteredMenuItems.length} items
            </Text>
          </View>
          
          {filteredMenuItems.length > 0 ? (
            <View style={styles.menuItemsGrid}>
              {filteredMenuItems.map((item) => (
                <View key={item.id} style={styles.menuItemWrapper}>
                  {renderMenuItem({ item })}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.text }]}>No items found</Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                {menuItems.length === 0 ? 'No restaurants have added menu items yet' : 'Try a different category or search term'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <TouchableOpacity 
          style={[styles.floatingCartButton, { backgroundColor: theme.primary }]}
          onPress={() => onNavigateToCart?.(cart)}
        >
          <View style={styles.floatingCartContent}>
            <View style={styles.floatingCartLeft}>
              <Ionicons name="bag" size={20} color="#fff" />
              <Text style={styles.floatingCartCount}>{getCartItemCount()}</Text>
            </View>
            <Text style={styles.floatingCartText}>View Cart</Text>
            <Text style={styles.floatingCartTotal}>{formatPrice(getCartTotal())}</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
  },
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Header Section
  header: {
    paddingTop: 55,
    paddingBottom: 25,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  
  // Location Section
  locationContainer: {
    flex: 1,
    marginRight: 16,
  },
  deliveryLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    marginRight: 6,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginRight: 6,
    letterSpacing: 0.2,
  },
  
  // Header Actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cartButton: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Welcome Section
  welcomeContainer: {
    marginTop: 12,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  welcomeSubtext: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Scroll Content
  scrollContent: {
    paddingBottom: 120,
  },

  // Search Section
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  // Section Layout
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  seeAllText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  itemCount: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },

  // Promo Section
  promoList: {
    paddingHorizontal: 24,
  },
  promoCard: {
    borderRadius: 24,
    marginRight: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  promoGradient: {
    borderRadius: 24,
  },
  promoContent: {
    flexDirection: 'row',
    padding: 24,
    alignItems: 'center',
    minHeight: 140,
  },
  promoTextContainer: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  promoDiscount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginVertical: 6,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  promoSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 20,
    lineHeight: 19,
    letterSpacing: 0.2,
  },
  orderNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  orderNowText: {
    color: '#2D3748',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  orderArrow: {
    marginLeft: 6,
  },
  promoImageContainer: {
    position: 'relative',
    marginLeft: 24,
  },
  promoIconBackground: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Categories Section
  categoriesList: {
    paddingHorizontal: 24,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: 20,
    borderRadius: 20,
    padding: 20,
    width: 100,
    minHeight: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Restaurant Section
  restaurantsList: {
    paddingHorizontal: 24,
  },
  restaurantCard: {
    borderRadius: 20,
    marginRight: 20,
    overflow: 'hidden',
    width: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  imageContainer: {
    position: 'relative',
  },
  restaurantImage: {
    width: '100%',
    height: 160,
  },
  ratingBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  restaurantContent: {
    padding: 16,
  },
  restaurantCardName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  cuisineText: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  restaurantDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  detailText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
    letterSpacing: 0.2,
  },

  // Menu Items Grid
  menuItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
  },
  menuItemWrapper: {
    width: '50%',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  menuItemCard: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  menuItemImage: {
    width: '100%',
    height: 130,
  },
  dietBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  dietBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  menuItemContent: {
    padding: 14,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  restaurantName: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
    opacity: 0.8,
  },
  menuItemDescription: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
    opacity: 0.9,
  },
  menuItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flex: 1,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  prepTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  prepTime: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
    letterSpacing: 0.2,
  },
  addToCartButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },

  // Empty States
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },

  // Floating Cart Button
  floatingCartButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  floatingCartContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingCartCount: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  floatingCartText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  floatingCartTotal: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});

export default CustomerHomeScreen;