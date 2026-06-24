// Vibrant color palette for charts
export const CHART_COLORS = {
  // Primary vibrant colors
  primary: '#6366f1',       // Indigo
  secondary: '#8b5cf6',     // Purple
  accent: '#ec4899',        // Pink
  success: '#10b981',       // Green
  warning: '#f59e0b',       // Amber
  danger: '#ef4444',        // Red
  info: '#3b82f6',          // Blue
  teal: '#14b8a6',          // Teal
  orange: '#f97316',        // Orange
  cyan: '#06b6d4',          // Cyan

  // Revenue/Money colors
  revenue: '#10b981',       // Green
  cash: '#f59e0b',          // Amber
  wallet: '#8b5cf6',        // Purple
  momo: '#f97316',          // Orange

  // Status colors
  active: '#10b981',
  inactive: '#9ca3af',
  pending: '#f59e0b',
  completed: '#6366f1',
};

// Gradient definitions for vibrant area/line charts
export const CHART_GRADIENTS = {
  revenue: {
    start: 'rgba(16, 185, 129, 0.4)',  // Green with opacity
    end: 'rgba(16, 185, 129, 0.0)',
  },
  sales: {
    start: 'rgba(99, 102, 241, 0.4)',  // Indigo with opacity
    end: 'rgba(99, 102, 241, 0.0)',
  },
  tickets: {
    start: 'rgba(139, 92, 246, 0.4)',  // Purple with opacity
    end: 'rgba(139, 92, 246, 0.0)',
  },
  checkIns: {
    start: 'rgba(6, 182, 212, 0.4)',   // Cyan with opacity
    end: 'rgba(6, 182, 212, 0.0)',
  },
};

// Array of vibrant colors for multi-series charts (pie, bar, etc.)
export const VIBRANT_PALETTE = [
  '#6366f1',  // Indigo
  '#8b5cf6',  // Purple
  '#ec4899',  // Pink
  '#f59e0b',  // Amber
  '#10b981',  // Green
  '#3b82f6',  // Blue
  '#f97316',  // Orange
  '#14b8a6',  // Teal
  '#06b6d4',  // Cyan
  '#ef4444',  // Red
];

// Color mapping for payment methods
export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: CHART_COLORS.cash,
  keshless_wallet: CHART_COLORS.wallet,
  wallet: CHART_COLORS.wallet,
  mtn_momo: CHART_COLORS.momo,
  momo: CHART_COLORS.momo,
};

// Color mapping for ticket types (will cycle through palette)
export const getTicketTypeColor = (index: number): string => {
  return VIBRANT_PALETTE[index % VIBRANT_PALETTE.length];
};

// Helper to create SVG gradient definition for Recharts
export const createGradientId = (name: string) => `gradient-${name}`;

// Chart configuration defaults
export const CHART_CONFIG = {
  // Animation
  animationDuration: 800,
  animationEasing: 'ease-in-out',

  // Margins
  margin: {
    top: 10,
    right: 10,
    left: 0,
    bottom: 0,
  },

  // Grid
  grid: {
    strokeDasharray: '3 3',
    stroke: '#e5e7eb',
  },

  // Tooltip
  tooltip: {
    contentStyle: {
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },
    cursor: {
      fill: 'rgba(99, 102, 241, 0.1)',
    },
  },

  // Legend
  legend: {
    wrapperStyle: {
      paddingTop: '20px',
    },
    iconType: 'circle' as const,
  },
};

// Helper to format currency
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value).replace('$', 'E ');
};

// Helper to format large numbers
export const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

// Helper to format percentage
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};
