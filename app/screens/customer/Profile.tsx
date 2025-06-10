import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { User, signOut } from 'firebase/auth';
import { FIREBASE_AUTH } from '../../../FirebaseConfig';

interface ProfileMenuSection {
  title: string;
  items: ProfileMenuItem[];
}

interface ProfileMenuItem {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  action: 'navigate' | 'toggle' | 'action';
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
}

const ProfileScreen = ({ user }: { user: User }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(FIREBASE_AUTH);
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  const profileSections: ProfileMenuSection[] = [
    {
      title: 'Account',
      items: [
        {
          id: '1',
          icon: '👤',
          title: 'Edit Profile',
          subtitle: 'Update your personal information',
          action: 'navigate',
          onPress: () => console.log('Navigate to Edit Profile'),
        },
        {
          id: '2',
          icon: '📍',
          title: 'My Addresses',
          subtitle: 'Manage delivery addresses',
          action: 'navigate',
          onPress: () => console.log('Navigate to Addresses'),
        },
        {
          id: '3',
          icon: '💳',
          title: 'Payment Methods',
          subtitle: 'Manage cards and payment options',
          action: 'navigate',
          onPress: () => console.log('Navigate to Payment Methods'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          id: '4',
          icon: '🔔',
          title: 'Notifications',
          subtitle: 'Order updates and promotions',
          action: 'toggle',
          hasToggle: true,
          toggleValue: notificationsEnabled,
          onToggle: setNotificationsEnabled,
        },
        {
          id: '5',
          icon: '📍',
          title: 'Location Services',
          subtitle: 'Allow location access',
          action: 'toggle',
          hasToggle: true,
          toggleValue: locationEnabled,
          onToggle: setLocationEnabled,
        },
        {
          id: '6',
          icon: '🌙',
          title: 'Dark Mode',
          subtitle: 'Switch to dark theme',
          action: 'toggle',
          hasToggle: true,
          toggleValue: false,
          onToggle: (value) => console.log('Dark mode:', value),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: '7',
          icon: '📞',
          title: 'Help & Support',
          subtitle: 'Get help with your orders',
          action: 'navigate',
          onPress: () => console.log('Navigate to Help'),
        },
        {
          id: '8',
          icon: '⭐',
          title: 'Rate Our App',
          subtitle: 'Share your feedback',
          action: 'navigate',
          onPress: () => console.log('Rate app'),
        },
        {
          id: '9',
          icon: '📄',
          title: 'Terms & Privacy',
          subtitle: 'Read our policies',
          action: 'navigate',
          onPress: () => console.log('Navigate to Terms'),
        },
      ],
    },
  ];

  const renderMenuItem = (item: ProfileMenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={item.onPress}
      disabled={item.action === 'toggle'}
    >
      <View style={styles.menuItemLeft}>
        <View style={styles.iconContainer}>
          <Text style={styles.menuIcon}>{item.icon}</Text>
        </View>
        <View style={styles.menuItemText}>
          <Text style={styles.menuTitle}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          )}
        </View>
      </View>
      <View style={styles.menuItemRight}>
        {item.hasToggle ? (
          <Switch
            value={item.toggleValue}
            onValueChange={item.onToggle}
            trackColor={{ false: '#E5E7EB', true: '#FF6B35' }}
            thumbColor={item.toggleValue ? '#fff' : '#f4f3f4'}
          />
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section: ProfileMenuSection) => (
    <View key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.sectionContent}>
        {section.items.map(renderMenuItem)}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=FF6B35&color=fff&size=120`,
              }}
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.editAvatarButton}>
              <Text style={styles.editAvatarIcon}>📷</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user.displayName || 'User'}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>4.8</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>$248</Text>
              <Text style={styles.statLabel}>Spent</Text>
            </View>
          </View>
        </View>

        {/* Menu Sections */}
        {profileSections.map(renderSection)}

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutIcon}>🚪</Text>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
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
  profileHeader: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF6B35',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  editAvatarIcon: {
    fontSize: 14,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
    marginLeft: 20,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIcon: {
    fontSize: 18,
  },
  menuItemText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  menuItemRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '300',
  },
  signOutContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  signOutIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

export default ProfileScreen;