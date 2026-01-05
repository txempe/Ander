import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Package, 
  Truck, 
  CheckCircle, 
  Search, 
  ExternalLink, 
  FileText, 
  LayoutDashboard,
  History,
  Sheet,
  Filter,
  ChevronDown,
  XCircle,
  RotateCcw,
  ClipboardList,
  Trash2,
  LifeBuoy,
  AlertTriangle,
  Calendar,
  Wallet,
  User,
  Users,
  Database,
  Download,
  Upload,
  RefreshCw,
  ArrowUpDown,
  Store,
  Info,
  Box
} from 'lucide-react';
import { Order, OrderStatus, OrderItem } from './types';
import { 
  getOrders, 
  saveOrder, 
  deleteOrder, 
  exportToCSV, 
  downloadBackup, 
  restoreFromJSON,
  attemptAutoRecovery 
} from './services/storageService';
import OrderModal from './components/OrderModal';
import StatsChart from './components/StatsChart';
import ItemStatusModal from './components/ItemStatusModal';

// --- Subcomponents within App.tsx ---

const VolatileWarning = () => {
  const [visible, setVisible] = useState(true);
  
  if (!visible) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-start sm:items-center justify-between gap-4 text-amber-900 text-xs sm:text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
        <div>
          <span className="font-bold">Aviso importante de datos:</span> Estás usando esta app en un entorno temporal (AI Studio). 
          Los datos se guardan solo en este navegador. 
          <span className="block sm:inline mt-1 sm:mt-0"> 
             {' '} <strong>Descarga una copia de seguridad</strong> frecuentemente, especialmente antes de pedir cambios en el código o cambiar de dispositivo (PC a iPad).
          </span>
        </div>
      </div>
      <button onClick={() => setVisible(false)} className="p-1 hover:bg-amber-100 rounded">
        <XCircle className="w-5 h-5 opacity-50" />
      </button>
    </div>
  );
};

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const styles = {
    [OrderStatus.ORDERED]: "bg-blue-100 text-blue-700 border-blue-200",
    [OrderStatus.PARTIALLY_SHIPPED]: "bg-indigo-100 text-indigo-700 border-indigo-200",
    [OrderStatus.SHIPPED]: "bg-amber-100 text-amber-700 border-amber-200",
    [OrderStatus.PARTIALLY_RECEIVED]: "bg-teal-100 text-teal-700 border-teal-200",
    [OrderStatus.RECEIVED]: "bg-green-100 text-green-700 border-green-200",
    [OrderStatus.RETURNED]: "bg-rose-100 text-rose-700 border-rose-200",
    [OrderStatus.CLAIMED]: "bg-orange-100 text-orange-700 border-orange-200",
  };

  const icons = {
    [OrderStatus.ORDERED]: Package,
    [OrderStatus.PARTIALLY_SHIPPED]: Truck,
    [OrderStatus.SHIPPED]: Truck,
    [OrderStatus.PARTIALLY_RECEIVED]: CheckCircle,
    [OrderStatus.RECEIVED]: CheckCircle,
    [OrderStatus.RETURNED]: XCircle,
    [OrderStatus.CLAIMED]: AlertTriangle,
  };

  const Icon = icons[status] || Package;

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
};

// Componente para manejar el logo de la tienda
const StoreLogo = ({ storeName, orderUrl, status }: { storeName: string, orderUrl?: string, status: OrderStatus }) => {
  const [imgError, setImgError] = useState(false);

  // Calcula el dominio probable para obtener el logo
  const logoUrl = useMemo(() => {
    let domain = '';
    
    // Intento 1: Extraer del URL del pedido si existe
    if (orderUrl) {
      try {
        const hostname = new URL(orderUrl).hostname;
        domain = hostname.replace('www.', '');
      } catch (e) {}
    }

    // Intento 2: Construir desde el nombre de la tienda (heurística simple)
    if (!domain && storeName) {
      // Elimina espacios y caracteres especiales, añade .com por defecto si no parece dominio
      const cleanName = storeName.toLowerCase().replace(/[^a-z0-9]/g, '');
      domain = storeName.includes('.') ? storeName : `${cleanName}.com`;
    }

    return `https://logo.clearbit.com/${domain}`;
  }, [storeName, orderUrl]);

  const isClaimed = status === OrderStatus.CLAIMED;

  // Renderizado de Fallback (Icono genérico)
  if (imgError || !storeName) {
    return (
      <div className={`w-12 h-12 flex items-center justify-center rounded-xl shrink-0 transition-colors ${
        isClaimed ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
      }`}>
        {isClaimed ? <AlertTriangle className="w-6 h-6" /> : <ShoppingBag className="w-6 h-6" />}
      </div>
    );
  }

  // Renderizado de Imagen de Logo
  return (
    <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center p-1">
      <img 
        src={logoUrl} 
        alt={storeName}
        onError={() => setImgError(true)}
        className="w-full h-full object-contain"
        loading="lazy"
      />
    </div>
  );
};

