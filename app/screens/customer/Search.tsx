import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatPrice } from '../../../services/currency';

interface SearchResult {
  id: string;
  name: string;
  type: 'restaurant' | 'dish';
  cuisine?: string;
  rating: number;
  price?: number;
  deliveryTime?: string;
  image: string;
  restaurant?: string;
  distance?: string;
  description?: string;
  restaurantId?: string;
  isAvailable?: boolean;
}

interface RecentSearch {
  id: string;
  query: string;
  type: 'recent';
  timestamp: number;
}

interface PopularSearch {
  id: string;
  query: string;
  icon: string;
  type: 'popular';
  category: string;
}

interface SearchScreenProps {
  onNavigateToMenu?: (restaurantId: string) => void;
  onNavigateToRestaurant?: (restaurantId: string) => void;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ 
  onNavigateToMenu, 
  onNavigateToRestaurant 
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'restaurants' | 'dishes'>('all');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const searchInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const popularSearches: PopularSearch[] = [
    { id: '1', query: 'Pizza', icon: 'pizza-outline', type: 'popular', category: 'Italian' },
    { id: '2', query: 'Burger', icon: 'fast-food-outline', type: 'popular', category: 'American' },
    { id: '3', query: 'Coffee', icon: 'cafe-outline', type: 'popular', category: 'Beverages' },
    { id: '4', query: 'Chicken', icon: 'restaurant-outline', type: 'popular', category: 'Grilled' },
    { id: '5', query: 'Rice', icon: 'leaf-outline', type: 'popular', category: 'Local' },
    { id: '6', query: 'Dessert', icon: 'ice-cream-outline', type: 'popular', category: 'Sweets' },
    { id: '7', query: 'Salad', icon: 'nutrition-outline', type: 'popular', category: 'Healthy' },
    { id: '8', query: 'Chinese', icon: 'restaurant-outline', type: 'popular', category: 'Asian' },
  ];

  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = () => {
    // In a real app, load from AsyncStorage
    const mockRecent: RecentSearch[] = [
      { id: '1', query: 'Nyama Choma', type: 'recent', timestamp: Date.now() - 86400000 },
      { id: '2', query: 'Ugali', type: 'recent', timestamp: Date.now() - 172800000 },
      { id: '3', query: 'Samosa', type: 'recent', timestamp: Date.now() - 259200000 },
      { id: '4', query: 'Pilau', type: 'recent', timestamp: Date.now() - 345600000 },
    ];
    setRecentSearches(mockRecent);
  };

  const saveRecentSearch = (query: string) => {
    const newSearch: RecentSearch = {
      id: Date.now().toString(),
      query,
      type: 'recent',
      timestamp: Date.now(),
    };
    
    const updatedRecent = [newSearch, ...recentSearches.filter(item => item.query !== query)]
      .slice(0, 10); // Keep only last 10 searches
    
    setRecentSearches(updatedRecent);
    // In a real app, save to AsyncStorage
  };

