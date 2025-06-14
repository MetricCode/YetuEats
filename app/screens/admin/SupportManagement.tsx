import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { FIREBASE_DB } from '../../../FirebaseConfig';
import { useTheme } from '../../../contexts/ThemeContext';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  userType: 'customer' | 'restaurant' | 'delivery';
  subject: string;
  description: string;
  category: 'order_issue' | 'payment' | 'technical' | 'account' | 'delivery' | 'restaurant' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  assignedTo?: string;
  assignedAdminName?: string;
  createdAt: any;
  updatedAt: any;
  resolvedAt?: any;
  messages: SupportMessage[];
  attachments?: string[];
}

interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'admin';
  message: string;
  timestamp: any;
  isInternal?: boolean; // Internal admin notes
}

interface SupportStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  averageResponseTime: number; // in hours
  satisfactionRating: number;
  ticketsByCategory: { [key: string]: number };
  ticketsByPriority: { [key: string]: number };
}

type FilterType = 'all' | 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
type PriorityType = 'low' | 'medium' | 'high' | 'urgent';

const AdminSupportManagementScreen = ({ user }: { user: User }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<SupportTicket[]>([]);
  const [supportStats, setSupportStats] = useState<SupportStats>({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedToday: 0,
    averageResponseTime: 0,
    satisfactionRating: 0,
    ticketsByCategory: {},
    ticketsByPriority: {},
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadSupportData();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, selectedFilter]);

  const loadSupportData = async () => {
    try {
      setLoading(true);
      await loadSupportTickets();
      calculateStats();
    } catch (error) {
      console.error('Error loading support data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSupportTickets = async () => {
    try {
      const ticketsSnapshot = await getDocs(
        query(
          collection(FIREBASE_DB, 'supportTickets'),
          orderBy('createdAt', 'desc'),
          limit(100)
        )
      );
      
      const ticketsList: SupportTicket[] = ticketsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ticketNumber: data.ticketNumber || `TK${doc.id.slice(-6).toUpperCase()}`,
          userId: data.userId || '',
          userName: data.userName || 'Unknown User',
          userEmail: data.userEmail || '',
          userType: data.userType || 'customer',
          subject: data.subject || 'No Subject',
          description: data.description || '',
          category: data.category || 'other',
          priority: data.priority || 'medium',
          status: data.status || 'open',
          assignedTo: data.assignedTo,
          assignedAdminName: data.assignedAdminName,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          resolvedAt: data.resolvedAt,
          messages: data.messages || [],
          attachments: data.attachments || [],
        };
      });
      
      setTickets(ticketsList);
    } catch (error) {
      console.error('Error loading support tickets:', error);
    }
  };

  const calculateStats = () => {
    const totalTickets = tickets.length;
    const openTickets = tickets.filter(t => t.status === 'open').length;
    const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resolvedToday = tickets.filter(t => {
      if (t.status !== 'resolved' || !t.resolvedAt) return false;
      const resolvedDate = t.resolvedAt.toDate ? t.resolvedAt.toDate() : new Date(t.resolvedAt.seconds * 1000);
      return resolvedDate >= today;
    }).length;

    const ticketsByCategory = tickets.reduce((acc, ticket) => {
      acc[ticket.category] = (acc[ticket.category] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const ticketsByPriority = tickets.reduce((acc, ticket) => {
      acc[ticket.priority] = (acc[ticket.priority] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    setSupportStats({
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedToday,
      averageResponseTime: 4.5, // Mock data
      satisfactionRating: 4.2, // Mock data
      ticketsByCategory,
      ticketsByPriority,
    });
  };

  const filterTickets = () => {
    let filtered = tickets;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket => 
        ticket.ticketNumber.toLowerCase().includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.userName.toLowerCase().includes(query) ||
        ticket.userEmail.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === selectedFilter);
    }

    // Sort by priority and creation time
    filtered.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt?.seconds * 1000);
      const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt?.seconds * 1000);
      return timeB.getTime() - timeA.getTime();
    });

    setFilteredTickets(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSupportData();
    setRefreshing(false);
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      if (newStatus === 'in_progress' && !selectedTicket?.assignedTo) {
        updateData.assignedTo = user.uid;
        updateData.assignedAdminName = user.displayName || 'Admin';
      }

      if (newStatus === 'resolved') {
        updateData.resolvedAt = serverTimestamp();
      }

      await updateDoc(doc(FIREBASE_DB, 'supportTickets', ticketId), updateData);
      
      await loadSupportData();
      Alert.alert('Success', 'Ticket status updated successfully');
    } catch (error) {
      console.error('Error updating ticket status:', error);
      Alert.alert('Error', 'Failed to update ticket status');
    }
  };

  const assignTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(FIREBASE_DB, 'supportTickets', ticketId), {
        assignedTo: user.uid,
        assignedAdminName: user.displayName || 'Admin',
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      });
      
      await loadSupportData();
      Alert.alert('Success', 'Ticket assigned to you successfully');
    } catch (error) {
      console.error('Error assigning ticket:', error);
      Alert.alert('Error', 'Failed to assign ticket');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      setSending(true);
      
      const message: SupportMessage = {
        id: Date.now().toString(),
        senderId: user.uid,
        senderName: user.displayName || 'Admin',
        senderType: 'admin',
        message: newMessage.trim(),
        timestamp: new Date(),
        isInternal,
      };

      const updatedMessages = [...selectedTicket.messages, message];
      
      await updateDoc(doc(FIREBASE_DB, 'supportTickets', selectedTicket.id), {
        messages: updatedMessages,
        updatedAt: serverTimestamp(),
        status: isInternal ? selectedTicket.status : 'waiting_user',
      });

      setSelectedTicket(prev => prev ? { ...prev, messages: updatedMessages } : null);
      setNewMessage('');
      setIsInternal(false);
      
      await loadSupportData();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const now = new Date();
      let date: Date;
      
      if (timestamp.toDate) {
        date = timestamp.toDate();
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        return 'Unknown';
      }
      
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    } catch (error) {
      return 'Unknown';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#F59E0B';
      case 'in_progress': return '#3B82F6';
      case 'waiting_user': return '#8B5CF6';
      case 'resolved': return '#10B981';
      case 'closed': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'order_issue': return 'receipt';
      case 'payment': return 'card';
      case 'technical': return 'settings';
      case 'account': return 'person';
      case 'delivery': return 'car';
      case 'restaurant': return 'restaurant';
      default: return 'help-circle';
    }
  };

  const renderFilterTab = (filter: FilterType, label: string) => {
    const isSelected = selectedFilter === filter;
    const count = tickets.filter(t => filter === 'all' || t.status === filter).length;

    return (
      <TouchableOpacity
        key={filter}
        style={[
          styles.filterTab,
          { backgroundColor: isSelected ? theme.primary : theme.inputBackground }
        ]}
        onPress={() => setSelectedFilter(filter)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.filterTabText,
          { color: isSelected ? '#fff' : theme.textSecondary }
        ]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderStatsCard = (title: string, value: string, subtitle: string, icon: string, color: string) => (
    <View style={[styles.statsCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
      <View style={[styles.statsIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={[styles.statsValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.statsSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>
    </View>
  );

  const renderTicketCard = ({ item }: { item: SupportTicket }) => (
    <TouchableOpacity
      style={[styles.ticketCard, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      onPress={() => {
        setSelectedTicket(item);
        setShowTicketModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.ticketHeader}>
        <View style={styles.ticketInfo}>
          <Text style={[styles.ticketNumber, { color: theme.text }]}>{item.ticketNumber}</Text>
          <Text style={[styles.ticketSubject, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.subject}
          </Text>
        </View>
        <View style={styles.ticketBadges}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
            <Text style={styles.badgeText}>{item.priority.toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.badgeText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.ticketDetails}>
        <View style={styles.detailRow}>
          <Ionicons name={getCategoryIcon(item.category) as any} size={14} color={theme.textMuted} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {item.category.replace('_', ' ')} • {item.userType}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="person" size={14} color={theme.textMuted} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {item.userName} ({item.userEmail})
          </Text>
        </View>
        {item.assignedAdminName && (
          <View style={styles.detailRow}>
            <Ionicons name="person-circle" size={14} color={theme.textMuted} />
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              Assigned to {item.assignedAdminName}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.ticketFooter}>
        <Text style={[styles.ticketTime, { color: theme.textMuted }]}>
          {getTimeAgo(item.createdAt)}
        </Text>
        <View style={styles.ticketActions}>
          {!item.assignedTo && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary + '20' }]}
              onPress={(e) => {
                e.stopPropagation();
                assignTicket(item.id);
              }}
            >
              <Text style={[styles.actionButtonText, { color: theme.primary }]}>Assign</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.messageCount, { color: theme.primary }]}>
            {item.messages.length} messages
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTicketModal = () => (
    <Modal
      visible={showTicketModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      {selectedTicket && (
        <KeyboardAvoidingView 
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowTicketModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {selectedTicket.ticketNumber}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Update Status',
                  'Select new status:',
                  [
                    { text: 'Open', onPress: () => updateTicketStatus(selectedTicket.id, 'open') },
                    { text: 'In Progress', onPress: () => updateTicketStatus(selectedTicket.id, 'in_progress') },
                    { text: 'Resolved', onPress: () => updateTicketStatus(selectedTicket.id, 'resolved') },
                    { text: 'Closed', onPress: () => updateTicketStatus(selectedTicket.id, 'closed') },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Ionicons name="settings" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Ticket Details */}
            <View style={[styles.ticketDetailsSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Ticket Details</Text>
              <Text style={[styles.ticketSubjectLarge, { color: theme.text }]}>{selectedTicket.subject}</Text>
              <Text style={[styles.ticketDescription, { color: theme.textSecondary }]}>
                {selectedTicket.description}
              </Text>
              
              <View style={styles.ticketMeta}>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Customer:</Text>
                  <Text style={[styles.metaValue, { color: theme.text }]}>
                    {selectedTicket.userName} ({selectedTicket.userEmail})
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Category:</Text>
                  <Text style={[styles.metaValue, { color: theme.text }]}>
                    {selectedTicket.category.replace('_', ' ')}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Created:</Text>
                  <Text style={[styles.metaValue, { color: theme.text }]}>
                    {getTimeAgo(selectedTicket.createdAt)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Messages */}
            <View style={[styles.messagesSection, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Messages</Text>
              {selectedTicket.messages.map((message, index) => (
                <View
                  key={index}
                  style={[
                    styles.messageItem,
                    {
                      backgroundColor: message.senderType === 'admin' 
                        ? theme.primary + '10' 
                        : theme.inputBackground,
                      alignSelf: message.senderType === 'admin' ? 'flex-end' : 'flex-start',
                    }
                  ]}
                >
                  <Text style={[styles.messageSender, { color: theme.textSecondary }]}>
                    {message.senderName} {message.isInternal && '(Internal)'}
                  </Text>
                  <Text style={[styles.messageText, { color: theme.text }]}>
                    {message.message}
                  </Text>
                  <Text style={[styles.messageTime, { color: theme.textMuted }]}>
                    {getTimeAgo(message.timestamp)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Message Input */}
          <View style={[styles.messageInputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <View style={styles.messageInputRow}>
              <TextInput
                style={[styles.messageInput, { backgroundColor: theme.inputBackground, color: theme.text }]}
                placeholder="Type your response..."
                value={newMessage}
                onChangeText={setNewMessage}
                placeholderTextColor={theme.placeholder}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: theme.primary }]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.messageOptions}>
              <TouchableOpacity
                style={styles.internalToggle}
                onPress={() => setIsInternal(!isInternal)}
              >
                <Ionicons 
                  name={isInternal ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={theme.primary} 
                />
                <Text style={[styles.internalToggleText, { color: theme.textSecondary }]}>
                  Internal note (not visible to customer)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading support data...</Text>
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
        <Text style={styles.headerTitle}>Support Management</Text>
        <Text style={styles.headerSubtitle}>Manage customer support tickets</Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderStatsCard('Open Tickets', supportStats.openTickets.toString(), 'Need attention', 'alert-circle', '#F59E0B')}
            {renderStatsCard('In Progress', supportStats.inProgressTickets.toString(), 'Being handled', 'time', '#3B82F6')}
            {renderStatsCard('Resolved Today', supportStats.resolvedToday.toString(), 'Completed tickets', 'checkmark-circle', '#10B981')}
            {renderStatsCard('Avg Response', `${supportStats.averageResponseTime}h`, 'Response time', 'flash', '#8B5CF6')}
          </ScrollView>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.inputBackground }]}>
            <Ionicons name="search-outline" size={20} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search tickets, customers..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.placeholder}
            />
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderFilterTab('all', 'All')}
            {renderFilterTab('open', 'Open')}
            {renderFilterTab('in_progress', 'In Progress')}
            {renderFilterTab('waiting_user', 'Waiting User')}
            {renderFilterTab('resolved', 'Resolved')}
          </ScrollView>
        </View>

        {/* Tickets List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Support Tickets</Text>
          <FlatList
            data={filteredTickets}
            renderItem={renderTicketCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="headset-outline" size={48} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tickets found</Text>
              </View>
            }
          />
        </View>
      </ScrollView>

      {renderTicketModal()}
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
  statsContainer: {
    paddingVertical: 20,
    paddingLeft: 20,
  },
  statsCard: {
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 140,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  statsSubtitle: {
    fontSize: 10,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  ticketCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ticketSubject: {
    fontSize: 14,
  },
  ticketBadges: {
    gap: 4,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  ticketDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketTime: {
    fontSize: 12,
  },
  ticketActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  ticketDetailsSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  ticketSubjectLarge: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ticketDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  ticketMeta: {
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 80,
  },
  metaValue: {
    fontSize: 13,
    flex: 1,
  },
  messagesSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  messageItem: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  messageInputContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  messageInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  messageInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageOptions: {
    paddingTop: 8,
  },
  internalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  internalToggleText: {
    fontSize: 13,
  },
});

export default AdminSupportManagementScreen;