const OrderTimeline = ({ status }: { status: OrderStatus }) => {
  const steps = [OrderStatus.ORDERED, OrderStatus.SHIPPED, OrderStatus.RECEIVED];
  
  const isReturned = status === OrderStatus.RETURNED;
  const isClaimed = status === OrderStatus.CLAIMED;
  
  // Mapear estados parciales a sus pasos principales
  let normalizedStatus = status;
  if (status === OrderStatus.PARTIALLY_SHIPPED) normalizedStatus = OrderStatus.ORDERED; // Progress between ordered and shipped
  if (status === OrderStatus.PARTIALLY_RECEIVED) normalizedStatus = OrderStatus.SHIPPED; // Progress between shipped and received

  const currentStepIndex = (isReturned || isClaimed) ? steps.length - 1 : steps.indexOf(normalizedStatus);
  
  // Calcular porcentaje extra para estados parciales
  let partialProgress = 0;
  if (status === OrderStatus.PARTIALLY_SHIPPED) partialProgress = 0.5; // Halfway to Shipped
  if (status === OrderStatus.PARTIALLY_RECEIVED) partialProgress = 0.5; // Halfway to Received

  let activeColor = 'bg-blue-500';
  let activeBorder = 'border-blue-500';
  let activeText = 'text-blue-600';

  if (isReturned) {
    activeColor = 'bg-rose-500';
    activeBorder = 'border-rose-500';
    activeText = 'text-rose-600';
  } else if (isClaimed) {
    activeColor = 'bg-orange-500';
    activeBorder = 'border-orange-500';
    activeText = 'text-orange-600';
  }

  // Calculate width including partial steps
  const totalSteps = steps.length - 1;
  const rawProgress = (currentStepIndex + partialProgress) / totalSteps;
  const widthPercentage = Math.min(100, Math.max(0, rawProgress * 100));

  return (
    <div className="w-full px-2 mt-4 mb-6">
      <div className="relative flex items-center justify-between">
        {/* Background Line */}
        <div className="absolute left-0 top-1.5 w-full h-1 bg-slate-100 rounded-full -z-10" />
        
        {/* Active Progress Line */}
        <div 
          className={`absolute left-0 top-1.5 h-1 rounded-full -z-10 transition-all duration-500 ease-out ${activeColor}`}
          style={{ width: `${widthPercentage}%` }}
        />

        {steps.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          
          return (
            <div key={step} className="relative flex flex-col items-center group">
              {/* Dot */}
              <div 
                className={`w-4 h-4 rounded-full border-[3px] z-10 transition-all duration-300 ${
                  isCompleted 
                    ? `${activeColor} ${activeBorder} shadow-sm scale-110` 
                    : 'bg-white border-slate-200'
                }`} 
              />
              
              {/* Label */}
              <span className={`absolute top-6 text-[10px] font-semibold tracking-wide uppercase transition-colors duration-300 ${
                isCompleted ? activeText : 'text-slate-400'
              } ${
                index === 0 ? 'left-0' : 
                index === steps.length - 1 ? 'right-0' : 
                'left-1/2 -translate-x-1/2'
              }`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Item list display component
const OrderItemList = ({ items }: { items: OrderItem[] }) => {
    if (!items || items.length === 0) return null;

    const getStatusColor = (s: OrderStatus) => {
        switch(s) {
            case OrderStatus.RECEIVED: return 'bg-green-500';
            case OrderStatus.SHIPPED: return 'bg-amber-500';
            case OrderStatus.RETURNED: return 'bg-rose-500';
            default: return 'bg-slate-300';
        }
    };

    if (items.length === 1) {
        return (
            <p className="text-sm text-slate-600 mb-1 line-clamp-2" title={items[0].name}>
                {items[0].name}
            </p>
        );
    }

    return (
        <div className="mt-2 mb-3 bg-slate-50 rounded-lg p-2 space-y-1.5 border border-slate-100 max-h-[120px] overflow-y-auto">
            {items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${getStatusColor(item.status)}`} title={item.status}/>
                    <span className="leading-tight">{item.name}</span>
                </div>
            ))}
        </div>
    );
};

interface OrderCardProps {
  order: Order;
  onEdit: (order: Order) => void;
  onStatusUpdate: (e: React.MouseEvent, order: Order) => void;
  onReturn: (e: React.MouseEvent, order: Order) => void;
  onClaim: (e: React.MouseEvent, order: Order) => void;
  onDelete: (id: string) => void;
}

const OrderCard = React.memo(({ order, onEdit, onStatusUpdate, onReturn, onClaim, onDelete }: OrderCardProps) => {
  const handleContactClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.contactInfo) return;

    if (order.contactInfo.includes('@')) {
      window.location.href = `mailto:${order.contactInfo}`;
    } else if (order.contactInfo.startsWith('http')) {
      window.open(order.contactInfo, '_blank');
    } else {
      navigator.clipboard.writeText(order.contactInfo);
      alert('Contacto copiado al portapapeles: ' + order.contactInfo);
    }
  };

  const displayTitle = order.title || order.productName;

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border hover:shadow-md transition-shadow group relative ${
      order.status === OrderStatus.CLAIMED ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
            <StoreLogo 
              storeName={order.storeName} 
              orderUrl={order.orderUrl} 
              status={order.status} 
            />
            <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 self-start mt-1 ${
               order.category === 'familiar' 
               ? 'bg-teal-50 text-teal-700 border border-teal-100' 
               : 'bg-purple-50 text-purple-700 border border-purple-100'
            }`}>
              {order.category === 'familiar' ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {order.category || 'Personal'}
            </span>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="flex items-center gap-2 mb-2">
         <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold uppercase tracking-wide">
            <Store className="w-3 h-3" />
            {order.storeName}
         </span>
         {order.orderReference && (
          <span className="text-xs text-slate-400 font-mono">
            #{order.orderReference}
          </span>
        )}
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-1 line-clamp-1" title={displayTitle}>
        {displayTitle}
      </h3>
      
      {/* List items if multiple, otherwise standard display */}
      <OrderItemList items={order.items} />

      <OrderTimeline status={order.status} />

      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Fecha</span>
          <span className="font-medium text-slate-700">{new Date(order.date).toLocaleDateString()}</span>
        </div>
        
        {(order.status === OrderStatus.RECEIVED || order.status === OrderStatus.RETURNED) && order.receivedDate && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Recibido el</span>
            <span className="font-medium text-green-700">{new Date(order.receivedDate).toLocaleDateString()}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Importe</span>
          <span className="font-bold text-slate-900">{order.amount.toFixed(2)} {order.currency}</span>
        </div>
        {order.trackingNumber && (
            <div className="flex justify-between text-sm">
            <span className="text-slate-500">Tracking</span>
            <span className="font-medium text-blue-600 font-mono bg-blue-50 px-1 rounded">{order.trackingNumber}</span>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100 flex gap-2 flex-wrap">
          <button 
          onClick={() => onEdit(order)}
          className="px-3 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Editar
        </button>
        
        {/* Logic for Shipped Action */}
        {(order.status === OrderStatus.ORDERED || order.status === OrderStatus.PARTIALLY_SHIPPED) && (
          <button 
            onClick={(e) => onStatusUpdate(e, order)}
            className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Truck className="w-4 h-4" />
            {order.status === OrderStatus.PARTIALLY_SHIPPED ? 'Seguir Enviando' : 'Marcar Enviado'}
          </button>
        )}

        {/* Logic for Received Action */}
        {(order.status === OrderStatus.SHIPPED || order.status === OrderStatus.PARTIALLY_RECEIVED || order.status === OrderStatus.PARTIALLY_SHIPPED) && (
          <button 
            onClick={(e) => onStatusUpdate(e, order)}
            className="flex-1 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {order.status === OrderStatus.PARTIALLY_RECEIVED ? 'Seguir Recibiendo' : 'Recibido'}
          </button>
        )}

        {order.status === OrderStatus.RECEIVED && (
            <button 
            onClick={(e) => onReturn(e, order)}
            className="flex-1 px-3 py-2 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Devolver
          </button>
        )}

        {order.status !== OrderStatus.RETURNED && order.status !== OrderStatus.CLAIMED && (
          <button 
            onClick={(e) => onClaim(e, order)}
            className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            title="Marcar como Reclamado / Incidencia"
          >
            <AlertTriangle className="w-5 h-5" />
          </button>
        )}

        {order.invoiceFileName && (
          <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Factura">
            <FileText className="w-5 h-5" />
          </button>
        )}
        
        {order.contactInfo && (
           <button 
             onClick={handleContactClick} 
             className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
             title={`Contacto soporte: ${order.contactInfo}`}
           >
            <LifeBuoy className="w-5 h-5" />
          </button>
        )}

        {order.orderUrl ? (
           <a 
            href={order.orderUrl} 
            target="_blank" 
            rel="noreferrer" 
            className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            title="Ir a la web del pedido"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        ) : order.storeName.includes('http') && (
            <a href={order.storeName} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <ExternalLink className="w-5 h-5" />
          </a>
        )}
        
        <button 
          onClick={() => onDelete(order.id)}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
          title="Eliminar pedido"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
});

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [view, setView] = useState<'active' | 'history'>('active');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'personal' | 'familiar'>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clipboardContent, setClipboardContent] = useState<string>('');

  // Item Status Modal State
  const [isItemStatusModalOpen, setIsItemStatusModalOpen] = useState(false);
  const [itemStatusTargetOrder, setItemStatusTargetOrder] = useState<Order | null>(null);
  const [itemStatusTargetStatus, setItemStatusTargetStatus] = useState<OrderStatus.SHIPPED | OrderStatus.RECEIVED>(OrderStatus.SHIPPED);

  useEffect(() => {
    setOrders(getOrders());
  }, []);

  const handleSaveOrder = useCallback((order: Order) => {
    const updatedOrders = saveOrder(order);
    setOrders(updatedOrders);
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
      const updated = deleteOrder(id);
      setOrders(updated);
    }
  }, []);

  const handleExport = () => {
    exportToCSV(orders);
  };
  
  const handleBackupDownload = () => {
    downloadBackup(orders);
  };
  
  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (window.confirm('ADVERTENCIA: Esto reemplazará todos los datos actuales con los del archivo de copia de seguridad. ¿Continuar?')) {
      try {
        const restoredOrders = await restoreFromJSON(file);
        setOrders(restoredOrders);
        alert(`¡Éxito! Se han restaurado ${restoredOrders.length} pedidos.`);
      } catch (error) {
        console.error(error);
        alert('Error al restaurar: ' + (error as Error).message);
      }
    }
  };

  const handleEmergencyRecovery = () => {
    if(window.confirm("Esto buscará copias de seguridad automáticas en el navegador. Úsalo si tu lista está vacía por error. ¿Continuar?")) {
        const recovered = attemptAutoRecovery();
        if(recovered.length > 0) {
            setOrders(recovered);
            alert(`¡Éxito! Se han recuperado ${recovered.length} pedidos.`);
        } else {
            alert("No se encontraron copias de seguridad automáticas recientes.");
        }
    }
  };

  const changeView = (newView: 'active' | 'history') => {
    setView(newView);
    setStatusFilter('ALL'); 
  };

  const handleEditClick = useCallback((order: Order) => {
    setClipboardContent(''); 
    setEditingOrder(order);
    setIsModalOpen(true);
  }, []);

  const handleImportFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setEditingOrder(null);
        setClipboardContent(text);
        setIsModalOpen(true);
      } else {
        alert("El portapapeles parece estar vacío.");
      }
    } catch (err) {
      console.warn('Bloqueo de portapapeles detectado, abriendo modo manual.', err);
      // Fallback robusto: abrir el modal en modo "Pegar" vacío para que el usuario pegue manualmente
      setEditingOrder(null);
      setClipboardContent(''); 
      setIsModalOpen(true);
      // Opcional: mostrar un toast o mensaje pequeño
    }
  };

  const handleQuickStatusUpdate = useCallback((e: React.MouseEvent, order: Order) => {
    e.stopPropagation(); 
    
    // Determine target status based on current status
    let targetStatus: OrderStatus.SHIPPED | OrderStatus.RECEIVED = OrderStatus.SHIPPED;
    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.PARTIALLY_RECEIVED || order.status === OrderStatus.PARTIALLY_SHIPPED) {
      targetStatus = OrderStatus.RECEIVED;
    }

    // Logic for partial items
    if (order.items && order.items.length > 1) {
      setItemStatusTargetOrder(order);
      setItemStatusTargetStatus(targetStatus);
      setIsItemStatusModalOpen(true);
      return;
    }

    // Single item logic (Legacy behavior)
    if (targetStatus === OrderStatus.SHIPPED) {
      if (!order.trackingNumber || !order.carrier) {
        // Open edit modal if missing info
        setEditingOrder({ ...order, status: OrderStatus.SHIPPED });
        setClipboardContent('');
        setIsModalOpen(true);
      } else {
        const updatedItems = order.items.map(i => ({...i, status: OrderStatus.SHIPPED}));
        handleSaveOrder({ ...order, status: OrderStatus.SHIPPED, items: updatedItems });
      }
    } else {
       // Received
       const updatedItems = order.items.map(i => ({...i, status: OrderStatus.RECEIVED}));
       setEditingOrder({ 
        ...order, 
        status: OrderStatus.RECEIVED,
        items: updatedItems,
        receivedDate: new Date().toISOString().split('T')[0]
      });
      setClipboardContent('');
      setIsModalOpen(true);
    }
  }, [handleSaveOrder]);

  const handleItemStatusConfirm = (updatedItems: OrderItem[]) => {
      if (!itemStatusTargetOrder) return;
      
      const updatedOrder = { ...itemStatusTargetOrder, items: updatedItems };
      
      // If marking received, we might want to set date if not set
      if (itemStatusTargetStatus === OrderStatus.RECEIVED && !updatedOrder.receivedDate) {
          updatedOrder.receivedDate = new Date().toISOString().split('T')[0];
      }
      
      handleSaveOrder(updatedOrder);
      setItemStatusTargetOrder(null);
  };

  const handleReturnOrder = useCallback((e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que quieres marcar este pedido como Devuelto?")) {
       const updatedItems = order.items.map(i => ({...i, status: OrderStatus.RETURNED}));
       handleSaveOrder({ ...order, status: OrderStatus.RETURNED, items: updatedItems });
    }
  }, [handleSaveOrder]);
  
  const handleClaimOrder = useCallback((e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (window.confirm("¿Quieres marcar este pedido como 'Reclamado'? Esto indica que hay una incidencia pendiente.")) {
      handleSaveOrder({ ...order, status: OrderStatus.CLAIMED });
    }
  }, [handleSaveOrder]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const totalAllTime = orders.reduce((acc, o) => acc + o.amount, 0);
    const totalYear = orders
      .filter(o => new Date(o.date).getFullYear() === currentYear)
      .reduce((acc, o) => acc + o.amount, 0);
    const totalMonth = orders
      .filter(o => {
        const d = new Date(o.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .reduce((acc, o) => acc + o.amount, 0);

    return { totalAllTime, totalYear, totalMonth };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const filtered = orders.filter(order => {
      const searchLower = searchTerm.toLowerCase();
      
      const safeTitle = order.title || '';
      const safeProduct = order.productName || '';
      const safeStore = order.storeName || '';
      const safeRef = order.orderReference || '';
      
      // Search items as well
      const itemsMatch = order.items.some(i => i.name.toLowerCase().includes(searchLower));

      const matchesSearch = 
        safeTitle.toLowerCase().includes(searchLower) ||
        safeProduct.toLowerCase().includes(searchLower) ||
        safeStore.toLowerCase().includes(searchLower) ||
        safeRef.toLowerCase().includes(searchLower) ||
        itemsMatch; 
      
      const isHistory = order.status === OrderStatus.RECEIVED || order.status === OrderStatus.RETURNED;
      const isClaimed = order.status === OrderStatus.CLAIMED;
      
      const matchesView = view === 'active' ? (!isHistory || isClaimed) : (isHistory && !isClaimed);
      const matchesStatusFilter = statusFilter === 'ALL' || order.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || order.category === categoryFilter;
      
      return matchesSearch && matchesView && matchesStatusFilter && matchesCategory;
    });

    // Sorting Logic
    return filtered.sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        default:
          return 0;
      }
    });
  }, [orders, view, searchTerm, statusFilter, categoryFilter, sortOption]);

  const activeCount = orders.filter(o => o.status !== OrderStatus.RECEIVED && o.status !== OrderStatus.RETURNED).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <VolatileWarning />
      
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col fixed h-full z-10 overflow-y-auto top-[45px]">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3 text-blue-600 font-bold text-xl">
              <ShoppingBag className="w-8 h-8" />
              <span>TrackerAI</span>
            </div>
          </div>
          
          <nav className="p-4 space-y-2 flex-1">
            <button 
              onClick={() => changeView('active')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                view === 'active' 
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' 
                : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-5 h-5" />
                <span>Tablero</span>
              </div>
              {activeCount > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs py-0.5 px-2 rounded-full font-bold">
                  {activeCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => changeView('history')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                view === 'history' 
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' 
                : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <History className="w-5 h-5" />
              <span>Historial Google Sheets</span>
            </button>
          </nav>

          {/* DATA MANAGEMENT SECTION */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
              <Database className="w-3 h-3" />
              Sincronización Manual
            </h4>
            <div className="space-y-2">
              <button 
                onClick={handleBackupDownload}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors text-left shadow-sm"
                title="Descargar copia para guardar o pasar a otro dispositivo"
              >
                <Download className="w-4 h-4" />
                Guardar Copia
              </button>
              <label className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer shadow-sm">
                <Upload className="w-4 h-4" />
                Restaurar Copia
                <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
              </label>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 px-1 leading-tight">
              Usa "Guardar Copia" antes de cerrar o pedir cambios de código.
            </p>
          </div>

          {/* Stats Summary */}
          <div className="p-4 border-t border-slate-100 pb-20">
            <div className="bg-slate-900 rounded-xl p-4 text-white space-y-4">
              <div>
                <h4 className="font-semibold text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Wallet className="w-3 h-3" />
                  TOTAL HISTÓRICO
                </h4>
                <p className="text-xl font-bold">{stats.totalAllTime.toFixed(2)} €</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
                <div>
                  <h4 className="font-semibold text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    AÑO
                  </h4>
                  <p className="text-sm font-bold">{stats.totalYear.toFixed(2)} €</p>
                </div>
                <div>
                  <h4 className="font-semibold text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    MES
                  </h4>
                  <p className="text-sm font-bold">{stats.totalMonth.toFixed(2)} €</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 p-4 md:p-8">
          {/* Header Mobile */}
          <div className="md:hidden flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
              <ShoppingBag className="w-6 h-6" />
              <span>TrackerAI</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => changeView('active')} className={`p-2 rounded-lg ${view === 'active' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>
                <LayoutDashboard className="w-5 h-5" />
              </button>
              <button onClick={() => changeView('history')} className={`p-2 rounded-lg ${view === 'history' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Top Action Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {view === 'active' ? 'Pedidos Activos' : 'Historial de Compras'}
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {view === 'active' 
                  ? 'Gestiona y sigue tus pedidos en curso' 
                  : 'Pedidos recibidos, devueltos y archivados'}
              </p>
            </div>
            
            <div className="flex w-full md:w-auto gap-3">
              <button 
                onClick={handleImportFromClipboard}
                className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl font-medium transition-all"
                title="Copiar email y pegar aquí"
              >
                <ClipboardList className="w-5 h-5" />
                <span className="hidden lg:inline">Pegar Email</span>
              </button>

              <button 
                onClick={() => {
                  setEditingOrder(null);
                  setClipboardContent('');
                  setIsModalOpen(true);
                }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-slate-900/20"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden md:inline">Nueva Compra</span>
                <span className="md:hidden">Añadir</span>
              </button>
              {view === 'history' && (
                <button 
                  onClick={handleExport}
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-green-600/20"
                >
                  <Sheet className="w-5 h-5" />
                  <span className="hidden md:inline">Exportar a Sheets</span>
                  <span className="md:hidden">CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Buscar por producto, tienda o referencia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-700"
              />
            </div>
            
            {/* SORTING CONTROL */}
            <div className="relative min-w-[180px]">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ArrowUpDown className="w-5 h-5" />
              </div>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-700 appearance-none cursor-pointer font-medium"
              >
                <option value="date-desc">Fecha: Recientes</option>
                <option value="date-asc">Fecha: Antiguos</option>
                <option value="amount-desc">Importe: Alto-Bajo</option>
                <option value="amount-asc">Importe: Bajo-Alto</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            <div className="relative min-w-[150px]">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Users className="w-5 h-5" />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | 'personal' | 'familiar')}
                className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-700 appearance-none cursor-pointer"
              >
                <option value="ALL">Todas</option>
                <option value="personal">Personal</option>
                <option value="familiar">Familiar</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            
            <div className="relative min-w-[200px]">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Filter className="w-5 h-5" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | OrderStatus)}
                className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-700 appearance-none cursor-pointer"
              >
                <option value="ALL">Todos los estados</option>
                {view === 'active' ? (
                  <>
                    <option value={OrderStatus.ORDERED}>{OrderStatus.ORDERED}</option>
                    <option value={OrderStatus.PARTIALLY_SHIPPED}>{OrderStatus.PARTIALLY_SHIPPED}</option>
                    <option value={OrderStatus.SHIPPED}>{OrderStatus.SHIPPED}</option>
                    <option value={OrderStatus.PARTIALLY_RECEIVED}>{OrderStatus.PARTIALLY_RECEIVED}</option>
                    <option value={OrderStatus.CLAIMED}>{OrderStatus.CLAIMED}</option>
                  </>
                ) : (
                  <>
                    <option value={OrderStatus.RECEIVED}>{OrderStatus.RECEIVED}</option>
                    <option value={OrderStatus.RETURNED}>{OrderStatus.RETURNED}</option>
                  </>
                )}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Charts */}
          {view === 'history' && <StatsChart orders={orders.filter(o => o.status === OrderStatus.RECEIVED || o.status === OrderStatus.RETURNED)} />}

          {/* List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onEdit={handleEditClick}
                onStatusUpdate={handleQuickStatusUpdate}
                onReturn={handleReturnOrder}
                onClaim={handleClaimOrder}
                onDelete={handleDelete}
              />
            ))}

            {filteredOrders.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-center text-slate-400">
                  <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <Search className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-medium text-slate-600">No se encontraron pedidos</p>
                  <p className="text-sm mb-4">Intenta ajustar los filtros o añade una nueva compra.</p>
                  
                  <button 
                    onClick={handleEmergencyRecovery}
                    className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    ¿Perdiste tus datos? Intentar recuperar
                  </button>
              </div>
            )}
          </div>
        </main>

        <OrderModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveOrder}
          initialOrder={editingOrder}
          initialEmailText={clipboardContent}
        />

        {itemStatusTargetOrder && (
          <ItemStatusModal 
            isOpen={isItemStatusModalOpen}
            onClose={() => {
              setIsItemStatusModalOpen(false);
              setItemStatusTargetOrder(null);
            }}
            order={itemStatusTargetOrder}
            targetStatus={itemStatusTargetStatus}
            onConfirm={handleItemStatusConfirm}
          />
        )}
      </div>
    </div>
  );
}

export default App;