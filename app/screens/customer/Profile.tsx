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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User, signOut } from 'firebase/auth';
import { FIREBASE_AUTH } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

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
  iconColor?: string;
}

const ProfileScreen = ({ user }: { user: User }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
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
          icon: 'person-outline',
          title: 'Edit Profile',
          subtitle: 'Update your personal information',
          action: 'navigate',
          iconColor: '#4F46E5',
          onPress: () => console.log('Navigate to Edit Profile'),
        },
        {
          id: '2',
          icon: 'location-outline',
          title: 'My Addresses',
          subtitle: 'Manage delivery addresses',
          action: 'navigate',
          iconColor: '#059669',
          onPress: () => console.log('Navigate to Addresses'),
        },
        {
          id: '3',
          icon: 'card-outline',
          title: 'Payment Methods',
          subtitle: 'Manage cards and payment options',
          action: 'navigate',
          iconColor: '#DC2626',
          onPress: () => console.log('Navigate to Payment Methods'),
        },
        {
          id: '4',
          icon: 'gift-outline',
          title: 'Loyalty Points',
          subtitle: '1,250 points available',
          action: 'navigate',
          iconColor: '#F59E0B',
          onPress: () => console.log('Navigate to Loyalty'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          id: '5',
          icon: 'notifications-outline',
          title: 'Notifications',
          subtitle: 'Order updates and promotions',
          action: 'toggle',
          hasToggle: true,
          toggleValue: notificationsEnabled,
          iconColor: '#8B5CF6',
          onToggle: setNotificationsEnabled,
        },
        {
          id: '6',
          icon: 'location-outline',
          title: 'Location Services',
          subtitle: 'Allow location access',
          action: 'toggle',
          hasToggle: true,
          toggleValue: locationEnabled,
          iconColor: '#06B6D4',
          onToggle: setLocationEnabled,
        },
        {
          id: '7',
          icon: isDarkMode ? 'sunny-outline' : 'moon-outline',
          title: 'Dark Mode',
          subtitle: isDarkMode ? 'Switch to light theme' : 'Switch to dark theme',
          action: 'toggle',
          hasToggle: true,
          toggleValue: isDarkMode,
          iconColor: isDarkMode ? '#F59E0B' : '#6B7280',
          onToggle: toggleTheme,
        },
        {
          id: '8',
          icon: 'language-outline',
          title: 'Language',
          subtitle: 'English (US)',
          action: 'navigate',
          iconColor: '#EC4899',
          onPress: () => console.log('Navigate to Language'),
        },
      ],
    },
    {
      title: 'Support & Legal',
      items: [
        {
          id: '9',
          icon: 'help-circle-outline',
          title: 'Help & Support',
          subtitle: 'Get help with your orders',
          action: 'navigate',
          iconColor: '#10B981',
          onPress: () => console.log('Navigate to Help'),
        },
        {
          id: '10',
          icon: 'star-outline',
          title: 'Rate Our App',
          subtitle: 'Share your feedback',
          action: 'navigate',
          iconColor: '#F59E0B',
          onPress: () => console.log('Rate app'),
        },
        {
          id: '11',
          icon: 'document-text-outline',
          title: 'Terms & Privacy',
          subtitle: 'Read our policies',
          action: 'navigate',
          iconColor: '#6366F1',
          onPress: () => console.log('Navigate to Terms'),
        },
        {
          id: '12',
          icon: 'information-circle-outline',
          title: 'About',
          subtitle: 'App info and version',
          action: 'navigate',
          iconColor: '#84CC16',
          onPress: () => console.log('Navigate to About'),
        },
      ],
    },
  ];

  const renderMenuItem = (item: ProfileMenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, { backgroundColor: theme.surface }]}
      onPress={item.onPress}
      disabled={item.action === 'toggle'}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: item.iconColor + '15' }]}>
          <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
        </View>
        <View style={styles.menuItemText}>
          <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
          {item.subtitle && (
            <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
          )}
        </View>
      </View>
      <View style={styles.menuItemRight}>
        {item.hasToggle ? (
          <Switch
            value={item.toggleValue}
            onValueChange={item.onToggle}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={item.toggleValue ? '#fff' : '#f4f3f4'}
            ios_backgroundColor={theme.border}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section: ProfileMenuSection) => (
    <View key={section.title} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
        {section.items.map((item, index) => (
          <View key={item.id}>
            {renderMenuItem(item)}
            {index < section.items.length - 1 && <View style={[styles.separator, { backgroundColor: theme.separator }]} />}
          </View>
        ))}
      </View>
    </View>
  );

  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.background,
    },
    statsContainer: {
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.95)',
    },
    statNumber: {
      color: isDarkMode ? '#fff' : '#2D3748',
    },
    statLabel: {
      color: isDarkMode ? theme.textSecondary : '#6B7280',
    },
    quickActionText: {
      color: theme.text,
    },
    versionText: {
      color: theme.textMuted,
    },
    copyrightText: {
      color: theme.textMuted,
    },
  });

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={theme.primaryGradient as [string, string, ...string[]]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=fff&color=FF6B35&size=120`,
              }}
              style={styles.avatar}
            />
            <TouchableOpacity style={[styles.editAvatarButton, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user.displayName || 'Valued Customer'}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          
          {/* Stats Container */}
          <View style={[styles.statsContainer, dynamicStyles.statsContainer]}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="bag-handle" size={20} color={theme.primary} />
              </View>
              <Text style={[styles.statNumber, dynamicStyles.statNumber]}>12</Text>
              <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Orders</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="star" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.statNumber, dynamicStyles.statNumber]}>4.8</Text>
              <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Rating</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="wallet" size={20} color="#059669" />
              </View>
              <Text style={[styles.statNumber, dynamicStyles.statNumber]}>$248</Text>
              <Text style={[styles.statLabel, dynamicStyles.statLabel]}>Spent</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.quickActionButton}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="receipt-outline" size={24} color="#fff" />
            </LinearGradient>
            <Text style={[styles.quickActionText, dynamicStyles.quickActionText]}>Order History</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickActionButton}>
            <LinearGradient
              colors={['#059669', '#10B981']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="heart-outline" size={24} color="#fff" />
            </LinearGradient>
            <Text style={[styles.quickActionText, dynamicStyles.quickActionText]}>Favorites</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickActionButton}>
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            </LinearGradient>
            <Text style={[styles.quickActionText, dynamicStyles.quickActionText]}>Support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickActionButton}>
            <LinearGradient
              colors={['#F59E0B', '#FBBF24']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="gift-outline" size={24} color="#fff" />
            </LinearGradient>
            <Text style={[styles.quickActionText, dynamicStyles.quickActionText]}>Rewards</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Sections */}
        {profileSections.map(renderSection)}

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LinearGradient
              colors={isDarkMode ? ['rgba(239, 68, 68, 0.2)', 'rgba(248, 113, 113, 0.2)'] : ['#FEE2E2', '#FECACA']}
              style={styles.signOutGradient}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, dynamicStyles.versionText]}>YetuEats v1.0.0</Text>
          <Text style={[styles.copyrightText, dynamicStyles.copyrightText]}>© 2024 YetuEats. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 30,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingsButton: {
    padding: 8,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#fff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
    marginTop: -20,
  },
  scrollContent: {
    paddingTop: 30,
    paddingBottom: 30,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  quickActionButton: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  quickActionGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 20,
    marginBottom: 12,
  },
  sectionContent: {
    marginHorizontal: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  separator: {
    height: 1,
    marginLeft: 68,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
  },
  menuItemRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  signOutButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  signOutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
  },
});

export default ProfileScreen;