// Minimalistic UsersManagement.tsx with In-App User Creation

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { FIREBASE_DB, FIREBASE_AUTH } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';

interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  userType: 'customer' | 'restaurant' | 'delivery';
  isActive: boolean;
  isBlocked: boolean;
  createdAt: any;
  createdByAdmin?: boolean;
  restaurantName?: string;
  vehicleType?: string;
}

interface CreateUserForm {
  name: string;
  email: string;
  phone: string;
  userType: 'customer' | 'restaurant' | 'delivery';
  restaurantName?: string;
  vehicleType?: string;
}

type FilterType = 'all' | 'customers' | 'restaurants' | 'delivery' | 'blocked';

const AdminUsersManagementScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    name: '',
    email: '',
    phone: '',
    userType: 'customer',
    restaurantName: '',
    vehicleType: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, selectedFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersSnapshot = await getDocs(
        query(collection(FIREBASE_DB, 'users'), orderBy('createdAt', 'desc'))
      );
      
      const usersList: AppUser[] = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown User',
          email: data.email || '',
          phone: data.phone || '',
          userType: data.userType || 'customer',
          isActive: data.isActive !== false,
          isBlocked: data.isBlocked || false,
          createdAt: data.createdAt,
          createdByAdmin: data.createdByAdmin || false,
          restaurantName: data.restaurantName,
          vehicleType: data.vehicleType,
        };
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone.includes(query)
      );
    }

    switch (selectedFilter) {
      case 'customers':
        filtered = filtered.filter(user => user.userType === 'customer');
        break;
      case 'restaurants':
        filtered = filtered.filter(user => user.userType === 'restaurant');
        break;
      case 'delivery':
        filtered = filtered.filter(user => user.userType === 'delivery');
        break;
      case 'blocked':
        filtered = filtered.filter(user => user.isBlocked);
        break;
    }

    setFilteredUsers(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      email: '',
      phone: '',
      userType: 'customer',
      restaurantName: '',
      vehicleType: '',
    });
  };

  const validateCreateForm = () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.phone.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createForm.email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (createForm.userType === 'restaurant' && !createForm.restaurantName?.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return false;
    }

    if (createForm.userType === 'delivery' && !createForm.vehicleType?.trim()) {
      Alert.alert('Error', 'Vehicle type is required');
      return false;
    }

    return true;
  };

  const requestAdminPassword = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      Alert.prompt(
        'Admin Authentication',
        'Enter your password to create user account',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => reject('cancelled') },
          {
            text: 'Create',
            onPress: (password) => {
              if (password?.trim()) {
                resolve(password.trim());
              } else {
                reject('no-password');
              }
            }
          }
        ],
        'secure-text'
      );
    });
  };

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const createUser = async () => {
    if (!validateCreateForm()) return;

    try {
      const adminPassword = await requestAdminPassword();
      setCreateLoading(true);

      const tempPassword = generateTempPassword();
      const adminEmail = user.email!;
      const adminUid = user.uid;

      // Step 1: Create the user account
      const userCredential = await createUserWithEmailAndPassword(
        FIREBASE_AUTH,
        createForm.email.trim(),
        tempPassword
      );

      const newUser = userCredential.user;
      const newUserUid = newUser.uid;

      // Step 2: IMMEDIATELY sign out the new user and sign admin back in
      await signOut(FIREBASE_AUTH);
      await signInWithEmailAndPassword(FIREBASE_AUTH, adminEmail, adminPassword);

      // Step 3: Update the user's display name (now that admin is back in control)
      // Note: We can't update the new user's profile directly since they're signed out
      // But we'll set the name in Firestore instead

      // Step 4: Prepare user data
      const userData: any = {
        uid: newUserUid,
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        userType: createForm.userType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        profileComplete: true,
        createdByAdmin: true,
        temporaryPassword: true,
        createdBy: adminUid,
      };

      // Add type-specific fields
      if (createForm.userType === 'restaurant') {
        userData.restaurantName = createForm.restaurantName?.trim();
        userData.isVerified = false;
        userData.isApproved = false;
      } else if (createForm.userType === 'delivery') {
        userData.vehicleType = createForm.vehicleType?.trim();
        userData.isVerified = false;
        userData.isApproved = false;
        userData.isAvailable = false;
      }

      // Step 5: Save to Firestore (admin has permissions)
      await setDoc(doc(FIREBASE_DB, 'users', newUserUid), userData);

      // Step 6: Create additional collections based on user type
      if (createForm.userType === 'restaurant') {
        await setDoc(doc(FIREBASE_DB, 'restaurants', newUserUid), {
          uid: newUserUid,
          name: createForm.restaurantName?.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone.trim(),
          isActive: true,
          isVerified: false,
          isApproved: false,
          createdAt: serverTimestamp(),
          createdBy: adminUid,
        });
      } else if (createForm.userType === 'delivery') {
        await setDoc(doc(FIREBASE_DB, 'delivery', newUserUid), {
          uid: newUserUid,
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone.trim(),
          vehicleType: createForm.vehicleType?.trim(),
          isActive: true,
          isVerified: false,
          isApproved: false,
          isAvailable: false,
          createdAt: serverTimestamp(),
          createdBy: adminUid,
        });
      }

      // Step 7: Send password reset email
      try {
        await sendPasswordResetEmail(FIREBASE_AUTH, createForm.email.trim());
        console.log('Password reset email sent successfully');
      } catch (emailError) {
        console.log('Password reset email failed:', emailError);
      }

      // Step 8: Success message
      Alert.alert(
        'User Created Successfully',
        `${createForm.userType.charAt(0).toUpperCase() + createForm.userType.slice(1)} account created for ${createForm.name}.\n\nA password reset email has been sent to ${createForm.email}.`,
        [{ 
          text: 'OK', 
          onPress: () => {
            setShowCreateModal(false);
            resetCreateForm();
          }
        }]
      );

      // Step 9: Reload users list
      await loadUsers();

    } catch (error: any) {
      console.error('Error creating user:', error);
      
      if (error === 'cancelled' || error === 'no-password') {
        return;
      }

      let errorMessage = 'Failed to create user account';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email address is already in use';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect admin password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check your admin privileges.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleUserBlocked = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(FIREBASE_DB, 'users', userId), {
        isBlocked: !currentStatus,
        updatedAt: serverTimestamp(),
      });
      
      await loadUsers();
      Alert.alert('Success', `User ${!currentStatus ? 'blocked' : 'unblocked'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update user status');
    }
  };

  const deleteUser = async (userId: string) => {
    Alert.alert(
      'Delete User',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from users collection
              await deleteDoc(doc(FIREBASE_DB, 'users', userId));
              
              // Also try to delete from type-specific collections
              try {
                await deleteDoc(doc(FIREBASE_DB, 'restaurants', userId));
              } catch (e) {
                // Ignore if document doesn't exist
              }
              
              try {
                await deleteDoc(doc(FIREBASE_DB, 'delivery', userId));
              } catch (e) {
                // Ignore if document doesn't exist
              }
              
              await loadUsers();
              Alert.alert('Success', 'User deleted successfully');
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'restaurant': return 'restaurant';
      case 'delivery': return 'bicycle';
      default: return 'person';
    }
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'restaurant': return '#F59E0B';
      case 'delivery': return '#10B981';
      default: return '#3B82F6';
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.primary }]}>
      <Text style={styles.headerTitle}>Users</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderFilters = () => (
    <View style={[styles.filtersContainer, { backgroundColor: theme.surface }]}>
      <TextInput
        style={[styles.searchInput, { 
          backgroundColor: theme.background, 
          color: theme.text,
          borderColor: theme.border 
        }]}
        placeholder="Search users..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor={theme.placeholder}
      />
      
      <View style={styles.filterTabs}>
        {[
          { key: 'all', label: 'All' },
          { key: 'customers', label: 'Customers' },
          { key: 'restaurants', label: 'Restaurants' },
          { key: 'delivery', label: 'Delivery' },
          { key: 'blocked', label: 'Blocked' },
        ].map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterTab,
              { 
                backgroundColor: selectedFilter === filter.key ? theme.primary : 'transparent',
                borderColor: theme.border
              }
            ]}
            onPress={() => setSelectedFilter(filter.key as FilterType)}
          >
            <Text style={[
              styles.filterTabText,
              { color: selectedFilter === filter.key ? '#fff' : theme.textSecondary }
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderUserCard = ({ item }: { item: AppUser }) => (
    <TouchableOpacity
      style={[styles.userCard, { backgroundColor: theme.surface }]}
      onPress={() => {
        setSelectedUser(item);
        setShowDetailsModal(true);
      }}
    >
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <View style={[styles.userIcon, { backgroundColor: getUserTypeColor(item.userType) }]}>
            <Ionicons name={getUserTypeIcon(item.userType) as any} size={20} color="#fff" />
          </View>
          
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.email}
            </Text>
            {(item.restaurantName || item.vehicleType) && (
              <Text style={[styles.userMeta, { color: theme.textMuted }]} numberOfLines={1}>
                {item.restaurantName || item.vehicleType}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.userActions}>
          {item.isBlocked ? (
            <View style={[styles.statusBadge, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.statusText}>Blocked</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: '#10B981' }]}>
              <Text style={styles.statusText}>Active</Text>
            </View>
          )}
          
          {item.createdByAdmin && (
            <View style={[styles.adminBadge, { backgroundColor: theme.warning }]}>
              <Ionicons name="construct" size={12} color="#fff" />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowCreateModal(false)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Create User</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* User Type Selection */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: theme.text }]}>User Type</Text>
            <View style={styles.userTypeSelector}>
              {[
                { key: 'customer', label: 'Customer', icon: 'person' },
                { key: 'restaurant', label: 'Restaurant', icon: 'restaurant' },
                { key: 'delivery', label: 'Delivery', icon: 'bicycle' },
              ].map(type => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.userTypeOption,
                    {
                      backgroundColor: createForm.userType === type.key ? theme.primary : theme.surface,
                      borderColor: theme.border
                    }
                  ]}
                  onPress={() => setCreateForm(prev => ({ ...prev, userType: type.key as any }))}
                >
                  <Ionicons 
                    name={type.icon as any} 
                    size={20} 
                    color={createForm.userType === type.key ? '#fff' : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.userTypeLabel,
                    { color: createForm.userType === type.key ? '#fff' : theme.text }
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Basic Information */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Name</Text>
            <TextInput
              style={[styles.formInput, { 
                backgroundColor: theme.surface, 
                color: theme.text,
                borderColor: theme.border 
              }]}
              placeholder="Enter full name"
              value={createForm.name}
              onChangeText={(text) => setCreateForm(prev => ({ ...prev, name: text }))}
              placeholderTextColor={theme.placeholder}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Email</Text>
            <TextInput
              style={[styles.formInput, { 
                backgroundColor: theme.surface, 
                color: theme.text,
                borderColor: theme.border 
              }]}
              placeholder="Enter email address"
              value={createForm.email}
              onChangeText={(text) => setCreateForm(prev => ({ ...prev, email: text }))}
              placeholderTextColor={theme.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: theme.text }]}>Phone</Text>
            <TextInput
              style={[styles.formInput, { 
                backgroundColor: theme.surface, 
                color: theme.text,
                borderColor: theme.border 
              }]}
              placeholder="Enter phone number"
              value={createForm.phone}
              onChangeText={(text) => setCreateForm(prev => ({ ...prev, phone: text }))}
              placeholderTextColor={theme.placeholder}
              keyboardType="phone-pad"
            />
          </View>

          {/* Type-specific fields */}
          {createForm.userType === 'restaurant' && (
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Restaurant Name</Text>
              <TextInput
                style={[styles.formInput, { 
                  backgroundColor: theme.surface, 
                  color: theme.text,
                  borderColor: theme.border 
                }]}
                placeholder="Enter restaurant name"
                value={createForm.restaurantName}
                onChangeText={(text) => setCreateForm(prev => ({ ...prev, restaurantName: text }))}
                placeholderTextColor={theme.placeholder}
              />
            </View>
          )}

          {createForm.userType === 'delivery' && (
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Vehicle Type</Text>
              <View style={styles.vehicleSelector}>
                {['Motorcycle', 'Bicycle', 'Car', 'Scooter'].map(vehicle => (
                  <TouchableOpacity
                    key={vehicle}
                    style={[
                      styles.vehicleOption,
                      {
                        backgroundColor: createForm.vehicleType === vehicle ? theme.primary : theme.surface,
                        borderColor: theme.border
                      }
                    ]}
                    onPress={() => setCreateForm(prev => ({ ...prev, vehicleType: vehicle }))}
                  >
                    <Text style={[
                      styles.vehicleLabel,
                      { color: createForm.vehicleType === vehicle ? '#fff' : theme.text }
                    ]}>
                      {vehicle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Info Note */}
          <View style={[styles.infoCard, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
            <Ionicons name="information-circle" size={20} color="#2196F3" />
            <Text style={[styles.infoText, { color: '#1976D2' }]}>
              You'll be asked to re-enter your password to create this user. They'll receive an email to set their own password.
            </Text>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: theme.primary }]}
            onPress={createUser}
            disabled={createLoading}
          >
            {createLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create User</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );

  const renderDetailsModal = () => (
    <Modal
      visible={showDetailsModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      {selectedUser && (
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>User Details</Text>
            <TouchableOpacity onPress={() => deleteUser(selectedUser.id)}>
              <Ionicons name="trash" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={[styles.detailCard, { backgroundColor: theme.surface }]}>
              <View style={styles.detailHeader}>
                <View style={[styles.userIcon, { backgroundColor: getUserTypeColor(selectedUser.userType) }]}>
                  <Ionicons name={getUserTypeIcon(selectedUser.userType) as any} size={24} color="#fff" />
                </View>
                <View>
                  <Text style={[styles.detailName, { color: theme.text }]}>{selectedUser.name}</Text>
                  <Text style={[styles.detailType, { color: getUserTypeColor(selectedUser.userType) }]}>
                    {selectedUser.userType.charAt(0).toUpperCase() + selectedUser.userType.slice(1)}
                    {selectedUser.createdByAdmin && ' • Admin Created'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailInfo}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Email</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{selectedUser.email}</Text>
              </View>

              <View style={styles.detailInfo}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Phone</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedUser.phone || 'Not provided'}
                </Text>
              </View>

              {selectedUser.restaurantName && (
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Restaurant</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{selectedUser.restaurantName}</Text>
                </View>
              )}

              {selectedUser.vehicleType && (
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Vehicle</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{selectedUser.vehicleType}</Text>
                </View>
              )}

              <View style={styles.switchContainer}>
                <Text style={[styles.switchLabel, { color: theme.text }]}>Block User</Text>
                <Switch
                  value={selectedUser.isBlocked}
                  onValueChange={() => toggleUserBlocked(selectedUser.id, selectedUser.isBlocked)}
                  trackColor={{ false: theme.border, true: '#EF4444' }}
                  thumbColor={selectedUser.isBlocked ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {renderHeader()}
      {renderFilters()}
      
      <FlatList
        data={filteredUsers}
        renderItem={renderUserCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No users found</Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.emptyButtonText}>Create First User</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {renderCreateModal()}
      {renderDetailsModal()}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchInput: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    fontSize: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    padding: 20,
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  userMeta: {
    fontSize: 12,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  adminBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    padding: 20,
  },
  // Create Form Styles
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    fontSize: 16,
  },
  userTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  userTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  userTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  vehicleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  vehicleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Detail Modal Styles
  detailCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
    marginBottom: 4,
  },
  detailType: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  detailInfo: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default AdminUsersManagementScreen;