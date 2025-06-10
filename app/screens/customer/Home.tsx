import React, { useState } from 'react';
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
} from 'react-native';
import { User } from 'firebase/auth';

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
  bgColor: string;
  image: string;
}

const CustomerHomeScreen = ({ user }: { user: User }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const promoOffers: PromoOffer[] = [
    {
      id: '1',
      title: 'UPTO',
      subtitle: 'On your first order',
      discount: '30% OFF',
      bgColor: '#2D3748',
      image: '🍝',
    },
    {
      id: '2',
      title: 'FREE',
      subtitle: 'Delivery on orders above $20',
      discount: 'DELIVERY',
      bgColor: '#FF6B35',
      image: '🚚',
    },
  ];

  const categories: FoodCategory[] = [
    { id: '1', name: 'Breakfast', icon: '🍳', bgColor: '#FFF3E0' },
    { id: '2', name: 'Healthy', icon: '🥗', bgColor: '#E8F5E8' },
    { id: '3', name: 'Dessert', icon: '🧁', bgColor: '#FFF0F5' },
    { id: '4', name: 'Meal', icon: '🍽️', bgColor: '#F0F8FF' },
    { id: '5', name: 'Pizza', icon: '🍕', bgColor: '#FFF8DC' },
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
    },
  ];

  const renderPromoOffer = ({ item, index }: { item: PromoOffer; index: number }) => (
    <TouchableOpacity 
      style={[styles.promoCard, { backgroundColor: item.bgColor }]}
    >
      <View style={styles.promoContent}>
        <View style={styles.promoTextContainer}>
          <Text style={styles.promoTitle}>{item.title}</Text>
          <Text style={styles.promoDiscount}>{item.discount}</Text>
          <Text style={styles.promoSubtitle}>{item.subtitle}</Text>
          <TouchableOpacity style={styles.orderNowButton}>
            <Text style={styles.orderNowText}>Order Now</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.promoImageContainer}>
          <Text style={styles.promoImage}>{item.image}</Text>
          <View style={styles.promoDecorations}>
            <View style={[styles.decoration, styles.decoration1]} />
            <View style={[styles.decoration, styles.decoration2]} />
            <View style={[styles.decoration, styles.decoration3]} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategory = ({ item }: { item: FoodCategory }) => (
    <TouchableOpacity 
      style={[
        styles.categoryCard,
        { backgroundColor: item.bgColor },
        selectedCategory === item.id && styles.selectedCategory
      ]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <View style={styles.categoryIconContainer}>
        <Text style={styles.categoryIcon}>{item.icon}</Text>
      </View>
      <Text style={styles.categoryName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderRestaurant = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity style={styles.restaurantCard}>
      <Image 
        source={{ uri: item.image }} 
        style={styles.restaurantImage}
        resizeMode="cover"
      />
      
      <View style={styles.restaurantContent}>
        <View style={styles.restaurantHeader}>
          <Text style={styles.restaurantName}>{item.name}</Text>
          <TouchableOpacity style={styles.favoriteButton}>
            <Text style={styles.favoriteIcon}>🤍</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.restaurantDetails}>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingIcon}>⭐</Text>
            <Text style={styles.rating}>{item.rating}</Text>
          </View>
          
          <View style={styles.deliveryContainer}>
            <Text style={styles.deliveryIcon}>🆓</Text>
            <Text style={styles.deliveryText}>Free</Text>
          </View>
          
          <View style={styles.timeContainer}>
            <Text style={styles.timeIcon}>🕐</Text>
            <Text style={styles.timeText}>{item.deliveryTime}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.locationContainer}>
          <Text style={styles.deliveryLabel}>Delivery To</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationText}>Banasree, B-Block</Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Text style={styles.notificationIcon}>🔔</Text>
          <View style={styles.notificationBadge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search foods and Ketchen"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Promo Offers */}
        <View style={styles.section}>
          <FlatList
            data={promoOffers}
            renderItem={renderPromoOffer}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promoList}
            snapToInterval={screenWidth - 60}
            decelerationRate="fast"
          />
          <View style={styles.promoIndicators}>
            {promoOffers.map((_, index) => (
              <View key={index} style={styles.indicator} />
            ))}
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        {/* Kitchen Near You */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kitchen Near You</Text>
          <FlatList
            data={restaurants}
            renderItem={renderRestaurant}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.restaurantsList}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  locationContainer: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginRight: 5,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#6B7280',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationIcon: {
    fontSize: 24,
  },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 50,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
    color: '#9CA3AF',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2D3748',
  },
  filterButton: {
    marginLeft: 15,
    backgroundColor: '#2D3748', // changed from '#4ADE80' (green) to dark grey
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIcon: {
    fontSize: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    marginLeft: 20,
    marginBottom: 15,
  },
  promoList: {
    paddingHorizontal: 20,
  },
  promoCard: {
    width: screenWidth - 80,
    borderRadius: 20,
    marginRight: 15,
    overflow: 'hidden',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 5,
  },
  promoSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 15,
  },
  orderNowButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  orderNowText: {
    color: '#2D3748',
    fontWeight: '600',
    fontSize: 14,
  },
  promoImageContainer: {
    position: 'relative',
    marginLeft: 20,
  },
  promoImage: {
    fontSize: 60,
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
    marginTop: 15,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 3,
  },
  categoriesList: {
    paddingHorizontal: 20,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: 15,
    borderRadius: 20,
    padding: 15,
    width: 80,
    minHeight: 100,
  },
  selectedCategory: {
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  categoryIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3748',
    textAlign: 'center',
  },
  restaurantsList: {
    paddingHorizontal: 20,
  },
  restaurantCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  restaurantImage: {
    width: '100%',
    height: 150,
  },
  restaurantContent: {
    padding: 15,
  },
  restaurantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3748',
    flex: 1,
  },
  favoriteButton: {
    padding: 5,
  },
  favoriteIcon: {
    fontSize: 18,
  },
  restaurantDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingIcon: {
    fontSize: 12,
    marginRight: 2,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  deliveryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deliveryIcon: {
    fontSize: 12,
    marginRight: 2,
  },
  deliveryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ADE80',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeIcon: {
    fontSize: 12,
    marginRight: 2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
});

export default CustomerHomeScreen;