import React from 'react';
import {
  ArrowLeftRight,
  BadgeDollarSign,
  BookOpenText,
  ChartColumn,
  ChartLine,
  CreditCard,
  DatabaseBackup,
  Building2,
  Calculator,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

type IconProps = { className?: string };

const SIDEBAR_STROKE = 1.75;

function sidebarIcon(Icon: LucideIcon, className?: string) {
  return (
    <Icon
      className={className ?? 'size-[18px] shrink-0'}
      strokeWidth={SIDEBAR_STROKE}
      aria-hidden
    />
  );
}

export const ADMIN_SIDEBAR_ICONS: Record<string, (props: IconProps) => React.ReactElement> = {
  dashboard: ({ className }) => sidebarIcon(LayoutDashboard, className),
  warehouse: ({ className }) => sidebarIcon(Warehouse, className),
  purchases: ({ className }) => sidebarIcon(ShoppingCart, className),
  sales: ({ className }) => sidebarIcon(BadgeDollarSign, className),
  rates: ({ className }) => sidebarIcon(ChartLine, className),
  accounts: ({ className }) => sidebarIcon(Landmark, className),
  accounting: ({ className }) => sidebarIcon(Calculator, className),
  entities: ({ className }) => sidebarIcon(Building2, className),
  payments: ({ className }) => sidebarIcon(CreditCard, className),
  receipts: ({ className }) => sidebarIcon(ReceiptText, className),
  contra: ({ className }) => sidebarIcon(ArrowLeftRight, className),
  journal: ({ className }) => sidebarIcon(BookOpenText, className),
  reports: ({ className }) => sidebarIcon(ChartColumn, className),
  settings: ({ className }) => sidebarIcon(Settings, className),
  suppliers: ({ className }) => sidebarIcon(Truck, className),
  customers: ({ className }) => sidebarIcon(Users, className),
  users: ({ className }) => sidebarIcon(Users, className),
  backup: ({ className }) => sidebarIcon(DatabaseBackup, className),
};

export function AdminSidebarIcon({ id, className }: { id: string; className?: string }) {
  const Render = ADMIN_SIDEBAR_ICONS[id] ?? ADMIN_SIDEBAR_ICONS.dashboard;
  return <Render className={className} />;
}