  const searchRestaurants = async (searchTerm: string): Promise<SearchResult[]> => {
      try {
        const restaurantsRef = collection(FIREBASE_DB, 'restaurants');
        const q = query(
          restaurantsRef,
          where('isActive', '==', true),
          limit(20)
        );
  
        const snapshot = await getDocs(q);
        const restaurants: SearchResult[] = [];
  
        snapshot.forEach((doc) => {
          const data = doc.data() as {
            name?: string;
            cuisine?: string[];
            rating?: number;
            estimatedDeliveryTime?: string;
            imageUrl?: string;
            isActive?: boolean;
          };
          const restaurantName = data.name?.toLowerCase() || '';
          const cuisineText = (data.cuisine || []).join(' ').toLowerCase();
          const searchTermLower = searchTerm.toLowerCase();
  
          // Check if search term matches restaurant name or cuisine
          if (restaurantName.includes(searchTermLower) || cuisineText.includes(searchTermLower)) {
            restaurants.push({
              id: doc.id,
              name: data.name || 'Unknown Restaurant',
              type: 'restaurant',
              cuisine: (data.cuisine || []).join(' • '),
              rating: data.rating || 4.0,
              deliveryTime: data.estimatedDeliveryTime || '30-45 min',
              image: data.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'Restaurant')}&background=FF6B35&color=fff&size=400`,
              distance: '1.5 km', // In a real app, calculate based on user location
            });
          }
        });
  
        return restaurants;
      } catch (error) {
        console.error('Error searching restaurants:', error);
        return [];
      }
    };

  const searchMenuItems = async (searchTerm: string): Promise<SearchResult[]> => {
      try {
        const menuItemsRef = collection(FIREBASE_DB, 'menuItems');
        const q = query(
          menuItemsRef,
          where('isAvailable', '==', true),
          limit(30)
        );
  
        const snapshot = await getDocs(q);
        const menuItems: SearchResult[] = [];
        const restaurantCache = new Map<string, any>();
  
        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          const itemName = data.name?.toLowerCase() || '';
          const description = data.description?.toLowerCase() || '';
          const category = data.category?.toLowerCase() || '';
          const searchTermLower = searchTerm.toLowerCase();
  
          // Check if search term matches item name, description, or category
          if (itemName.includes(searchTermLower) || description.includes(searchTermLower) || category.includes(searchTermLower)) {
            // Get restaurant data
            let restaurantData = restaurantCache.get(data.restaurantId);
            
            if (!restaurantData && data.restaurantId) {
              try {
                const restaurantDoc = await getDoc(doc(FIREBASE_DB, 'restaurants', data.restaurantId));
                if (restaurantDoc.exists()) {
                  restaurantData = restaurantDoc.data();
                  restaurantCache.set(data.restaurantId, restaurantData);
                }
              } catch (error) {
                console.warn('Error fetching restaurant data:', error);
              }
            }
  
            menuItems.push({
              id: docSnapshot.id,
              name: data.name || 'Unknown Item',
              type: 'dish',
              rating: 4.5, // In a real app, this would be item-specific rating
              price: data.price || 0,
              image: data.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'Food')}&background=10B981&color=fff&size=400`,
              restaurant: restaurantData?.name || 'Unknown Restaurant',
              restaurantId: data.restaurantId,
              description: data.description,
              distance: '1.5 km',
              isAvailable: data.isAvailable,
            });
          }
        }
  
        return menuItems;
      } catch (error) {
        console.error('Error searching menu items:', error);
        return [];
      }
    };

  const handleSearch = async (searchTerm: string) => {
    setSearchQuery(searchTerm);
    
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    // Animate fade out
    Animated.timing(fadeAnim, {
      toValue: 0.3,
      duration: 200,
      useNativeDriver: true,
    }).start();

    try {
      // Search both restaurants and menu items in parallel
      const [restaurants, menuItems] = await Promise.all([
        searchRestaurants(searchTerm),
        searchMenuItems(searchTerm)
      ]);

      const allResults = [...restaurants, ...menuItems];
      
      // Sort results by relevance (exact matches first, then partial matches)
      const sortedResults = allResults.sort((a, b) => {
        const aExact = a.name.toLowerCase().startsWith(searchTerm.toLowerCase()) ? 1 : 0;
        const bExact = b.name.toLowerCase().startsWith(searchTerm.toLowerCase()) ? 1 : 0;
        return bExact - aExact;
      });

      setSearchResults(sortedResults);
      
      // Save to recent searches if we have results
      if (sortedResults.length > 0) {
        saveRecentSearch(searchTerm);
      }
    } catch (error) {
      console.error('Error performing search:', error);
      Alert.alert('Search Error', 'Failed to search. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      
      // Animate fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePopularSearch = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  const handleResultPress = (result: SearchResult) => {
    if (result.type === 'restaurant') {
      onNavigateToMenu?.(result.id);
    } else if (result.type === 'dish' && result.restaurantId) {
      onNavigateToMenu?.(result.restaurantId);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setActiveFilter('all');
  };

  const removeRecentSearch = (id: string) => {
    const updatedRecent = recentSearches.filter(item => item.id !== id);
    setRecentSearches(updatedRecent);
    // In a real app, update AsyncStorage
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    // In a real app, clear AsyncStorage
  };

  const filteredResults = searchResults.filter(result => {
    if (activeFilter === 'all') return true;
    return activeFilter === 'restaurants' ? result.type === 'restaurant' : result.type === 'dish';
  });

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity 
      style={[styles.searchResultCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      activeOpacity={0.7}
      onPress={() => handleResultPress(item)}
    >
      <Image source={{ uri: item.image }} style={styles.resultImage} />
      <View style={styles.resultContent}>
        <Text style={[styles.resultName, { color: theme.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        
        {item.type === 'restaurant' ? (
          <>
            <Text style={[styles.resultCuisine, { color: theme.textSecondary }]}>{item.cuisine}</Text>
            <View style={styles.resultDetails}>
              <View style={[styles.ratingContainer, { backgroundColor: theme.warning + '20' }]}>
                <Ionicons name="star" size={12} color={theme.warning} />
                <Text style={[styles.rating, { color: theme.warning }]}>{item.rating.toFixed(1)}</Text>
              </View>
              <View style={[styles.timeContainer, { backgroundColor: theme.success + '20' }]}>
                <Ionicons name="time-outline" size={12} color={theme.success} />
                <Text style={[styles.timeText, { color: theme.success }]}>{item.deliveryTime}</Text>
              </View>
              <View style={[styles.distanceContainer, { backgroundColor: theme.info + '20' }]}>
                <Ionicons name="location-outline" size={12} color={theme.info} />
                <Text style={[styles.distanceText, { color: theme.info }]}>{item.distance}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.resultRestaurant, { color: theme.textSecondary }]}>{item.restaurant}</Text>
            {item.description && (
              <Text style={[styles.resultDescription, { color: theme.textMuted }]} numberOfLines={1}>
                {item.description}
              </Text>
            )}
            <View style={styles.resultDetails}>
              <View style={[styles.ratingContainer, { backgroundColor: theme.warning + '20' }]}>
                <Ionicons name="star" size={12} color={theme.warning} />
                <Text style={[styles.rating, { color: theme.warning }]}>{item.rating.toFixed(1)}</Text>
              </View>
              <View style={[styles.distanceContainer, { backgroundColor: theme.info + '20' }]}>
                <Ionicons name="location-outline" size={12} color={theme.info} />
                <Text style={[styles.distanceText, { color: theme.info }]}>{item.distance}</Text>
              </View>
              {item.price && (
                <Text style={[styles.price, { color: theme.primary }]}>{formatPrice(item.price)}</Text>
              )}
            </View>
          </>
        )}
      </View>
      <TouchableOpacity style={[styles.favoriteButton, { backgroundColor: theme.inputBackground }]}>
        <Ionicons name="heart-outline" size={20} color={theme.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRecentSearch = ({ item }: { item: RecentSearch }) => (
    <TouchableOpacity 
      style={[styles.recentSearchItem, { borderBottomColor: theme.separator }]}
      onPress={() => handleSearch(item.query)}
      activeOpacity={0.7}
    >
      <Ionicons name="time-outline" size={18} color={theme.textMuted} style={styles.recentSearchIcon} />
      <Text style={[styles.recentSearchText, { color: theme.text }]}>{item.query}</Text>
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => removeRecentSearch(item.id)}
      >
        <Ionicons name="close" size={16} color={theme.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderPopularSearch = ({ item }: { item: PopularSearch }) => (
    <TouchableOpacity 
      style={[styles.popularChip, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      onPress={() => handlePopularSearch(item.query)}
      activeOpacity={0.7}
    >
      <View style={[styles.popularIconContainer, { backgroundColor: theme.primary + '20' }]}>
        <Ionicons name={item.icon as any} size={16} color={theme.primary} />
      </View>
      <View style={styles.popularTextContainer}>
        <Text style={[styles.popularText, { color: theme.text }]}>{item.query}</Text>
        <Text style={[styles.popularCategory, { color: theme.textMuted }]}>{item.category}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFilterTab = (filter: 'all' | 'restaurants' | 'dishes', label: string, count: number) => {
    const isActive = activeFilter === filter;
    return (
      <TouchableOpacity
        style={[
          styles.filterTab,
          { backgroundColor: isActive ? theme.primary : theme.inputBackground }
        ]}
        onPress={() => setActiveFilter(filter)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.filterTabText,
          { color: isActive ? '#fff' : theme.textSecondary }
        ]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Search</Text>
        <Text style={styles.headerSubtitle}>Find your favorite food & restaurants</Text>
      </LinearGradient>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.inputBackground }]}>
          <Ionicons name="search-outline" size={20} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search for food or restaurants"
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor={theme.placeholder}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={{ height: 8 }} />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {searchQuery.length === 0 ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Popular Searches</Text>
                  <TouchableOpacity onPress={clearAllRecentSearches}>
                    <Text style={[styles.clearAllText, { color: theme.primary }]}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={recentSearches.slice(0, 5)}
                  renderItem={renderRecentSearch}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                />
              </View>
            )}

            
            {/* Search Tips */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Search Tips</Text>
              <View style={[styles.tipsContainer, { backgroundColor: theme.surface }]}>
                <View style={styles.tipItem}>
                  <Ionicons name="bulb-outline" size={20} color={theme.primary} />
                  <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                    Try searching for specific dishes like "Nyama Choma" or "Ugali"
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="restaurant-outline" size={20} color={theme.primary} />
                  <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                    Search by cuisine type like "Italian" or "Chinese"
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : (
          /* Search Results */
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.section}>
              <View style={styles.resultsHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {isSearching ? 'Searching...' : `Results for "${searchQuery}"`}
                </Text>
                {!isSearching && searchResults.length > 0 && (
                  <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
                    {filteredResults.length} found
                  </Text>
                )}
              </View>

              {/* Filter Tabs */}
              {searchResults.length > 0 && (
                <View style={styles.filterContainer}>
                  {renderFilterTab('all', 'All', searchResults.length)}
                  {renderFilterTab('restaurants', 'Restaurants', searchResults.filter(r => r.type === 'restaurant').length)}
                  {renderFilterTab('dishes', 'Dishes', searchResults.filter(r => r.type === 'dish').length)}
                </View>
              )}

              {isSearching ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Searching for delicious options...</Text>
                </View>
              ) : filteredResults.length > 0 ? (
                <FlatList
                  data={filteredResults}
                  renderItem={renderSearchResult}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                />
              ) : searchResults.length > 0 ? (
                <View style={styles.noFilterResultsContainer}>
                  <Ionicons name="filter-outline" size={48} color={theme.textMuted} />
                  <Text style={[styles.noResultsText, { color: theme.text }]}>No {activeFilter} found</Text>
                  <Text style={[styles.noResultsSubtext, { color: theme.textSecondary }]}>
                    Try a different filter or search term
                  </Text>
                </View>
              ) : (
                <View style={styles.noResultsContainer}>
                  <LinearGradient
                    colors={[theme.textMuted + '20', theme.textMuted + '10']}
                    style={styles.noResultsIconContainer}
                  >
                    <Ionicons name="search-outline" size={48} color={theme.textMuted} />
                  </LinearGradient>
                  <Text style={[styles.noResultsText, { color: theme.text }]}>No results found</Text>
                  <Text style={[styles.noResultsSubtext, { color: theme.textSecondary }]}>
                    Try searching for something else or check your spelling
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
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
  clearButton: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 14,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  recentSearchIcon: {
    marginRight: 12,
  },
  recentSearchText: {
    flex: 1,
    fontSize: 16,
  },
  removeButton: {
    padding: 8,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  popularItemWrapper: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  popularIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  popularTextContainer: {
    flex: 1,
  },
  popularText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  popularCategory: {
    fontSize: 12,
  },
  tipsContainer: {
    borderRadius: 12,
    padding: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  searchResultCard: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultCuisine: {
    fontSize: 14,
    marginBottom: 8,
  },
  resultRestaurant: {
    fontSize: 14,
    marginBottom: 4,
  },
  resultDescription: {
    fontSize: 12,
    marginBottom: 8,
  },
  resultDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 3,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 3,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 3,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 'auto',
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noFilterResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SearchScreen;