// services/userService.ts
import { doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { User, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { FIREBASE_DB } from '../FirebaseConfig';

export interface UserStats {
  totalOrders: number;
  totalSpent: number;
  averageRating: number;
  loyaltyPoints: number;
}

export interface UserPreferences {
  notifications: boolean;
  location: boolean;
  emailUpdates: boolean;
  smsUpdates: boolean;
}

export interface UserData {
  uid: string;
  name: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  dateOfBirth?: string;
  profilePicture?: string;
  userType: 'customer' | 'restaurant' | 'delivery';
  preferences: UserPreferences;
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  profileComplete: boolean;
}

export interface UpdateProfileData {
  name?: string;
  phoneNumber?: string;
  address?: string;
  dateOfBirth?: string;
  profilePicture?: string;
}

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'mobile_money' | 'bank_account';
  cardLastFour?: string;
  cardBrand?: string;
  phoneNumber?: string;
  bankName?: string;
  accountLastFour?: string;
  isDefault: boolean;
  expiryMonth?: number;
  expiryYear?: number;
  createdAt: string;
  updatedAt: string;
}

class UserService {
  /**
   * Get user data from Firestore
   */
  async getUserData(uid: string): Promise<UserData | null> {
    try {
      const userDoc = await getDoc(doc(FIREBASE_DB, 'users', uid));
      
      if (userDoc.exists()) {
        return userDoc.data() as UserData;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      throw new Error('Failed to load user data');
    }
  }

  /**
   * Create default user data
   */
  async createUserData(user: User, userType: 'customer' | 'restaurant' | 'delivery' = 'customer'): Promise<UserData> {
    const defaultUserData: UserData = {
      uid: user.uid,
      name: user.displayName || 'User',
      email: user.email || '',
      userType,
      preferences: {
        notifications: true,
        location: true,
        emailUpdates: true,
        smsUpdates: false,
      },
      stats: {
        totalOrders: 0,
        totalSpent: 0,
        averageRating: 0,
        loyaltyPoints: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      profileComplete: false,
    };

    try {
      await setDoc(doc(FIREBASE_DB, 'users', user.uid), defaultUserData);
      return defaultUserData;
    } catch (error) {
      console.error('Error creating user data:', error);
      throw new Error('Failed to create user profile');
    }
  }

  /**
   * Update user profile data
   */
  async updateProfile(user: User, updates: UpdateProfileData): Promise<void> {
    try {
      // Update Firebase Auth profile if name is being updated
      if (updates.name && updates.name !== user.displayName) {
        await updateProfile(user, {
          displayName: updates.name,
        });
      }

      // Update Firestore document
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
        profileComplete: true,
      };

      await updateDoc(doc(FIREBASE_DB, 'users', user.uid), updateData);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error('Failed to update profile');
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(uid: string, preferences: Partial<UserPreferences>): Promise<void> {
    try {
      await updateDoc(doc(FIREBASE_DB, 'users', uid), {
        'preferences': preferences,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw new Error('Failed to update preferences');
    }
  }

  /**
   * Update user password with reauthentication
   */
  async updatePassword(user: User, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Reauthenticate user first
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        throw new Error('Current password is incorrect');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('New password is too weak');
      } else {
        throw new Error('Failed to update password');
      }
    }
  }

  /**
   * Update user stats (orders, spending, etc.)
   */
  async updateStats(uid: string, stats: Partial<UserStats>): Promise<void> {
    try {
      const currentData = await this.getUserData(uid);
      if (currentData) {
        const updatedStats = {
          ...currentData.stats,
          ...stats,
        };
        
        await updateDoc(doc(FIREBASE_DB, 'users', uid), {
          'stats': updatedStats,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error updating stats:', error);
      throw new Error('Failed to update user statistics');
    }
  }

  /**
   * Get user addresses
   */
  async getUserAddresses(uid: string): Promise<Address[]> {
    try {
      const addressesQuery = query(
        collection(FIREBASE_DB, 'users', uid, 'addresses')
      );
      const addressesSnapshot = await getDocs(addressesQuery);
      
      return addressesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Address[];
    } catch (error) {
      console.error('Error getting user addresses:', error);
      throw new Error('Failed to load addresses');
    }
  }

  /**
   * Add user address
   */
  async addAddress(uid: string, address: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // If this is set as default, make all other addresses non-default first
      if (address.isDefault) {
        await this.setDefaultAddress(uid, null);
      }

      const addressRef = doc(collection(FIREBASE_DB, 'users', uid, 'addresses'));
      const addressWithTimestamps = {
        ...address,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await setDoc(addressRef, addressWithTimestamps);
      return addressRef.id;
    } catch (error) {
      console.error('Error adding address:', error);
      throw new Error('Failed to add address');
    }
  }

  /**
   * Update user address
   */
  async updateAddress(uid: string, addressId: string, updates: Partial<Omit<Address, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    try {
      // If this is being set as default, make all other addresses non-default first
      if (updates.isDefault) {
        await this.setDefaultAddress(uid, addressId);
      }

      await updateDoc(doc(FIREBASE_DB, 'users', uid, 'addresses', addressId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating address:', error);
      throw new Error('Failed to update address');
    }
  }

  /**
   * Delete user address
   */
  async deleteAddress(uid: string, addressId: string): Promise<void> {
    try {
      await deleteDoc(doc(FIREBASE_DB, 'users', uid, 'addresses', addressId));
    } catch (error) {
      console.error('Error deleting address:', error);
      throw new Error('Failed to delete address');
    }
  }

  /**
   * Set default address (helper method)
   */
  private async setDefaultAddress(uid: string, newDefaultId: string | null): Promise<void> {
    try {
      const addresses = await this.getUserAddresses(uid);
      
      // Update all addresses to non-default
      const updatePromises = addresses.map(address => {
        if (address.id === newDefaultId) return Promise.resolve(); // Skip the one we're setting as default
        
        return updateDoc(doc(FIREBASE_DB, 'users', uid, 'addresses', address.id), {
          isDefault: false,
          updatedAt: new Date().toISOString(),
        });
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error setting default address:', error);
    }
  }

  /**
   * Get user payment methods
   */
  async getPaymentMethods(uid: string): Promise<PaymentMethod[]> {
    try {
      const paymentMethodsQuery = query(
        collection(FIREBASE_DB, 'users', uid, 'paymentMethods')
      );
      const paymentMethodsSnapshot = await getDocs(paymentMethodsQuery);
      
      return paymentMethodsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentMethod[];
    } catch (error) {
      console.error('Error getting payment methods:', error);
      throw new Error('Failed to load payment methods');
    }
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(uid: string, paymentMethod: Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const paymentMethodRef = doc(collection(FIREBASE_DB, 'users', uid, 'paymentMethods'));
      const paymentMethodWithTimestamps = {
        ...paymentMethod,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await setDoc(paymentMethodRef, paymentMethodWithTimestamps);
      return paymentMethodRef.id;
    } catch (error) {
      console.error('Error adding payment method:', error);
      throw new Error('Failed to add payment method');
    }
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(uid: string, paymentMethodId: string, updates: Partial<Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    try {
      await updateDoc(doc(FIREBASE_DB, 'users', uid, 'paymentMethods', paymentMethodId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw new Error('Failed to update payment method');
    }
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(uid: string, paymentMethodId: string): Promise<void> {
    try {
      await deleteDoc(doc(FIREBASE_DB, 'users', uid, 'paymentMethods', paymentMethodId));
    } catch (error) {
      console.error('Error deleting payment method:', error);
      throw new Error('Failed to delete payment method');
    }
  }
}

export const userService = new UserService();