
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Package, DollarSign, Users, Building, User as UserIcon, Settings as SettingsIcon, MessageSquare, Contact, BarChartHorizontal, BookOpen } from 'lucide-react';
import type { SubscriptionPlan, CurrencyOption } from '@/types';

export interface NavSubLink {
  href: string;
  label: string;
  secondary?: string;
  disabled?: boolean;
}

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  description?: string;
  children?: NavSubLink[];
}

export interface NavLinkGroup {
  title?: string;
  links: NavLink[];
}

export const NAV_LINK_GROUPS: NavLinkGroup[] = [
  {
    title: "Overview",
    links: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, description: 'Sales & business snapshot' },
      { href: '/admin/billing', label: 'Billing', icon: DollarSign, description: 'Create invoices & bills' },
    ],
  },
  {
    title: "Catalogue",
    links: [
      {
        href: '/admin/products',
        label: 'Products',
        icon: Package,
        description: 'Inventory catalogue',
        children: [
          { href: '/admin/products', label: 'All Products', secondary: 'Browse & manage stock' },
          { href: '/admin/products/add', label: 'Add Product', secondary: 'Create a new item' },
        ],
      },
      { href: '/admin/accounting', label: 'Accounting', icon: BookOpen, description: 'Ledger & finance' },
    ],
  },
  {
    title: "People",
    links: [
      { href: '/admin/customers', label: 'Customers', icon: Contact, description: 'Your customer base' },
      { href: '/admin/staff', label: 'Staff', icon: Users, description: 'Team & roles' },
      { href: '/admin/stores', label: 'Stores', icon: Building, description: 'Store locations' },
    ],
  },
  {
    title: "Communications",
    links: [
      { href: '/admin/chat', label: 'Chat', icon: MessageSquare, description: 'Store conversations' },
    ],
  },
  {
    title: "Account",
    links: [
      { href: '/admin/profile', label: 'Profile', icon: UserIcon, description: 'Your details' },
      { href: '/admin/settings', label: 'Settings', icon: SettingsIcon, description: 'Preferences & plans' },
    ],
  },
];


export const APP_NAME = "ecbills.in";

export const DEFAULT_CATEGORIES: string[] = [
  "Electronics", "Groceries", "Clothing", "Books", "Home Goods", "Toys", "Sports", "Automotive", "Health", "Beauty", "Services", "Other"
];

export const DEFAULT_COMPANY_NAME = "ecbills.in";
export const COMPANY_ADDRESS = "123 Commerce Way, Business City, ST 54321";
export const COMPANY_CONTACT = "Phone: (555) 123-4567 | Email: support@ecbills.in";


export const SUBSCRIPTION_PLAN_IDS = {
  ADMIN_ONLY: 'plan_admin_only_basic',
  STARTER: 'plan_starter',
  GROWTH: 'plan_growth',
  PRO: 'plan_pro',
  ENTERPRISE: 'plan_enterprise_contact',
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
   {
    id: SUBSCRIPTION_PLAN_IDS.ADMIN_ONLY,
    name: 'Basic Admin',
    price: 0, 
    priceSuffix: '/ month',
    features: [
        'Admin Dashboard Access',
        'Product Management',
        'Billing Management',
        'Limited Reporting',
        'No Store or Staff Management',
    ],
    maxStores: 0,
    maxEmployees: 0,
  },
  {
    id: SUBSCRIPTION_PLAN_IDS.STARTER,
    name: 'Starter',
    price: 199,
    priceSuffix: '/ month',
    features: [
        '1 Store',
        'Up to 2 Employees',
        'Unlimited Products',
        'Unlimited Bills',
        'Basic Reporting',
        'Store Chat with Admin'
    ],
    maxStores: 1,
    maxEmployees: 2,
  },
  {
    id: SUBSCRIPTION_PLAN_IDS.GROWTH,
    name: 'Growth',
    price: 1999,
    priceSuffix: '/ month',
    features: [
        'Up to 3 Stores',
        'Up to 10 Employees',
        'All Starter Features',
        'Advanced Reporting',
        'Priority Support'
    ],
    maxStores: 3,
    maxEmployees: 10,
    isPopular: true,
  },
  {
    id: SUBSCRIPTION_PLAN_IDS.PRO,
    name: 'Pro',
    price: 9999,
    priceSuffix: '/ month',
    features: [
        'Unlimited Stores',
        'Unlimited Employees',
        'All Growth Features',
        'Premium Support',
        'API Access (soon)'
    ],
    maxStores: Infinity,
    maxEmployees: Infinity,
  },
  {
    id: SUBSCRIPTION_PLAN_IDS.ENTERPRISE,
    name: 'Enterprise',
    price: -1, 
    priceSuffix: 'Custom Pricing',
    features: [
        'Custom Store & Employee Limits',
        'All Pro Features',
        'Dedicated Account Manager',
        'Custom Integrations & Features'
    ],
    maxStores: Infinity, 
    maxEmployees: Infinity,
  },
];

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
];

export const DEFAULT_CURRENCY_CODE = 'INR';

export const LOW_STOCK_THRESHOLD = 10;
