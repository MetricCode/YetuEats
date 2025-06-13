import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { formatPrice } from '../services/currency';

interface OrderDetailsProps {
  order: any; // Replace with your Order type
  theme: any; // Replace with your Theme type
}

const OrderDetails = ({ order, theme }: OrderDetailsProps) => {
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Items</Text>
        {order.items.map((item: any, index: number) => (
          <View key={index} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.itemQuantity, { color: theme.textSecondary }]}>
                {item.quantity}x @ {formatPrice(item.price)}
              </Text>
            </View>
            <Text style={[styles.itemTotal, { color: theme.text }]}>
              {formatPrice(item.price * item.quantity)}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Delivery Details</Text>
        <Text style={[styles.addressText, { color: theme.textSecondary }]}>
          {order.deliveryAddress.street}
        </Text>
        <Text style={[styles.addressText, { color: theme.textSecondary }]}>
          {order.deliveryAddress.city}, {order.deliveryAddress.state}
        </Text>
        {order.deliveryInstructions && (
          <Text style={[styles.instructions, { color: theme.textSecondary }]}>
            Note: {order.deliveryInstructions}
          </Text>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Subtotal</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatPrice(order.pricing.subtotal)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Delivery Fee</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatPrice(order.pricing.deliveryFee)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Service Charge</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatPrice(order.pricing.serviceCharge)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Tax</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatPrice(order.pricing.tax)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryRow}>
          <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
          <Text style={[styles.totalValue, { color: theme.primary }]}>
            {formatPrice(order.pricing.total)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 14,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  addressText: {
    fontSize: 16,
    marginBottom: 4,
  },
  instructions: {
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OrderDetails;