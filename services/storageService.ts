import { Order, OrderStatus, OrderItem } from '../types';

// CLAVES DE ALMACENAMIENTO
const STORAGE_KEY = 'purchase_tracker_data_v1';
const LEGACY_KEY = 'purchase_tracker_data'; 
const BACKUP_KEY = 'purchase_tracker_data_backup'; 
const CORRUPTION_KEY_PREFIX = 'purchase_tracker_corrupted_';

// Generador de ID seguro
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch (e) {}
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// Helper para calcular estado global basado en items
const calculateGlobalStatus = (items: OrderItem[], currentStatus: OrderStatus): OrderStatus => {
  if (!items || items.length === 0) return currentStatus;

  const allReceived = items.every(i => i.status === OrderStatus.RECEIVED || i.status === OrderStatus.RETURNED);
  if (allReceived) return OrderStatus.RECEIVED;

  const allShippedOrBetter = items.every(i => 
    i.status === OrderStatus.SHIPPED || 
    i.status === OrderStatus.PARTIALLY_RECEIVED || 
    i.status === OrderStatus.RECEIVED ||
    i.status === OrderStatus.RETURNED
  );
  if (allShippedOrBetter) return OrderStatus.SHIPPED;

  const anyReceived = items.some(i => i.status === OrderStatus.RECEIVED);
  if (anyReceived) return OrderStatus.PARTIALLY_RECEIVED;

  const anyShipped = items.some(i => i.status === OrderStatus.SHIPPED);
  if (anyShipped) return OrderStatus.PARTIALLY_SHIPPED;

  // Si todos están ordered o mezclados con claimed, devolvemos el estado base o Ordered
  if (currentStatus === OrderStatus.CLAIMED) return OrderStatus.CLAIMED;
  
  return OrderStatus.ORDERED;
};

// --- DATA ACCESS LAYER ---

export const getOrders = (): Order[] => {
  try {
    let data = localStorage.getItem(STORAGE_KEY);
    let source = 'current';

    // 1. Fallback a Legacy
    if (!data || data === '[]' || data === 'null') {
      const legacyData = localStorage.getItem(LEGACY_KEY);
      if (legacyData && legacyData !== '[]') {
        data = legacyData;
        source = 'legacy';
      }
    }

    // 2. Fallback a Backup Automático
    if (!data || data === '[]' || data === 'null') {
       const backupData = localStorage.getItem(BACKUP_KEY);
       if (backupData && backupData.length > 5) { 
         console.warn("Datos principales vacíos, usando backup automático.");
         data = backupData;
         source = 'backup';
       }
    }

    if (!data) return [];
    
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      console.error("JSON Error:", e);
      if (data.length > 0) {
          localStorage.setItem(`${CORRUPTION_KEY_PREFIX}${Date.now()}`, data);
      }
      return [];
    }
    
    if (!Array.isArray(parsedData)) return [];

    // 3. Sanitización y Migración
    const sanitizedOrders = parsedData.map((order: any) => {
      // Normalizar estado
      let status = Object.values(OrderStatus).includes(order.status) ? order.status : OrderStatus.ORDERED;
      
      // MIGRACIÓN DE ITEMS: Si no existe array items, crearlo desde productName
      let items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
      
      if (items.length === 0 && order.productName) {
         // Intentar separar por bullets o saltos de línea si es un string antiguo
         const cleanLines = order.productName
            .split(/\n|•/)
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
         
         if (cleanLines.length > 0) {
            items = cleanLines.map((name: string) => ({ name, status: status }));
         } else {
            items = [{ name: order.productName, status: status }];
         }
      }

      // Asegurar que cada item tenga un estado válido
      items = items.map(i => ({
         name: i.name || 'Producto',
         status: Object.values(OrderStatus).includes(i.status) ? i.status : status
      }));

      return {
        ...order,
        id: order.id || generateId(),
        title: order.title || order.productName || 'Pedido sin título',
        productName: order.productName || 'Producto desconocido',
        items: items,
        storeName: order.storeName || 'Tienda desconocida',
        date: order.date || new Date().toISOString().split('T')[0],
        amount: Number(order.amount) || 0,
        currency: order.currency || 'EUR',
        status: status,
        category: order.category || 'personal',
        orderReference: order.orderReference || '',
        orderUrl: order.orderUrl || '',
        trackingNumber: order.trackingNumber || '',
        carrier: order.carrier || '',
        invoiceFileName: order.invoiceFileName || '',
        notes: order.notes || '',
        contactInfo: order.contactInfo || '',
        receivedDate: order.receivedDate || ''
      };
    });

    // 4. Migración persistente si viene de legacy
    if (source === 'legacy') {
      try {
        const json = JSON.stringify(sanitizedOrders);
        localStorage.setItem(STORAGE_KEY, json);
        localStorage.setItem(BACKUP_KEY, json);
      } catch (e) { console.error("Error migrando legacy", e); }
    }

    return sanitizedOrders;

  } catch (error) {
    console.error("Error crítico getOrders:", error);
    return [];
  }
};

