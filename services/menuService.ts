// services/menuService.ts
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
  serverTimestamp,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { FIREBASE_DB } from '../FirebaseConfig';

export interface MenuItem {
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

export interface MenuItemFormData {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  preparationTime: string;
  category: string;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isAvailable: boolean;
  tags: string[];
  allergens: string[];
}

export class MenuService {
  private static readonly COLLECTION_NAME = 'menuItems';

  /**
   * Fetch all menu items for a specific restaurant
   */
  static async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    try {
      const menuCollection = collection(FIREBASE_DB, this.COLLECTION_NAME);
      const q = query(
        menuCollection, 
        where('restaurantId', '==', restaurantId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
      
      const items: MenuItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({
          id: doc.id,
          ...doc.data()
        } as MenuItem);
      });
      
      return items;
    } catch (error) {
      console.error('Error fetching menu items:', error);
      throw new Error('Failed to fetch menu items');
    }
  }

  /**
   * Add a new menu item
   */
  static async addMenuItem(
    formData: MenuItemFormData, 
    restaurantId: string
  ): Promise<string> {
    try {
      // Validate form data
      this.validateMenuItemData(formData);

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
        restaurantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(FIREBASE_DB, this.COLLECTION_NAME), menuItem);
      return docRef.id;
    } catch (error) {
      console.error('Error adding menu item:', error);
      throw new Error('Failed to add menu item');
    }
  }

  /**
   * Update an existing menu item
   */
  static async updateMenuItem(
    itemId: string, 
    formData: MenuItemFormData
  ): Promise<void> {
    try {
      // Validate form data
      this.validateMenuItemData(formData);

      const menuItemRef = doc(FIREBASE_DB, this.COLLECTION_NAME, itemId);
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
    } catch (error) {
      console.error('Error updating menu item:', error);
      throw new Error('Failed to update menu item');
    }
  }

  /**
   * Delete a menu item
   */
  static async deleteMenuItem(itemId: string): Promise<void> {
    try {
      await deleteDoc(doc(FIREBASE_DB, this.COLLECTION_NAME, itemId));
    } catch (error) {
      console.error('Error deleting menu item:', error);
      throw new Error('Failed to delete menu item');
    }
  }

  /**
   * Toggle menu item availability
   */
  static async toggleAvailability(itemId: string, isAvailable: boolean): Promise<void> {
    try {
      const menuItemRef = doc(FIREBASE_DB, this.COLLECTION_NAME, itemId);
      await updateDoc(menuItemRef, {
        isAvailable: !isAvailable,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating availability:', error);
      throw new Error('Failed to update item availability');
    }
  }

  /**
   * Get menu items by category
   */
  static async getMenuItemsByCategory(
    restaurantId: string, 
    category: string
  ): Promise<MenuItem[]> {
    try {
      const menuCollection = collection(FIREBASE_DB, this.COLLECTION_NAME);
      const q = query(
        menuCollection,
        where('restaurantId', '==', restaurantId),
        where('category', '==', category),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const items: MenuItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({
          id: doc.id,
          ...doc.data()
        } as MenuItem);
      });
      
      return items;
    } catch (error) {
      console.error('Error fetching menu items by category:', error);
      throw new Error('Failed to fetch menu items by category');
    }
  }

  /**
   * Search menu items by name
   */
  static searchMenuItems(items: MenuItem[], searchQuery: string): MenuItem[] {
    if (!searchQuery.trim()) return items;
    
    const query = searchQuery.toLowerCase().trim();
    return items.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  /**
   * Filter menu items by category
   */
  static filterByCategory(items: MenuItem[], category: string): MenuItem[] {
    if (category === 'all') return items;
    return items.filter(item => item.category === category);
  }

  /**
   * Get category statistics
   */
  static getCategoryStats(items: MenuItem[]) {
    const stats = {
      all: items.length,
      appetizers: items.filter(item => item.category === 'appetizers').length,
      mains: items.filter(item => item.category === 'mains').length,
      desserts: items.filter(item => item.category === 'desserts').length,
      beverages: items.filter(item => item.category === 'beverages').length,
    };
    return stats;
  }

  /**
   * Validate menu item form data
   */
  private static validateMenuItemData(formData: MenuItemFormData): void {
    const errors: string[] = [];

    if (!formData.name.trim()) {
      errors.push('Item name is required');
    }

    if (!formData.description.trim()) {
      errors.push('Item description is required');
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.push('Valid price is required');
    }

    if (!formData.preparationTime || parseInt(formData.preparationTime) <= 0) {
      errors.push('Valid preparation time is required');
    }

    if (!formData.imageUrl.trim()) {
      errors.push('Image URL is required');
    } else if (!this.isValidUrl(formData.imageUrl)) {
      errors.push('Valid image URL is required');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  /**
   * Validate URL format
   */
  private static isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Format price for display
   */
  static formatPrice(price: number): string {
    return `$${price.toFixed(2)}`;
  }

  /**
   * Format preparation time for display
   */
  static formatPrepTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
  }

  /**
   * Get dietary restriction badges
   */
  static getDietaryBadges(item: MenuItem): string[] {
    const badges: string[] = [];
    if (item.isVegetarian) badges.push('V');
    if (item.isVegan) badges.push('VG');
    if (item.isGlutenFree) badges.push('GF');
    return badges;
  }

  /**
   * Check if item matches dietary preferences
   */
  static matchesDietaryPreferences(
    item: MenuItem, 
    preferences: { vegetarian?: boolean; vegan?: boolean; glutenFree?: boolean }
  ): boolean {
    if (preferences.vegetarian && !item.isVegetarian) return false;
    if (preferences.vegan && !item.isVegan) return false;
    if (preferences.glutenFree && !item.isGlutenFree) return false;
    return true;
  }
}

// Usage example in your component:
/*
import { MenuService, MenuItemFormData } from '../services/menuService';

// In your component:
const addMenuItem = async () => {
  try {
    setSaving(true);
    const itemId = await MenuService.addMenuItem(formData, user.uid);
    Alert.alert('Success', 'Menu item added successfully');
    fetchMenuItems();
  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setSaving(false);
  }
};
*/