import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Switch,
} from 'react-native';
import { User } from 'firebase/auth';

interface Order {
  id: string;
  customerName: string;
  items: string[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  orderTime: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

const RestaurantDashboardScreen = ({ user }: { user: User }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'analytics'>('orders');

  const orders: Order[] = [
    {
      id: '1',
      customerName: 'John Doe',
      items: ['Margherita Pizza', 'Coca Cola'],
      total: 24.99,
      status: 'pending',
      orderTime: '2 min ago',
    },
    {
      id: '2',
      customerName: 'Jane Smith',
      items: ['Pepperoni Pizza', 'Garlic Bread'],
      total: 29.99,
      status: 'preparing',
      orderTime: '5 min ago',
    },
    {
      id: '3',
      customerName: 'Mike Johnson',
      items: ['Caesar Salad', 'Iced Tea'],
      total: 18.99,
      status: 'ready',
      orderTime: '8 min ago',
    },
  ];

  const menuItems: MenuItem[] = [
    {
      id: '1',
      name: 'Margherita Pizza',
      price: 18.99,
      category: 'Pizza',
      available: true,
    },
    {
      id: '2',
      name: 'Pepperoni Pizza',
      price: 21.99,
      category: 'Pizza',
      available: true,
    },
    {
      id: '3',
      name: 'Caesar Salad',
      price: 12.99,
      category: 'Salads',
      available: false,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#e74c3c';
      case 'preparing': return '#f39c12';
      case 'ready': return '#27ae60';
      case 'completed': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'New Order';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.orderTime}>{item.orderTime}</Text>
      <View style={styles.orderItems}>
        {item.items.map((itemName, index) => (
          <Text key={index} style={styles.orderItem}>• {itemName}</Text>
        ))}
      </View>
      <View style={styles.orderFooter}>
        <Text style={styles.orderTotal}>${item.total.toFixed(2)}</Text>
        <View style={styles.orderActions}>
          {item.status === 'pending' && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#f39c12' }]}>
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
          )}
          {item.status === 'preparing' && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#27ae60' }]}>
              <Text style={styles.actionButtonText}>Ready</Text>
            </TouchableOpacity>
          )}
          {item.status === 'ready' && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#3498db' }]}>
              <Text style={styles.actionButtonText}>Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.menuItemCard}>
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName}>{item.name}</Text>
        <Text style={styles.menuItemCategory}>{item.category}</Text>
        <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.menuItemActions}>
        <Switch
          value={item.available}
          onValueChange={() => {}}
          trackColor={{ false: '#767577', true: '#27ae60' }}
        />
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAnalytics = () => (
    <View style={styles.analyticsContainer}>
      <View style={styles.analyticsRow}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsNumber}>24</Text>
          <Text style={styles.analyticsLabel}>Today's Orders</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsNumber}>$486</Text>
          <Text style={styles.analyticsLabel}>Today's Revenue</Text>
        </View>
      </View>
      <View style={styles.analyticsRow}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsNumber}>4.6</Text>
          <Text style={styles.analyticsLabel}>Average Rating</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsNumber}>23 min</Text>
          <Text style={styles.analyticsLabel}>Avg Prep Time</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.restaurantName}>Pizza Palace</Text>
          <Text style={styles.ownerName}>Welcome, {user.email?.split('@')[0]}</Text>
        </View>
        <View style={styles.onlineToggle}>
          <Text style={styles.onlineLabel}>Online</Text>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ false: '#767577', true: '#27ae60' }}
          />
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.activeTab]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>
            Orders
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'menu' && styles.activeTab]}
          onPress={() => setActiveTab('menu')}
        >
          <Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>
            Menu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
          onPress={() => setActiveTab('analytics')}
        >
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'orders' && (
          <FlatList
            data={orders}
            renderItem={renderOrder}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.ordersList}
          />
        )}
        {activeTab === 'menu' && (
          <FlatList
            data={menuItems}
            renderItem={renderMenuItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menuList}
          />
        )}
        {activeTab === 'analytics' && renderAnalytics()}
      </View>
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
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  ownerName: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineLabel: {
    fontSize: 16,
    color: '#2c3e50',
    marginRight: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  activeTabText: {
    color: '#3498db',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  ordersList: {
    padding: 15,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderTime: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  orderItems: {
    marginBottom: 15,
  },
  orderItem: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  orderActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  menuList: {
    padding: 15,
  },
  menuItemCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  menuItemCategory: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  menuItemActions: {
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  analyticsContainer: {
    padding: 15,
  },
  analyticsRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  analyticsCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 7.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analyticsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});

export default RestaurantDashboardScreen;