export const saveOrder = (order: Order): Order[] => {
  const currentOrders = getOrders();
  const existingIndex = currentOrders.findIndex(o => o.id === order.id);
  
  // Recalcular estado global basado en los items antes de guardar
  const calculatedStatus = calculateGlobalStatus(order.items, order.status);
  const orderToSave = { ...order, status: calculatedStatus };

  let newOrders;
  if (existingIndex >= 0) {
    newOrders = [...currentOrders];
    newOrders[existingIndex] = orderToSave;
  } else {
    newOrders = [orderToSave, ...currentOrders];
  }
  
  try {
    const json = JSON.stringify(newOrders);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(BACKUP_KEY, json);
  } catch (error: any) {
    console.error("Error saving:", error);
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
       alert("¡ALERTA! El almacenamiento local está lleno. No se ha podido guardar el pedido.");
    } else {
       alert("Error desconocido al guardar.");
    }
    return currentOrders; 
  }
  
  return newOrders;
};

export const deleteOrder = (id: string): Order[] => {
  const orders = getOrders();
  const newOrders = orders.filter(o => o.id !== id);
  try {
    const json = JSON.stringify(newOrders);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(BACKUP_KEY, json);
  } catch(e) {
    console.error("Error saving after delete", e);
  }
  return newOrders;
};

// --- BACKUP & RESTORE ---

export const downloadBackup = (orders: Order[]) => {
  const backupObject = {
    version: 2, // Bump version due to structure change
    timestamp: new Date().toISOString(),
    source: 'tracker_ai_app',
    data: orders
  };

  const dataStr = JSON.stringify(backupObject, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Helper para encontrar arrays de pedidos en cualquier estructura JSON
const findOrdersArray = (obj: any): any[] | null => {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return obj; 
    const sample = obj[0];
    if (sample && typeof sample === 'object') return obj;
    return null; 
  }
  if (typeof obj === 'object') {
    if (obj.data && Array.isArray(obj.data)) return findOrdersArray(obj.data);
    if (obj.orders && Array.isArray(obj.orders)) return findOrdersArray(obj.orders);
    if (obj.items && Array.isArray(obj.items)) return findOrdersArray(obj.items);
    for (const key in obj) {
       if (Array.isArray(obj[key])) {
         const found = findOrdersArray(obj[key]);
         if (found) return found;
       }
    }
  }
  return null;
};

export const restoreFromJSON = (file: File): Promise<Order[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) return reject(new Error("Archivo vacío"));

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (jsonErr) {
            return reject(new Error("El archivo no es un JSON válido."));
        }

        const ordersArray = findOrdersArray(parsed);

        if (Array.isArray(ordersArray)) {
          const recoveredOrders = ordersArray.map((order: any) => ({
             ...order,
             id: order.id || generateId(), 
             title: order.title || order.productName || 'Recuperado',
             items: Array.isArray(order.items) ? order.items : [{name: order.productName || 'Producto', status: order.status || OrderStatus.ORDERED}],
             date: order.date || new Date().toISOString().split('T')[0],
             productName: order.productName || 'Producto recuperado',
             storeName: order.storeName || 'Tienda desconocida',
             amount: Number(order.amount) || 0,
             currency: order.currency || 'EUR',
             status: order.status || OrderStatus.ORDERED,
             category: order.category || 'personal'
          }));
          
          if (recoveredOrders.length > 0) {
            const json = JSON.stringify(recoveredOrders);
            localStorage.setItem(STORAGE_KEY, json);
            localStorage.setItem(BACKUP_KEY, json); 
            resolve(recoveredOrders);
          } else {
            resolve([]); 
          }
        } else {
          reject(new Error("No se encontró una lista válida."));
        }
      } catch (err) {
        reject(new Error("Error inesperado."));
      }
    };
    reader.onerror = () => reject(new Error("Error de lectura"));
    reader.readAsText(file);
  });
};

export const attemptAutoRecovery = (): Order[] => {
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) {
      const parsed = JSON.parse(backup);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.setItem(STORAGE_KEY, backup);
        return parsed;
      }
    }
  } catch (e) { console.error("Recovery failed", e); }
  return [];
};

export const exportToCSV = (orders: Order[]): void => {
  const receivedOrders = orders.filter(o => o.status === OrderStatus.RECEIVED || o.status === OrderStatus.RETURNED);
  
  if (receivedOrders.length === 0) {
    alert("No hay pedidos para exportar.");
    return;
  }

  const headers = ['ID', 'Ref', 'Título', 'Productos', 'Tienda', 'Fecha', 'Entrega', 'Importe', 'Estado'];
  const csvContent = [
    headers.join(','),
    ...receivedOrders.map(o => [
      o.id,
      `"${(o.orderReference || '').replace(/"/g, '""')}"`,
      `"${(o.title).replace(/"/g, '""')}"`,
      `"${o.items.map(i => i.name).join('; ').replace(/"/g, '""')}"`,
      `"${o.storeName.replace(/"/g, '""')}"`,
      o.date,
      o.receivedDate || '',
      o.amount,
      o.status
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `tracker_export.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};