import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, OrderCategory, OrderItem } from '../types';
import { X, Upload, FileText, Wand2, AlertCircle, LifeBuoy, Hash, User, Users, Link as LinkIcon } from 'lucide-react';
import { parseEmailWithGemini } from '../services/geminiService';
import { generateId } from '../services/storageService';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: Order) => void;
  initialOrder?: Order | null;
  initialEmailText?: string;
}

const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, onSave, initialOrder, initialEmailText }) => {
  const [isParsing, setIsParsing] = useState(false);
  const [pasteMode, setPasteMode] = useState(!initialOrder);
  const [emailText, setEmailText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<Partial<Order>>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    productName: '',
    items: [],
    storeName: '',
    orderReference: '',
    orderUrl: '',
    amount: 0,
    currency: 'EUR',
    status: OrderStatus.ORDERED,
    category: 'personal',
    trackingNumber: '',
    carrier: '',
    invoiceFileName: '',
    notes: '',
    contactInfo: '',
    receivedDate: ''
  });

  useEffect(() => {
    setErrors({});
    if (initialOrder) {
      setFormData({
        ...initialOrder,
        title: initialOrder.title || initialOrder.productName,
        category: initialOrder.category || 'personal',
        receivedDate: initialOrder.receivedDate || '',
        orderUrl: initialOrder.orderUrl || '',
        items: initialOrder.items || []
      });
      setPasteMode(false);
      setEmailText('');
    } else {
      // Reset completo
      setFormData({
        title: '',
        date: new Date().toISOString().split('T')[0],
        productName: '',
        items: [],
        storeName: '',
        orderReference: '',
        orderUrl: '',
        amount: 0,
        currency: 'EUR',
        status: OrderStatus.ORDERED,
        category: 'personal',
        trackingNumber: '',
        carrier: '',
        invoiceFileName: '',
        notes: '',
        contactInfo: '',
        receivedDate: ''
      });
      
      if (initialEmailText) {
        setPasteMode(true);
        setEmailText(initialEmailText);
        // Si hay texto, intentamos parsear automáticamente tras un breve delay o acción
        // Para UX, lo hacemos inmediatamente si se pasa
        handleAiParse(initialEmailText);
      } else {
        setPasteMode(true);
        setEmailText('');
      }
    }
  }, [initialOrder, isOpen, initialEmailText]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!formData.title?.trim()) {
      newErrors.title = 'El título es obligatorio.';
      isValid = false;
    }

    if (!formData.productName?.trim()) {
      newErrors.productName = 'La descripción del producto es obligatoria.';
      isValid = false;
    }

    if (!formData.storeName?.trim()) {
      newErrors.storeName = 'El nombre de la tienda es obligatorio.';
      isValid = false;
    }

    if (formData.amount === undefined || formData.amount <= 0 || isNaN(formData.amount)) {
      newErrors.amount = 'El importe debe ser mayor a 0.';
      isValid = false;
    }

    if (!formData.date) {
      newErrors.date = 'La fecha es obligatoria.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleAiParse = async (textToParse: string = emailText) => {
    if (!textToParse.trim()) return;
    setIsParsing(true);
    setErrors({});
    try {
      const result = await parseEmailWithGemini(textToParse);
      
      // Convertir lista de strings a OrderItems iniciales
      let initialItems: OrderItem[] = [];
      if (result.items && result.items.length > 0) {
        initialItems = result.items.map(name => ({ name, status: OrderStatus.ORDERED }));
      } else if (result.productName) {
         initialItems = [{ name: result.productName, status: OrderStatus.ORDERED }];
      }

      setFormData(prev => ({
        ...prev,
        ...result,
        title: result.title || (result.productName ? result.productName.split('\n')[0].substring(0, 50) : ''),
        date: result.date || new Date().toISOString().split('T')[0],
        items: initialItems
      }));
      setPasteMode(false);
    } catch (error) {
      console.error(error);
      alert("Error al procesar el email. Por favor revisa los datos manualmente.");
      setPasteMode(false);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Procesar productName para generar items si no existen o han cambiado
    let finalItems = formData.items || [];
    
    // Si el usuario editó el textarea manualmente, regeneramos los items basándonos en las líneas
    // Esto es una simplificación: asumimos que cada línea no vacía es un producto
    const lines = (formData.productName || '').split(/\n|•/).map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length > 0) {
        // Estrategia de fusión: Intentar mantener estados de items existentes si coinciden en nombre
        finalItems = lines.map(lineName => {
            const existingItem = finalItems.find(i => i.name === lineName);
            return {
                name: lineName,
                status: existingItem ? existingItem.status : (formData.status || OrderStatus.ORDERED)
            };
        });
    }

    const newOrder: Order = {
      id: initialOrder?.id || generateId(),
      title: formData.title!,
      date: formData.date!,
      productName: formData.productName!,
      items: finalItems,
      storeName: formData.storeName!,
      orderReference: formData.orderReference,
      orderUrl: formData.orderUrl,
      amount: Number(formData.amount),
      currency: formData.currency || 'EUR',
      status: formData.status || OrderStatus.ORDERED,
      category: formData.category || 'personal',
      trackingNumber: formData.trackingNumber,
      carrier: formData.carrier,
      invoiceFileName: formData.invoiceFileName,
      notes: formData.notes,
      contactInfo: formData.contactInfo,
      receivedDate: formData.receivedDate
    };
    onSave(newOrder);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, invoiceFileName: e.target.files![0].name }));
    }
  };

  const handleStatusChange = (status: OrderStatus) => {
    const updates: Partial<Order> = { status };
    if (status === OrderStatus.RECEIVED && !formData.receivedDate) {
      updates.receivedDate = new Date().toISOString().split('T')[0];
    }
    // Actualizar todos los items al nuevo estado
    const updatedItems = (formData.items || []).map(i => ({...i, status}));
    setFormData({ ...formData, ...updates, items: updatedItems });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {initialOrder ? 'Editar Pedido' : 'Nueva Compra'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {pasteMode ? (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm">
                <p className="font-medium flex items-center gap-2">
                   <Wand2 className="w-4 h-4" />
                   AI Magic Parser
                </p>
                <p className="mt-1 opacity-90">Copia y pega el contenido del email de confirmación aquí. La IA extraerá los detalles automáticamente.</p>
              </div>
              <textarea 
                className="w-full h-48 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                placeholder="Pega el contenido del email aquí..."
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                 <button 
                  type="button"
                  onClick={() => setPasteMode(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                >
                  Introducir Manualmente
                </button>
                <button 
                  onClick={() => handleAiParse(emailText)}
                  disabled={isParsing || !emailText}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isParsing ? 'Analizando...' : 'Procesar con IA'}
                  {!isParsing && <Wand2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {isParsing && (
                 <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-2xl">
                    <div className="flex flex-col items-center gap-2 text-blue-600 font-semibold animate-pulse">
                      <Wand2 className="w-8 h-8" />
                      <span>Analizando datos...</span>
                    </div>
                 </div>
              )}

              <div className="space-y-6">
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título / Resumen *</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={e => {
                      setFormData({...formData, title: e.target.value});
                      if(errors.title) setErrors({...errors, title: ''});
                    }}
                    className={`w-full px-4 py-3 text-lg font-semibold border rounded-lg focus:ring-2 outline-none ${
                      errors.title 
                        ? 'border-red-300 focus:ring-red-200 bg-red-50' 
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                    placeholder="Ej. Regalo Cumpleaños, Zapatillas Running..."
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.title}
                    </p>
                  )}
                </div>

                {/* Category Selection */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Pedido</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 relative cursor-pointer flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${formData.category === 'personal' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'}`}>
                      <input 
                        type="radio" 
                        name="category" 
                        value="personal"
                        checked={formData.category === 'personal'}
                        onChange={() => setFormData({...formData, category: 'personal'})}
                        className="sr-only"
                      />
                      <User className="w-5 h-5" />
                      <span className="font-medium text-sm">Personal</span>
                    </label>

                    <label className={`flex-1 relative cursor-pointer flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${formData.category === 'familiar' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'}`}>
                      <input 
                        type="radio" 
                        name="category" 
                        value="familiar"
                        checked={formData.category === 'familiar'}
                        onChange={() => setFormData({...formData, category: 'familiar'})}
                        className="sr-only"
                      />
                      <Users className="w-5 h-5" />
                      <span className="font-medium text-sm">Familiar</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Detalle Productos (uno por línea) *
                    </label>
                    <textarea 
                      required
                      value={formData.productName}
                      onChange={e => {
                        setFormData({...formData, productName: e.target.value});
                        if(errors.productName) setErrors({...errors, productName: ''});
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${
                        errors.productName 
                          ? 'border-red-300 focus:ring-red-200 bg-red-50' 
                          : 'border-slate-200 focus:ring-blue-500'
                      }`}
                      placeholder="• Producto 1&#10;• Producto 2"
                      rows={5}
                      style={{ resize: 'vertical' }}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Cada línea se tratará como un producto individual para envíos parciales.</p>
                    {errors.productName && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {errors.productName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tienda / Web *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.storeName}
                      onChange={e => {
                        setFormData({...formData, storeName: e.target.value});
                        if(errors.storeName) setErrors({...errors, storeName: ''});
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${
                        errors.storeName 
                          ? 'border-red-300 focus:ring-red-200 bg-red-50' 
                          : 'border-slate-200 focus:ring-blue-500'
                      }`}
                      placeholder="Ej. Amazon"
                    />
                    {errors.storeName && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {errors.storeName}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Referencia Pedido</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text" 
                        value={formData.orderReference || ''}
                        onChange={e => setFormData({...formData, orderReference: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej. #12345678"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Enlace al Pedido</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text" 
                        value={formData.orderUrl || ''}
                        onChange={e => setFormData({...formData, orderUrl: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="https://tienda.com/mi-pedido/..."
                      />
                    </div>
                  </div>
                  
                  {/* Dates Row */}
                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Compra *</label>
                      <input 
                        required
                        type="date" 
                        value={formData.date}
                        onChange={e => {
                          setFormData({...formData, date: e.target.value});
                          if(errors.date) setErrors({...errors, date: ''});
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${
                          errors.date 
                            ? 'border-red-300 focus:ring-red-200 bg-red-50' 
                            : 'border-slate-200 focus:ring-blue-500'
                        }`}
                      />
                      {errors.date && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.date}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Entrega</label>
                      <input 
                        type="date" 
                        value={formData.receivedDate || ''}
                        onChange={e => setFormData({...formData, receivedDate: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Importe *</label>
                      <input 
                        required
                        type="number" 
                        min="0.01"
                        step="0.01"
                        value={formData.amount}
                        onChange={e => {
                          let val = parseFloat(e.target.value);
                          const strVal = e.target.value;
                          if (strVal.includes('.') && strVal.split('.')[1].length > 2) {
                             val = Math.round(val * 100) / 100;
                          }
                          setFormData({...formData, amount: val});
                          if(errors.amount) setErrors({...errors, amount: ''});
                        }}
                        onBlur={(e) => {
                           let val = parseFloat(e.target.value);
                           if (!isNaN(val)) {
                             val = Math.round(val * 100) / 100;
                             setFormData(prev => ({...prev, amount: val}));
                           }
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${
                          errors.amount 
                            ? 'border-red-300 focus:ring-red-200 bg-red-50' 
                            : 'border-slate-200 focus:ring-blue-500'
                        }`}
                      />
                      {errors.amount && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.amount}
                        </p>
                      )}
                    </div>
                     <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                      <select 
                        value={formData.currency}
                        onChange={e => setFormData({...formData, currency: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-slate-100 pt-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Detalles de Envío y Notas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Número de Seguimiento</label>
                    <input 
                      type="text" 
                      value={formData.trackingNumber}
                      onChange={e => setFormData({...formData, trackingNumber: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ej. 1Z999AA101..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transportista</label>
                    <input 
                      type="text" 
                      value={formData.carrier}
                      onChange={e => setFormData({...formData, carrier: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ej. Correos, DHL"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contacto Soporte / Reclamaciones</label>
                    <div className="relative">
                      <LifeBuoy className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text" 
                        value={formData.contactInfo}
                        onChange={e => setFormData({...formData, contactInfo: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Email de soporte, teléfono o enlace para reclamar..."
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Factura (Adjuntar)</label>
                    <div className="flex items-center gap-4">
                       <label className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
                          <Upload className="w-4 h-4" />
                          <span>Subir Archivo</span>
                          <input type="file" className="hidden" onChange={handleFileChange} />
                       </label>
                       {formData.invoiceFileName && (
                         <span className="text-sm text-green-600 flex items-center gap-1">
                           <FileText className="w-4 h-4" />
                           {formData.invoiceFileName}
                         </span>
                       )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                    <textarea 
                      value={formData.notes || ''}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                      placeholder="Detalles adicionales, recordatorios, contenido del paquete..."
                    />
                  </div>
                </div>
              </div>

              {/* Status Section for Whole Order */}
              <div className="border-t border-slate-100 pt-6">
                 <label className="block text-sm font-medium text-slate-700 mb-2">Estado General</label>
                 <div className="flex flex-wrap gap-2">
                    {[OrderStatus.ORDERED, OrderStatus.SHIPPED, OrderStatus.RECEIVED, OrderStatus.RETURNED].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatusChange(status)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          formData.status === status 
                            ? 'bg-slate-900 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-600/20"
                >
                  Guardar Pedido
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderModal;