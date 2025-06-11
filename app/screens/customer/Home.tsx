import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { useTheme } from '../../../contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  image: string;
  isVerified?: boolean;
  distance?: string;
  isFavorite?: boolean;
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

const CustomerHomeScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const promoOffers: PromoOffer[] = [
    {
      id: '1',
      title: 'UPTO',
      subtitle: 'On your first order',
      discount: '30% OFF',
      bgColor: ['#FF6B35', '#F7931E'],
      image: 'restaurant-outline',
    },
    {
      id: '2',
      title: 'FREE',
      subtitle: 'Delivery on orders above $20',
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
    { id: '1', name: 'Breakfast', icon: 'sunny-outline', bgColor: '#FFF3E0' },
    { id: '2', name: 'Healthy', icon: 'leaf-outline', bgColor: '#E8F5E8' },
    { id: '3', name: 'Dessert', icon: 'ice-cream-outline', bgColor: '#FFF0F5' },
    { id: '4', name: 'Meal', icon: 'restaurant-outline', bgColor: '#F0F8FF' },
    { id: '5', name: 'Pizza', icon: 'pizza-outline', bgColor: '#FFF8DC' },
    { id: '6', name: 'Burger', icon: 'fast-food-outline', bgColor: '#FFE4E1' },
  ];

  const restaurants: Restaurant[] = [
    {
      id: '1',
      name: 'Rose Garden Restaurant',
      cuisine: 'Italian • Mediterranean',
      rating: 4.7,
      deliveryTime: '20 min',
      deliveryFee: 0,
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
      isVerified: true,
      distance: '1.2 km',
      isFavorite: false,
    },
    {
      id: '2',
      name: 'Spice Kitchen',
      cuisine: 'Indian • Spicy',
      rating: 4.5,
      deliveryTime: '25 min',
      deliveryFee: 2.99,
      image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop',
      isVerified: false,
      distance: '2.1 km',
      isFavorite: true,
    },
    {
      id: '3',
      name: 'Burger Palace',
      cuisine: 'American • Fast Food',
      rating: 4.3,
      deliveryTime: '15 min',
      deliveryFee: 1.99,
      image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop',
      isVerified: true,
      distance: '0.8 km',
      isFavorite: false,
    },
    {
      id: '4',
      name: 'Sushi Express',
      cuisine: 'Japanese • Fresh',
      rating: 4.8,
      deliveryTime: '30 min',
      deliveryFee: 3.99,
      image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=300&fit=crop',
      isVerified: true,
      distance: '3.2 km',
      isFavorite: true,
    },
  ];

  const toggleFavorite = (restaurantId: string) => {
    // In real app, this would update the favorite status in your backend
    console.log('Toggle favorite for restaurant:', restaurantId);
  };

  const renderPromoOffer = ({ item, index }: { item: PromoOffer; index: number }) => (
    <TouchableOpacity 
      style={[styles.promoCard, { width: screenWidth - 80 }]}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={item.bgColor as [import('react-native').ColorValue, import('react-native').ColorValue, ...import('react-native').ColorValue[]]}
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
            <View style={styles.promoDecorations}>
              <View style={[styles.decoration, styles.decoration1]} />
              <View style={[styles.decoration, styles.decoration2]} />
              <View style={[styles.decoration, styles.decoration3]} />
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
        onPress={() => setSelectedCategory(isSelected ? '' : item.id)}
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

  const renderRestaurant = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity 
      style={[styles.restaurantCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: item.image }} 
          style={styles.restaurantImage}
          resizeMode="cover"
        />
        {item.isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          </View>
        )}
        <TouchableOpacity 
          style={[styles.favoriteButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          onPress={() => toggleFavorite(item.id)}
        >
          <Ionicons 
            name={item.isFavorite ? "heart" : "heart-outline"} 
            size={20} 
            color={item.isFavorite ? "#FF6B35" : "#fff"} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.restaurantContent}>
        <View style={styles.restaurantHeader}>
          <Text style={[styles.restaurantName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.rating}>{item.rating}</Text>
          </View>
        </View>
        
        <Text style={[styles.cuisineText, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.cuisine}
        </Text>
        
        <View style={styles.restaurantDetails}>
          <View style={[styles.detailBadge, { backgroundColor: theme.success + '20' }]}>
            <Ionicons name="time-outline" size={12} color={theme.success} />
            <Text style={[styles.detailText, { color: theme.success }]}>{item.deliveryTime}</Text>
          </View>
          
          <View style={[styles.detailBadge, { backgroundColor: theme.info + '20' }]}>
            <Ionicons name="location-outline" size={12} color={theme.info} />
            <Text style={[styles.detailText, { color: theme.info }]}>{item.distance}</Text>
          </View>
          
          <View style={[styles.detailBadge, { backgroundColor: item.deliveryFee === 0 ? theme.success + '20' : theme.warning + '20' }]}>
            <Ionicons name="car-outline" size={12} color={item.deliveryFee === 0 ? theme.success : theme.warning} />
            <Text style={[styles.detailText, { color: item.deliveryFee === 0 ? theme.success : theme.warning }]}>
              {item.deliveryFee === 0 ? 'Free' : `$${item.deliveryFee}`}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <>
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
        <View style={styles.promoIndicators}>
          {promoOffers.map((_, index) => {
            const inputRange = [
              (index - 1) * (screenWidth - 60),
              index * (screenWidth - 60),
              (index + 1) * (screenWidth - 60),
            ];
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View 
                key={index} 
                style={[
                  styles.indicator, 
                  { backgroundColor: theme.primary, opacity }
                ]} 
              />
            );
          })}
        </View>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Categories</Text>
          <TouchableOpacity>
            <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
          </TouchableOpacity>
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

      {/* Section Title */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Restaurants Near You</Text>
          <TouchableOpacity>
            <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <LinearGradient
        colors={theme.primaryGradient as [import('react-native').ColorValue, import('react-native').ColorValue, ...import('react-native').ColorValue[]]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.locationContainer}>
            <Text style={styles.deliveryLabel}>Delivery To</Text>
            <TouchableOpacity style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#fff" style={styles.locationIcon} />
              <Text style={styles.locationText}>Banasree, B-Block</Text>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            <View style={styles.notificationBadge}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>
        
        {/* Welcome Message */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>
            Hello {user.displayName?.split(' ')[0] || 'Food Lover'}! 👋
          </Text>
          <Text style={styles.welcomeSubtext}>What would you like to eat today?</Text>
        </View>
      </LinearGradient>

      {/* Main Content */}
      <FlatList
        data={restaurants}
        renderItem={renderRestaurant}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.restaurantsList}
        ListHeaderComponent={renderHeader}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  locationContainer: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  welcomeContainer: {
    marginTop: 8,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterButton: {
    marginLeft: 12,
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  promoList: {
    paddingHorizontal: 20,
  },
  promoCard: {
    borderRadius: 20,
    marginRight: 16,
    overflow: 'hidden',
  },
  promoGradient: {
    borderRadius: 20,
  },
  promoContent: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  promoTextContainer: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  promoDiscount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 4,
  },
  promoSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 16,
  },
  orderNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    alignSelf: 'flex-start',
  },
  orderNowText: {
    color: '#2D3748',
    fontWeight: '600',
    fontSize: 14,
  },
  orderArrow: {
    marginLeft: 4,
  },
  promoImageContainer: {
    position: 'relative',
    marginLeft: 20,
  },
  promoIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoDecorations: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decoration: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 50,
  },
  decoration1: {
    width: 20,
    height: 20,
    top: 10,
    right: -10,
  },
  decoration2: {
    width: 15,
    height: 15,
    bottom: 20,
    left: -5,
  },
  decoration3: {
    width: 10,
    height: 10,
    top: 30,
    left: 10,
  },
  promoIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  categoriesList: {
    paddingHorizontal: 20,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: 16,
    borderRadius: 16,
    padding: 16,
    width: 90,
    minHeight: 100,
  },
  categoryIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  restaurantsList: {
    paddingBottom: 100,
  },
  restaurantCard: {
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
  },
  restaurantImage: {
    width: '100%',
    height: 160,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantContent: {
    padding: 16,
  },
  restaurantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 2,
  },
  cuisineText: {
    fontSize: 14,
    marginBottom: 12,
  },
  restaurantDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 3,
  },
});

export default CustomerHomeScreen;