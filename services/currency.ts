// utils/currency.ts
// Currency utility functions for Kenyan Shillings (KES)

export const formatCurrency = (amount: number): string => {
  return `KES ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;
};

export const formatPrice = (price: number): string => {
  return formatCurrency(price);
};

export const parseCurrency = (currencyString: string): number => {
  // Remove KES prefix and commas, then parse as float
  const cleanString = currencyString.replace(/KES\s?|,/g, '').trim();
  return parseFloat(cleanString) || 0;
};

export const validatePrice = (priceString: string): boolean => {
  const price = parseFloat(priceString);
  return !isNaN(price) && price > 0;
};

// Common KES price suggestions for restaurants
export const commonPrices = {
  beverages: [50, 80, 100, 120, 150, 200],
  appetizers: [150, 200, 250, 300, 400, 500],
  mains: [300, 400, 500, 600, 800, 1000, 1200, 1500],
  desserts: [100, 150, 200, 250, 300, 400]
};

// Format currency for input placeholders
export const getCurrencyPlaceholder = (category?: string): string => {
  switch (category) {
    case 'beverages':
      return '100';
    case 'appetizers':
      return '250';
    case 'mains':
      return '600';
    case 'desserts':
      return '200';
    default:
      return '500';
  }
};