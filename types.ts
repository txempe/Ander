export enum OrderStatus {
  ORDERED = 'Pendiente',
  PARTIALLY_SHIPPED = 'Parcialmente Enviado',
  SHIPPED = 'Enviado',
  PARTIALLY_RECEIVED = 'Parcialmente Recibido',
  RECEIVED = 'Recibido',
  RETURNED = 'Devuelto',
  CLAIMED = 'Reclamado'
}

export type OrderCategory = 'personal' | 'familiar';

export interface OrderItem {
  name: string;
  status: OrderStatus;
}

export interface Order {
  id: string;
  title: string; 
  date: string; // ISO string
  productName: string; // Mantenido para compatibilidad y resumen visual
  items: OrderItem[]; // Nuevo campo para items individuales
  storeName: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  category: OrderCategory; 
  
  orderReference?: string; 
  orderUrl?: string; 
  trackingNumber?: string;
  carrier?: string;
  invoiceFileName?: string; 
  notes?: string;
  contactInfo?: string; 
  receivedDate?: string; 
}

export interface ParsingResult {
  title?: string;
  date?: string;
  productName?: string;
  items?: string[]; // Array de nombres de productos
  storeName?: string;
  amount?: number;
  currency?: string;
  contactInfo?: string;
  orderReference?: string;
}