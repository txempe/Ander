import React, { useState } from 'react';
import { Order, OrderItem, OrderStatus } from '../types';
import { X, CheckSquare, Square, Package, Truck, CheckCircle } from 'lucide-react';

interface ItemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  targetStatus: OrderStatus.SHIPPED | OrderStatus.RECEIVED;
  onConfirm: (updatedItems: OrderItem[]) => void;
}

const ItemStatusModal: React.FC<ItemStatusModalProps> = ({ isOpen, onClose, order, targetStatus, onConfirm }) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  if (!isOpen) return null;

  // Filtrar items elegibles para el cambio
  // Ej: Si marcamos como Enviado, mostramos items que están en Pendiente (Ordered)
  // Ej: Si marcamos como Recibido, mostramos items que están Enviados o Pendientes
  const eligibleItems = order.items.map((item, index) => {
    let isEligible = false;
    if (targetStatus === OrderStatus.SHIPPED) {
      isEligible = item.status === OrderStatus.ORDERED;
    } else if (targetStatus === OrderStatus.RECEIVED) {
      isEligible = item.status === OrderStatus.ORDERED || item.status === OrderStatus.SHIPPED || item.status === OrderStatus.PARTIALLY_SHIPPED;
    }
    return { ...item, originalIndex: index, isEligible };
  });

  const toggleItem = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const toggleAll = () => {
    const allEligibleIndices = eligibleItems.filter(i => i.isEligible).map(i => i.originalIndex);
    if (selectedIndices.length === allEligibleIndices.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(allEligibleIndices);
    }
  };

  const handleConfirm = () => {
    const newItems = [...order.items];
    selectedIndices.forEach(idx => {
      newItems[idx].status = targetStatus;
    });
    onConfirm(newItems);
    onClose();
  };

  const Icon = targetStatus === OrderStatus.SHIPPED ? Truck : CheckCircle;
  const verb = targetStatus === OrderStatus.SHIPPED ? "enviar" : "recibir";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Icon className="w-5 h-5 text-blue-600" />
            Actualización Parcial
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            Selecciona los productos que quieres marcar como <strong>{targetStatus}</strong>.
          </p>
          
          <div className="flex justify-end mb-2">
            <button onClick={toggleAll} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              {selectedIndices.length === eligibleItems.filter(i => i.isEligible).length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {eligibleItems.map((item, idx) => (
              <div 
                key={idx} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  !item.isEligible 
                    ? 'opacity-50 bg-slate-50 border-slate-100' 
                    : selectedIndices.includes(item.originalIndex)
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-blue-300 cursor-pointer'
                }`}
                onClick={() => item.isEligible && toggleItem(item.originalIndex)}
              >
                <div className={`shrink-0 ${!item.isEligible ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    {selectedIndices.includes(item.originalIndex) 
                      ? <CheckSquare className="w-5 h-5 text-blue-600" /> 
                      : <Square className="w-5 h-5 text-slate-300" />
                    }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                  <p className="text-xs text-slate-500">Estado actual: {item.status}</p>
                </div>
                {!item.isEligible && (
                    <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-500">No elegible</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
             <button onClick={onClose} className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">
                Cancelar
             </button>
             <button 
                onClick={handleConfirm}
                disabled={selectedIndices.length === 0}
                className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
             >
                Confirmar ({selectedIndices.length})
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemStatusModal;