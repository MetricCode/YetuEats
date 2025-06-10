import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
} from 'react-native';

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
}

interface RecentSearch {
  id: string;
  query: string;
  type: 'recent';
}

interface PopularSearch {
  id: string;
  query: string;
  icon: string;
  type: 'popular';
}

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const recentSearches: RecentSearch[] = [
    { id: '1', query: 'Pizza', type: 'recent' },
    { id: '2', query: 'Burger Palace', type: 'recent' },
    { id: '3', query: 'Chinese food', type: 'recent' },
    { id: '4', query: 'Healthy salad', type: 'recent' },
  ];

  const popularSearches: PopularSearch[] = [
    { id: '1', query: 'Pizza', icon: '🍕', type: 'popular' },
    { id: '2', query: 'Burger', icon: '🍔', type: 'popular' },
    { id: '3', query: 'Sushi', icon: '🍣', type: 'popular' },
    { id: '4', query: 'Pasta', icon: '🍝', type: 'popular' },
    { id: '5', query: 'Dessert', icon: '🧁', type: 'popular' },
    { id: '6', query: 'Coffee', icon: '☕', type: 'popular' },
  ];

  const mockSearchResults: SearchResult[] = [
    {
      id: '1',
      name: 'Margherita Pizza',
      type: 'dish',
      rating: 4.8,
      price: 12.99,
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
      restaurant: 'Rose Garden Restaurant',
    },
    {
      id: '2',
      name: 'Pizza Palace',
      type: 'restaurant',
      cuisine: 'Italian • Pizza',
      rating: 4.6,
      deliveryTime: '25 min',
      image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop',
    },
    {
      id: '3',
      name: 'Pepperoni Pizza',
      type: 'dish',
      rating: 4.7,
      price: 15.99,
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
      restaurant: 'Pizza Palace',
    },
  ];

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearching(true);
      // Simulate search delay
      setTimeout(() => {
        setSearchResults(mockSearchResults);
        setIsSearching(false);
      }, 500);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handlePopularSearch = (query: string) => {
    handleSearch(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity style={styles.searchResultCard}>
      <Image source={{ uri: item.image }} style={styles.resultImage} />
      <View style={styles.resultContent}>
        <Text style={styles.resultName}>{item.name}</Text>
        {item.type === 'restaurant' ? (
          <>
            <Text style={styles.resultCuisine}>{item.cuisine}</Text>
            <View style={styles.resultDetails}>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingIcon}>⭐</Text>
                <Text style={styles.rating}>{item.rating}</Text>
              </View>
              <View style={styles.timeContainer}>
                <Text style={styles.timeIcon}>🕐</Text>
                <Text style={styles.timeText}>{item.deliveryTime}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.resultRestaurant}>{item.restaurant}</Text>
            <View style={styles.resultDetails}>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingIcon}>⭐</Text>
                <Text style={styles.rating}>{item.rating}</Text>
              </View>
              <Text style={styles.price}>${item.price}</Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderRecentSearch = ({ item }: { item: RecentSearch }) => (
    <TouchableOpacity 
      style={styles.recentSearchItem}
      onPress={() => handleSearch(item.query)}
    >
      <Text style={styles.recentSearchIcon}>🕐</Text>
      <Text style={styles.recentSearchText}>{item.query}</Text>
      <TouchableOpacity style={styles.removeButton}>
        <Text style={styles.removeIcon}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderPopularSearch = ({ item }: { item: PopularSearch }) => (
    <TouchableOpacity 
      style={styles.popularChip}
      onPress={() => handlePopularSearch(item.query)}
    >
      <Text style={styles.popularIcon}>{item.icon}</Text>
      <Text style={styles.popularText}>{item.query}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for food or restaurants"
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {searchQuery.length === 0 ? (
          <>
            {/* Recent Searches */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <TouchableOpacity>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={recentSearches}
                renderItem={renderRecentSearch}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
              />
            </View>

            {/* Popular Searches */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Searches</Text>
              <View style={styles.popularGrid}>
                {popularSearches.map((item) => (
                  <TouchableOpacity 
                    key={item.id}
                    style={styles.popularChip}
                    onPress={() => handlePopularSearch(item.query)}
                  >
                    <Text style={styles.popularIcon}>{item.icon}</Text>
                    <Text style={styles.popularText}>{item.query}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : (
          /* Search Results */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isSearching ? 'Searching...' : `Results for "${searchQuery}"`}
            </Text>
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>🔍 Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsIcon}>😔</Text>
                <Text style={styles.noResultsText}>No results found</Text>
                <Text style={styles.noResultsSubtext}>
                  Try searching for something else
                </Text>
              </View>
            )}
          </View>
        )}
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
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInputContainer: {
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
  clearIcon: {
    fontSize: 16,
    color: '#9CA3AF',
    padding: 5,
  },
  section: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  clearAllText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recentSearchIcon: {
    fontSize: 16,
    marginRight: 12,
    color: '#9CA3AF',
  },
  recentSearchText: {
    flex: 1,
    fontSize: 16,
    color: '#2D3748',
  },
  removeButton: {
    padding: 8,
  },
  removeIcon: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    margin: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  popularIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  popularText: {
    fontSize: 14,
    color: '#2D3748',
    fontWeight: '500',
  },
  searchResultCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  resultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 4,
  },
  resultCuisine: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  resultRestaurant: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  resultDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
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
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
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
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginLeft: 'auto',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#6B7280',
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
});

export default SearchScreen;