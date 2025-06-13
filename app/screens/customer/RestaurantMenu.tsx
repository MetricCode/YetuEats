import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
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
  allergens?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  restaurantId: string;
}

interface Restaurant {
  id: string;
  name: string;
  description: string;
  cuisine: string[];
  phone: string;
  email: string;
  address: string;
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
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

const RestaurantMenuScreen = ({ 
  restaurantId, 
  onBack, 
  onNavigateToCart,
  initialCart = []
}: { 
  restaurantId: string;
  onBack: () => void;
  onNavigateToCart: (cart: CartItem[]) => void;
  initialCart?: CartItem[];
}) => {
  const { theme } = useTheme();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(initialCart);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    loadRestaurantData();
  }, [restaurantId]);

  const loadRestaurantData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadRestaurant(), loadMenuItems()]);
    } catch (error) {
      console.error('Error loading restaurant data:', error);
      Alert.alert('Error', 'Failed to load restaurant information');
    } finally {
      setLoading(false);
    }
  };

  const loadRestaurant = async () => {
    try {
      const restaurantDoc = await getDoc(doc(FIREBASE_DB, 'restaurants', restaurantId));
      
      if (restaurantDoc.exists()) {
        const data = restaurantDoc.data();
        setRestaurant({
          id: restaurantDoc.id,
          name: data.name || 'Unknown Restaurant',
          description: data.description || '',
          cuisine: data.cuisine || [],
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          rating: data.rating || 0,
          totalReviews: data.totalReviews || 0,
          deliveryRadius: data.deliveryRadius || 0,
          minimumOrder: data.minimumOrder || 0,
          deliveryFee: data.deliveryFee || 0,
          estimatedDeliveryTime: data.estimatedDeliveryTime || '30-45 min',
          isActive: data.isActive || false,
          totalOrders: data.totalOrders || 0,
          monthlyRevenue: data.monthlyRevenue || 0,
          serviceCharge: data.serviceCharge || 0,
          taxRate: data.taxRate || 0,
        });
      }
    } catch (error) {
      console.error('Error loading restaurant:', error);
    }
  };

  const loadMenuItems = async () => {
    try {
      const menuItemsQuery = query(
        collection(FIREBASE_DB, 'menuItems'),
        where('restaurantId', '==', restaurantId),
        where('isAvailable', '==', true)
      );
      
      const menuItemsSnapshot = await getDocs(menuItemsQuery);
      const menuItemsList: MenuItem[] = [];
      
      menuItemsSnapshot.forEach((doc) => {
        const data = doc.data();
        menuItemsList.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          price: data.price,
          category: data.category,
          imageUrl: data.imageUrl,
          isAvailable: data.isAvailable,
          preparationTime: data.preparationTime,
          tags: data.tags || [],
          allergens: data.allergens || [],
          isVegetarian: data.isVegetarian,
          isVegan: data.isVegan,
          isGlutenFree: data.isGlutenFree,
          restaurantId: data.restaurantId,
        });
      });
      
      setMenuItems(menuItemsList);
      
      // Group items by category
      const categoryMap = new Map<string, MenuItem[]>();
      menuItemsList.forEach(item => {
        if (!categoryMap.has(item.category)) {
          categoryMap.set(item.category, []);
        }
        categoryMap.get(item.category)!.push(item);
      });
      
      const categoriesList: MenuCategory[] = [];
      categoryMap.forEach((items, categoryId) => {
        const categoryName = getCategoryName(categoryId);
        categoriesList.push({
          id: categoryId,
          name: categoryName,
          items: items.sort((a, b) => a.name.localeCompare(b.name)),
        });
      });
      
      // Sort categories by predefined order
      const categoryOrder = ['appetizers', 'mains', 'desserts', 'beverages'];
      categoriesList.sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a.id);
        const bIndex = categoryOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
      
      setCategories(categoriesList);
      
      // Set first category as selected
      if (categoriesList.length > 0) {
        setSelectedCategory(categoriesList[0].id);
      }
    } catch (error) {
      console.error('Error loading menu items:', error);
    }
  };

  const getCategoryName = (categoryId: string): string => {
    const categoryNames: { [key: string]: string } = {
      appetizers: 'Appetizers',
      mains: 'Main Courses',
      desserts: 'Desserts',
      beverages: 'Beverages',
    };
    return categoryNames[categoryId] || categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
  };

  const openItemModal = (item: MenuItem) => {
    setSelectedItem(item);
    setItemQuantity(1);
    setSpecialInstructions('');
    setShowItemModal(true);
  };

  const addToCart = () => {
    if (!selectedItem) return;
    
    const cartItem: CartItem = {
      menuItem: selectedItem,
      quantity: itemQuantity,
      specialInstructions: specialInstructions.trim() || undefined,
    };
    
    const existingItemIndex = cart.findIndex(
      item => item.menuItem.id === selectedItem.id && 
                item.specialInstructions === cartItem.specialInstructions
    );
    
    if (existingItemIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += itemQuantity;
      setCart(updatedCart);
    } else {
      setCart([...cart, cartItem]);
    }
    
    setShowItemModal(false);
    Alert.alert('Added to Cart', `${selectedItem.name} has been added to your cart!`);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.menuItem.price * item.quantity), 0);
  };

  const getSubtotal = () => getCartTotal();
  const getServiceCharge = () => restaurant ? (getSubtotal() * restaurant.serviceCharge / 100) : 0;
  const getTax = () => restaurant ? (getSubtotal() * restaurant.taxRate / 100) : 0;
  const getDeliveryFee = () => restaurant?.deliveryFee || 0;
  const getFinalTotal = () => getSubtotal() + getServiceCharge() + getTax() + getDeliveryFee();

  const canPlaceOrder = () => {
    if (!restaurant) return false;
    return getSubtotal() >= restaurant.minimumOrder;
  };

  const renderCategoryTab = (category: MenuCategory) => {
    const isSelected = selectedCategory === category.id;
    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryTab,
          { 
            backgroundColor: isSelected ? theme.primary : theme.inputBackground,
            borderColor: isSelected ? theme.primary : 'transparent'
          }
        ]}
        onPress={() => setSelectedCategory(category.id)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.categoryTabText,
          { color: isSelected ? '#fff' : theme.textSecondary }
        ]}>
          {category.name} ({category.items.length})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItemCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      onPress={() => openItemModal(item)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: item.imageUrl }} 
        style={styles.menuItemImage}
        resizeMode="cover"
      />
      
      <View style={styles.menuItemContent}>
        <View style={styles.menuItemHeader}>
          <View style={styles.menuItemInfo}>
            <Text style={[styles.menuItemName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.menuItemDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          
          <View style={styles.menuItemPrice}>
            <Text style={[styles.price, { color: theme.primary }]}>
              {formatPrice(item.price)}
            </Text>
          </View>
        </View>

        <View style={styles.menuItemFooter}>
          <View style={styles.menuItemBadges}>
            {item.preparationTime && (
              <View style={[styles.timeBadge, { backgroundColor: theme.info + '20' }]}>
                <Ionicons name="time-outline" size={12} color={theme.info} />
                <Text style={[styles.timeText, { color: theme.info }]}>{item.preparationTime}min</Text>
              </View>
            )}
            
            {item.isVegetarian && (
              <View style={[styles.dietBadge, { backgroundColor: theme.success + '20' }]}>
                <Text style={[styles.dietText, { color: theme.success }]}>V</Text>
              </View>
            )}
            
            {item.isVegan && (
              <View style={[styles.dietBadge, { backgroundColor: theme.success + '20' }]}>
                <Text style={[styles.dietText, { color: theme.success }]}>VG</Text>
              </View>
            )}
            
            {item.isGlutenFree && (
              <View style={[styles.dietBadge, { backgroundColor: theme.warning + '20' }]}>
                <Text style={[styles.dietText, { color: theme.warning }]}>GF</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => openItemModal(item)}
          >
            <Ionicons name="add" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderItemModal = () => (
    <Modal
      visible={showItemModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      {selectedItem && (
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowItemModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add to Cart</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Image 
              source={{ uri: selectedItem.imageUrl }} 
              style={styles.modalImage}
              resizeMode="cover"
            />
            
            <View style={styles.modalItemInfo}>
              <Text style={[styles.modalItemName, { color: theme.text }]}>
                {selectedItem.name}
              </Text>
              
              <Text style={[styles.modalItemDescription, { color: theme.textSecondary }]}>
                {selectedItem.description}
              </Text>
              
              <View style={styles.modalBadges}>
                {selectedItem.preparationTime && (
                  <View style={[styles.timeBadge, { backgroundColor: theme.info + '20' }]}>
                    <Ionicons name="time-outline" size={12} color={theme.info} />
                    <Text style={[styles.timeText, { color: theme.info }]}>{selectedItem.preparationTime} min</Text>
                  </View>
                )}
                
                {selectedItem.isVegetarian && (
                  <View style={[styles.dietBadge, { backgroundColor: theme.success + '20' }]}>
                    <Text style={[styles.dietText, { color: theme.success }]}>Vegetarian</Text>
                  </View>
                )}
                
                {selectedItem.isVegan && (
                  <View style={[styles.dietBadge, { backgroundColor: theme.success + '20' }]}>
                    <Text style={[styles.dietText, { color: theme.success }]}>Vegan</Text>
                  </View>
                )}
                
                {selectedItem.isGlutenFree && (
                  <View style={[styles.dietBadge, { backgroundColor: theme.warning + '20' }]}>
                    <Text style={[styles.dietText, { color: theme.warning }]}>Gluten Free</Text>
                  </View>
                )}
              </View>
              
              {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                <View style={styles.allergensContainer}>
                  <Text style={[styles.allergensTitle, { color: theme.text }]}>Allergens:</Text>
                  <Text style={[styles.allergensText, { color: theme.textSecondary }]}>
                    {selectedItem.allergens.join(', ')}
                  </Text>
                </View>
              )}
            </View>
            
            {/* Quantity Selector */}
            <View style={styles.quantityContainer}>
              <Text style={[styles.quantityLabel, { color: theme.text }]}>Quantity</Text>
              <View style={styles.quantitySelector}>
                <TouchableOpacity 
                  style={[styles.quantityButton, { backgroundColor: theme.inputBackground }]}
                  onPress={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                >
                  <Ionicons name="remove" size={20} color={theme.text} />
                </TouchableOpacity>
                
                <Text style={[styles.quantityText, { color: theme.text }]}>{itemQuantity}</Text>
                
                <TouchableOpacity 
                  style={[styles.quantityButton, { backgroundColor: theme.inputBackground }]}
                  onPress={() => setItemQuantity(itemQuantity + 1)}
                >
                  <Ionicons name="add" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Special Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={[styles.instructionsLabel, { color: theme.text }]}>Special Instructions (Optional)</Text>
              <TextInput
                style={[
                  styles.instructionsInput, 
                  { 
                    backgroundColor: theme.inputBackground, 
                    color: theme.text,
                    borderColor: theme.border
                  }
                ]}
                placeholder="Any special requests for this item..."
                placeholderTextColor={theme.placeholder}
                value={specialInstructions}
                onChangeText={setSpecialInstructions}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
          
          {/* Add to Cart Button */}
          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <TouchableOpacity 
              style={[styles.addToCartButton, { backgroundColor: theme.primary }]}
              onPress={addToCart}
            >
              <Text style={styles.addToCartButtonText}>
                Add {itemQuantity} to Cart • {formatPrice(selectedItem.price * itemQuantity)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading menu...</Text>
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="restaurant-outline" size={48} color={theme.textMuted} />
        <Text style={[styles.errorText, { color: theme.text }]}>Restaurant not found</Text>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={onBack}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedCategoryData = categories.find(cat => cat.id === selectedCategory);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={onBack} style={styles.headerBackButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.favoriteButton}
              onPress={() => setIsFavorite(!isFavorite)}
            >
              <Ionicons 
                name={isFavorite ? "heart" : "heart-outline"} 
                size={24} 
                color={isFavorite ? "#FF6B35" : "#fff"} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.shareButton}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Restaurant Info */}
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          <Text style={styles.restaurantCuisine}>{restaurant.cuisine.join(' • ')}</Text>
          <Text style={styles.restaurantAddress}>{restaurant.address}</Text>
          
          <View style={styles.restaurantStats}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.statText}>{restaurant.rating.toFixed(1)} ({restaurant.totalReviews})</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color="#fff" />
              <Text style={styles.statText}>{restaurant.estimatedDeliveryTime}</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="car-outline" size={16} color="#fff" />
              <Text style={styles.statText}>
                {restaurant.deliveryFee === 0 ? 'Free delivery' : formatPrice(restaurant.deliveryFee)}
              </Text>
            </View>
          </View>
          
          {/* Minimum Order Notice */}
          {restaurant.minimumOrder > 0 && (
            <View style={styles.minimumOrderNotice}>
              <Ionicons name="information-circle-outline" size={16} color="#fff" />
              <Text style={styles.minimumOrderText}>
                Minimum order: {formatPrice(restaurant.minimumOrder)}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <View style={[styles.categoryContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {categories.map(renderCategoryTab)}
          </ScrollView>
        </View>
      )}

      {/* Menu Items */}
      <ScrollView 
        style={styles.menuContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuScrollContent}
      >
        {selectedCategoryData && selectedCategoryData.items.length > 0 ? (
          <View style={styles.menuItemsContainer}>
            <Text style={[styles.categoryTitle, { color: theme.text }]}>
              {selectedCategoryData.name} ({selectedCategoryData.items.length} items)
            </Text>
            {selectedCategoryData.items.map(renderMenuItem)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.text }]}>No items in this category</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Try selecting a different category
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <View style={styles.cartContainer}>
          {!canPlaceOrder() && restaurant.minimumOrder > 0 && (
            <View style={[styles.minimumOrderWarning, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
              <Ionicons name="warning-outline" size={16} color={theme.warning} />
              <Text style={[styles.minimumOrderWarningText, { color: theme.warning }]}>
                Add {formatPrice(restaurant.minimumOrder - getSubtotal())} more to place order
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[
              styles.floatingCartButton, 
              { 
                backgroundColor: canPlaceOrder() ? theme.primary : theme.textMuted,
                opacity: canPlaceOrder() ? 1 : 0.7
              }
            ]}
            onPress={() => canPlaceOrder() && onNavigateToCart(cart)}
            disabled={!canPlaceOrder()}
          >
            <View style={styles.floatingCartContent}>
              <View style={styles.floatingCartLeft}>
                <View style={styles.cartIconContainer}>
                  <Ionicons name="bag" size={20} color="#fff" />
                  <View style={styles.cartCountBadge}>
                    <Text style={styles.cartCountText}>{getCartItemCount()}</Text>
                  </View>
                </View>
                <View style={styles.cartSummary}>
                  <Text style={styles.cartItemsText}>{getCartItemCount()} items</Text>
                  <Text style={styles.cartSubtotalText}>{formatPrice(getSubtotal())}</Text>
                </View>
              </View>
              
              <View style={styles.floatingCartRight}>
                <Text style={styles.floatingCartText}>View Cart</Text>
                <Text style={styles.floatingCartTotal}>{formatPrice(getFinalTotal())}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Item Detail Modal */}
      {renderItemModal()}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerBackButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  favoriteButton: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
  },
  restaurantInfo: {
    alignItems: 'flex-start',
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  restaurantCuisine: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },
  restaurantAddress: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 16,
  },
  restaurantStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  minimumOrderNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  minimumOrderText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
  },
  categoryContainer: {
    borderBottomWidth: 1,
  },
  categoryScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 25,
    borderWidth: 1,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuContent: {
    flex: 1,
  },
  menuScrollContent: {
    paddingBottom: 120,
  },
  menuItemsContainer: {
    padding: 20,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  menuItemCard: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  menuItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  menuItemPrice: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemBadges: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  dietBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  dietText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cartContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  minimumOrderWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  minimumOrderWarningText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  floatingCartButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
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
  cartIconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  cartCountBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cartSummary: {
    alignItems: 'flex-start',
  },
  cartItemsText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  cartSubtotalText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  floatingCartRight: {
    alignItems: 'flex-end',
  },
  floatingCartText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  floatingCartTotal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  },
  modalImage: {
    width: '100%',
    height: 200,
  },
  modalItemInfo: {
    padding: 20,
  },
  modalItemName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalItemDescription: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  modalBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  allergensContainer: {
    marginTop: 8,
  },
  allergensTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  allergensText: {
    fontSize: 14,
  },
  quantityContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'center',
  },
  instructionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  instructionsLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  instructionsInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
  },
  modalFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  addToCartButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RestaurantMenuScreen;