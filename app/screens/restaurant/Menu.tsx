import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { formatPrice, getCurrencyPlaceholder, validatePrice } from '../../../services/currency';


interface MenuItem {
  id?: string;
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
  createdAt?: any;
  updatedAt?: any;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  itemCount: number;
}

const MenuManagementScreen = ({ user }: { user?: User }) => {
  const { theme, isDarkMode } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    preparationTime: '',
    category: 'mains',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    isAvailable: true,
    tags: [] as string[],
    allergens: [] as string[],
  });

  const categories: Category[] = [
    { id: 'all', name: 'All Items', icon: 'grid-outline', itemCount: menuItems.length },
    { id: 'mains', name: 'Main Courses', icon: 'pizza-outline', itemCount: menuItems.filter(item => item.category === 'mains').length },
    { id: 'desserts', name: 'Desserts', icon: 'ice-cream-outline', itemCount: menuItems.filter(item => item.category === 'desserts').length },
    { id: 'beverages', name: 'Beverages', icon: 'cafe-outline', itemCount: menuItems.filter(item => item.category === 'beverages').length },
  ];

  // Request camera permissions
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload images!');
      }
    })();
  }, []);

  // Fetch menu items from Firebase
  const fetchMenuItems = async () => {
    if (!user) {
      console.log('No user found');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Fetching menu items for user:', user.uid);
      setLoading(true);
      
      const menuCollection = collection(FIREBASE_DB, 'menuItems');
      const q = query(
        menuCollection, 
        where('restaurantId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      console.log('Query snapshot size:', querySnapshot.size);
      
      const items: MenuItem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Document data:', data);
        items.push({
          id: doc.id,
          ...data
        } as MenuItem);
      });
      
      items.sort((a, b) => a.name.localeCompare(b.name));
      console.log('Fetched items:', items.length);
      setMenuItems(items);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to load menu items: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Component mounted, user:', user?.uid);
    fetchMenuItems();
  }, [user]);

  // Upload image to Firebase Storage
  const uploadImageToFirebase = async (uri: string): Promise<string> => {
    try {
      setUploadingImage(true);
      
      // Create a unique filename
      const filename = `menu-items/${user?.uid}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      
      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Get Firebase Storage reference
      const storage = getStorage();
      const imageRef = ref(storage, filename);
      
      // Upload the image
      await uploadBytes(imageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(imageRef);
      
      console.log('Image uploaded successfully:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Pick image from library or camera
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // Show loading state
        Alert.alert('Uploading', 'Please wait while we upload your image...');
        
        try {
          const downloadURL = await uploadImageToFirebase(imageUri);
          setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
          Alert.alert('Success', 'Image uploaded successfully!');
        } catch (error) {
          Alert.alert('Error', 'Failed to upload image. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera permissions to take photos!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        Alert.alert('Uploading', 'Please wait while we upload your photo...');
        
        try {
          const downloadURL = await uploadImageToFirebase(imageUri);
          setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
          Alert.alert('Success', 'Photo uploaded successfully!');
        } catch (error) {
          Alert.alert('Error', 'Failed to upload photo. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Show image picker options
  const showImagePicker = () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to add an image',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Enter URL', onPress: () => {} }, // Keep URL option
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Reset form data
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      imageUrl: '',
      preparationTime: '',
      category: 'mains',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
      isAvailable: true,
      tags: [],
      allergens: [],
    });
  };

  // Enhanced validate form data with detailed logging
  const validateForm = () => {
    console.log('Validating form data:', formData);
    
    const errors = [];
    
    if (!formData.name.trim()) {
      errors.push('Item name is required');
    }
    
    if (!formData.description.trim()) {
      errors.push('Item description is required');
    }
    
    // Updated price validation for KES
    if (!formData.price || !validatePrice(formData.price)) {
      errors.push('Valid price in KES is required (e.g., 500)');
    }
    
    if (!formData.preparationTime || isNaN(parseInt(formData.preparationTime)) || parseInt(formData.preparationTime) <= 0) {
      errors.push('Valid preparation time is required');
    }
    
    if (!formData.imageUrl.trim()) {
      errors.push('Image is required');
    }
    
    if (errors.length > 0) {
      console.log('Validation errors:', errors);
      Alert.alert('Validation Error', errors.join('\n'));
      return false;
    }
    
    console.log('Form validation passed');
    return true;
  };

  // Enhanced add new menu item with detailed logging
  const addMenuItem = async () => {
    console.log('=== ADD MENU ITEM STARTED ===');
    console.log('User:', user?.uid);
    console.log('Form data before validation:', formData);
    
    if (!user) {
      console.log('No user found, aborting');
      Alert.alert('Error', 'No user found. Please log in again.');
      return;
    }
    
    if (!validateForm()) {
      console.log('Form validation failed, aborting');
      return;
    }

    try {
      setSaving(true);
      console.log('Starting to add menu item...');
      
      const menuItem: Omit<MenuItem, 'id'> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        category: formData.category,
        imageUrl: formData.imageUrl.trim(),
        isAvailable: formData.isAvailable,
        preparationTime: parseInt(formData.preparationTime),
        tags: formData.tags,
        allergens: formData.allergens,
        isVegetarian: formData.isVegetarian,
        isVegan: formData.isVegan,
        isGlutenFree: formData.isGlutenFree,
        restaurantId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('Menu item object to save:', menuItem);
      
      const menuCollection = collection(FIREBASE_DB, 'menuItems');
      console.log('Got collection reference');
      
      const docRef = await addDoc(menuCollection, menuItem);
      console.log('Menu item added successfully with ID:', docRef.id);
      
      Alert.alert('Success', 'Menu item added successfully!');
      setShowAddModal(false);
      resetForm();
      await fetchMenuItems(); // Refresh the list
      
    } catch (error) {
      console.error('=== ERROR ADDING MENU ITEM ===');
      console.error('Error object:', error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to add menu item: ${errorMessage}`);
    } finally {
      setSaving(false);
      console.log('=== ADD MENU ITEM FINISHED ===');
    }
  };

  // Update existing menu item
  const updateMenuItem = async () => {
    console.log('=== UPDATE MENU ITEM STARTED ===');
    
    if (!user || !editingItem?.id || !validateForm()) {
      console.log('Update validation failed');
      return;
    }

    try {
      setSaving(true);
      console.log('Updating menu item:', editingItem.id);
      
      const menuItemRef = doc(FIREBASE_DB, 'menuItems', editingItem.id);
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        category: formData.category,
        imageUrl: formData.imageUrl.trim(),
        isAvailable: formData.isAvailable,
        preparationTime: parseInt(formData.preparationTime),
        tags: formData.tags,
        allergens: formData.allergens,
        isVegetarian: formData.isVegetarian,
        isVegan: formData.isVegan,
        isGlutenFree: formData.isGlutenFree,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(menuItemRef, updateData);
      console.log('Menu item updated successfully');
      
      Alert.alert('Success', 'Menu item updated successfully!');
      setShowAddModal(false);
      setEditingItem(null);
      resetForm();
      await fetchMenuItems();
      
    } catch (error) {
      console.error('Error updating menu item:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to update menu item: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete menu item
  const deleteMenuItem = async (itemId: string) => {
    try {
      console.log('Deleting menu item:', itemId);
      await deleteDoc(doc(FIREBASE_DB, 'menuItems', itemId));
      console.log('Menu item deleted successfully');
      
      Alert.alert('Success', 'Menu item deleted successfully');
      fetchMenuItems();
    } catch (error) {
      console.error('Error deleting menu item:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to delete menu item: ${errorMessage}`);
    }
  };

  // Toggle item availability
  const toggleItemAvailability = async (item: MenuItem) => {
    if (!item.id) return;
    
    try {
      console.log('Toggling availability for item:', item.id);
      const menuItemRef = doc(FIREBASE_DB, 'menuItems', item.id);
      await updateDoc(menuItemRef, {
        isAvailable: !item.isAvailable,
        updatedAt: serverTimestamp(),
      });
      console.log('Availability updated successfully');
      
      fetchMenuItems();
    } catch (error) {
      console.error('Error updating availability:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to update item availability: ${errorMessage}`);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      imageUrl: item.imageUrl,
      preparationTime: item.preparationTime.toString(),
      category: item.category,
      isVegetarian: item.isVegetarian || false,
      isVegan: item.isVegan || false,
      isGlutenFree: item.isGlutenFree || false,
      isAvailable: item.isAvailable,
      tags: item.tags || [],
      allergens: item.allergens || [],
    });
    setShowAddModal(true);
  };

  const handleDeleteItem = (item: MenuItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => item.id && deleteMenuItem(item.id)
        }
      ]
    );
  };

  const handleAddNewItem = () => {
    console.log('Opening add new item modal');
    setEditingItem(null);
    resetForm();
    setShowAddModal(true);
  };

  // Enhanced save handler with logging
  const handleSaveItem = async () => {
    console.log('=== SAVE ITEM CLICKED ===');
    console.log('Editing item:', editingItem?.id || 'NEW ITEM');
    console.log('Saving state:', saving);
    
    if (saving || uploadingImage) {
      console.log('Already saving or uploading, ignoring click');
      return;
    }
    
    try {
      if (editingItem) {
        console.log('Calling updateMenuItem');
        await updateMenuItem();
      } else {
        console.log('Calling addMenuItem');
        await addMenuItem();
      }
    } catch (error) {
      console.error('Error in handleSaveItem:', error);
    }
  };

  const renderCategoryTab = (category: Category) => {
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
        <Ionicons 
          name={category.icon as any} 
          size={18} 
          color={isSelected ? '#fff' : theme.textSecondary}
        />
        <Text style={[
          styles.categoryTabText,
          { color: isSelected ? '#fff' : theme.textSecondary }
        ]}>
          {category.name}
        </Text>
        <View style={[
          styles.categoryBadge,
          { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : theme.primary }
        ]}>
          <Text style={styles.categoryBadgeText}>{category.itemCount}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={[styles.menuItemCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <Image 
        source={{ uri: item.imageUrl }} 
        style={styles.itemImage}
        defaultSource={require('../../../assets/favicon.png')}
        onError={() => console.log('Failed to load image:', item.imageUrl)}
      />
      
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.itemDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          <View style={styles.itemActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditItem(item)}
            >
              <Ionicons name="create-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteItem(item)}
            >
              <Ionicons name="trash-outline" size={20} color={theme.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.itemDetails}>
          {/* Updated price display for KES */}
          <Text style={[styles.itemPrice, { color: theme.primary }]}>
            {formatPrice(item.price)}
          </Text>
          <View style={styles.itemBadges}>
            <View style={[styles.timeBadge, { backgroundColor: theme.info + '20' }]}>
              <Ionicons name="time-outline" size={12} color={theme.info} />
              <Text style={[styles.timeText, { color: theme.info }]}>{item.preparationTime} min</Text>
            </View>
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
        </View>

        {item.tags && item.tags.length > 0 && (
          <View style={styles.itemTags}>
            {item.tags.map((tag, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.itemFooter}>
          <View style={styles.availabilityContainer}>
            <Text style={[styles.availabilityLabel, { color: theme.textSecondary }]}>
              Available
            </Text>
            <Switch
              value={item.isAvailable}
              onValueChange={() => toggleItemAvailability(item)}
              trackColor={{ false: theme.border, true: theme.success }}
              thumbColor={item.isAvailable ? '#fff' : '#f4f3f4'}
              ios_backgroundColor={theme.border}
            />
          </View>
          <View style={[
            styles.availabilityStatus,
            { backgroundColor: item.isAvailable ? theme.success + '20' : theme.error + '20' }
          ]}>
            <Ionicons 
              name={item.isAvailable ? "checkmark-circle" : "close-circle"} 
              size={14} 
              color={item.isAvailable ? theme.success : theme.error} 
            />
            <Text style={[
              styles.availabilityText,
              { color: item.isAvailable ? theme.success : theme.error }
            ]}>
              {item.isAvailable ? 'Available' : 'Out of Stock'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAddEditModal = () => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => {
            console.log('Closing modal');
            setShowAddModal(false);
            setEditingItem(null);
            resetForm();
          }}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            {editingItem ? 'Edit Item' : 'Add New Item'}
          </Text>
          <TouchableOpacity 
            onPress={handleSaveItem} 
            disabled={saving || uploadingImage}
            style={[styles.saveButtonContainer, { opacity: (saving || uploadingImage) ? 0.6 : 1 }]}
          >
            {(saving || uploadingImage) ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[styles.saveButton, { color: theme.primary }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Item Name *</Text>
            <TextInput
              style={[
                styles.formInput, 
                { 
                  backgroundColor: theme.inputBackground, 
                  color: theme.text,
                  borderColor: isDarkMode ? '#4B5563' : '#D1D5DB'
                }
              ]}
              placeholder="Enter item name"
              placeholderTextColor={theme.placeholder}
              value={formData.name}
              onChangeText={(text) => {
                console.log('Name changed:', text);
                setFormData(prev => ({ ...prev, name: text }));
              }}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Description *</Text>
            <TextInput
              style={[
                styles.formInput, 
                styles.textArea, 
                { 
                  backgroundColor: theme.inputBackground, 
                  color: theme.text,
                  borderColor: isDarkMode ? '#4B5563' : '#D1D5DB'
                }
              ]}
              placeholder="Enter item description"
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={3}
              value={formData.description}
              onChangeText={(text) => {
                console.log('Description changed:', text);
                setFormData(prev => ({ ...prev, description: text }));
              }}
            />
          </View>

          <View style={styles.formRow}>
              <View style={[styles.formSection, { flex: 1, marginRight: 10 }]}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Price (KES) *</Text>
                <View style={styles.priceInputContainer}>
                  <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>KES</Text>
                  <TextInput
                    style={[
                      styles.priceInput, 
                      { 
                        backgroundColor: theme.inputBackground, 
                        color: theme.text,
                        borderColor: isDarkMode ? '#4B5563' : '#D1D5DB'
                      }
                    ]}
                    placeholder={getCurrencyPlaceholder(formData.category)}
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                    value={formData.price}
                    onChangeText={(text) => {
                      // Only allow numbers and decimal point
                      const cleanText = text.replace(/[^0-9.]/g, '');
                      console.log('Price changed:', cleanText);
                      setFormData(prev => ({ ...prev, price: cleanText }));
                    }}
                  />
                </View>
                <Text style={[styles.priceHint, { color: theme.textMuted }]}>
                  Example: {getCurrencyPlaceholder(formData.category)}
                </Text>
              </View>
              <View style={[styles.formSection, { flex: 1, marginLeft: 10 }]}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Prep Time (min) *</Text>
                <TextInput
                  style={[
                    styles.formInput, 
                    { 
                      backgroundColor: theme.inputBackground, 
                      color: theme.text,
                      borderColor: isDarkMode ? '#4B5563' : '#D1D5DB'
                    }
                  ]}
                  placeholder="15"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                  value={formData.preparationTime}
                  onChangeText={(text) => {
                    console.log('Prep time changed:', text);
                    setFormData(prev => ({ ...prev, preparationTime: text }));
                  }}
                />
              </View>
            </View>

          {/* Enhanced Image Section */}
          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Product Image *</Text>
            
            {/* Image Preview */}
            {formData.imageUrl ? (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: formData.imageUrl }} 
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                >
                  <Ionicons name="close-circle" size={24} color={theme.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.imageUploadContainer, { backgroundColor: theme.inputBackground, borderColor: isDarkMode ? '#4B5563' : '#D1D5DB' }]}>
                <Ionicons name="camera-outline" size={48} color={theme.textMuted} />
                <Text style={[styles.imageUploadText, { color: theme.textMuted }]}>
                  No image selected
                </Text>
              </View>
            )}

            {/* Image Action Buttons */}
            <View style={styles.imageButtonsContainer}>
              <TouchableOpacity 
                style={[styles.imageButton, { backgroundColor: theme.primary }]}
                onPress={takePhoto}
                disabled={uploadingImage}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.imageButtonText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.imageButton, { backgroundColor: theme.success }]}
                onPress={pickImage}
                disabled={uploadingImage}
              >
                <Ionicons name="images" size={20} color="#fff" />
                <Text style={styles.imageButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {/* URL Input Option */}
            <Text style={[styles.orText, { color: theme.textMuted }]}>Or enter image URL:</Text>
            <TextInput
              style={[
                styles.formInput, 
                { 
                  backgroundColor: theme.inputBackground, 
                  color: theme.text,
                  borderColor: isDarkMode ? '#4B5563' : '#D1D5DB'
                }
              ]}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor={theme.placeholder}
              value={formData.imageUrl}
              onChangeText={(text) => {
                console.log('Image URL changed:', text);
                setFormData(prev => ({ ...prev, imageUrl: text }));
              }}
            />
            
            {uploadingImage && (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.uploadingText, { color: theme.primary }]}>
                  Uploading image...
                </Text>
              </View>
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Category</Text>
            <View style={styles.categorySelector}>
              {categories.filter(cat => cat.id !== 'all').map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    { 
                      backgroundColor: theme.inputBackground,
                      borderColor: formData.category === category.id ? theme.primary : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                      borderWidth: 2
                    }
                  ]}
                  onPress={() => {
                    console.log('Category changed:', category.id);
                    setFormData(prev => ({ ...prev, category: category.id }));
                  }}
                >
                  <Ionicons name={category.icon as any} size={16} color={theme.textSecondary} />
                  <Text style={[styles.categoryOptionText, { color: theme.text }]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Options</Text>
            <View style={styles.dietaryOptions}>
              <View style={styles.dietaryOption}>
                <Text style={[styles.dietaryLabel, { color: theme.text }]}>Available</Text>
                <Switch
                  value={formData.isAvailable}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isAvailable: value }))}
                  trackColor={{ false: theme.border, true: theme.success }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading menu items...</Text>
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
        <Text style={styles.headerTitle}>Menu Management</Text>
        <Text style={styles.headerSubtitle}>Manage your restaurant menu</Text>
      </LinearGradient>

      {/* Search and Add */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInputContainer, { 
          backgroundColor: theme.inputBackground,
          borderWidth: 1,
          borderColor: isDarkMode ? '#4B5563' : '#D1D5DB'
        }]}>
          <Ionicons name="search-outline" size={20} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search menu items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.placeholder}
          />
        </View>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={handleAddNewItem}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
      <View style={[styles.categoryContainer, { backgroundColor: theme.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {categories.map(renderCategoryTab)}
        </ScrollView>
      </View>

      {/* Menu Items */}
      <FlatList
        data={filteredItems}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item.id || ''}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.text }]}>No items found</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              {searchQuery ? 'Try a different search term' : 'Add your first menu item'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={[styles.emptyAddButton, { backgroundColor: theme.primary }]}
                onPress={handleAddNewItem}
              >
                <Text style={styles.emptyAddButtonText}>Add Menu Item</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {renderAddEditModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  debugText: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    opacity: 0.7,
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
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
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
  addButton: {
    marginLeft: 12,
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  categoryScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 25,
    borderWidth: 1,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    marginRight: 8,
  },
  categoryBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  menuList: {
    padding: 20,
    paddingBottom: 100,
  },
  menuItemCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  itemImage: {
    width: '100%',
    height: 120,
  },
  itemContent: {
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  dietBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dietText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  availabilityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyAddButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButtonContainer: {
    minWidth: 50,
    alignItems: 'center',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
  },
  categoryOptionText: {
    fontSize: 14,
    marginLeft: 6,
  },
  dietaryOptions: {
    gap: 12,
  },
  dietaryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dietaryLabel: {
    fontSize: 16,
  },
  helpText: {
    fontSize: 13,
    marginTop: 6,
    opacity: 0.7,
  },
  // New Image Upload Styles
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  imageUploadContainer: {
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  imageUploadText: {
    fontSize: 16,
    marginTop: 8,
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  imageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  orText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  uploadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  currencyPrefix: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    fontSize: 16,
    fontWeight: '600',
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 0, // Remove border since container has border
  },
  priceHint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default MenuManagementScreen;