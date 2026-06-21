'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '../../utils/api';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Minus, 
  Calendar, 
  User, 
  ShoppingBag,
  History,
  FileCheck,
  Search
} from 'lucide-react';

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const actionParam = searchParams.get('action');

  const [materials, setMaterials] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState('compra'); // 'compra' | 'gasto'
  
  // Search query for history
  const [searchQuery, setSearchQuery] = useState('');

  // Form Fields
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [details, setDetails] = useState(''); // Responsible
  const [suppliersList, setSuppliersList] = useState([]);
  const [providerId, setProviderId] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (actionParam === 'gasto' || actionParam === 'compra') {
      setActiveForm(actionParam);
    }
  }, [actionParam]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [matRes, histRes, supRes] = await Promise.all([
        apiFetch('/materials'),
        apiFetch('/transactions/history'),
        apiFetch('/suppliers')
      ]);

      if (matRes.ok && histRes.ok && supRes.ok) {
        const matData = await matRes.json();
        const histData = await histRes.json();
        const supData = await supRes.json();
        setMaterials(matData);
        setHistory(histData);
        setSuppliersList(supData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormToggle = (type) => {
    setActiveForm(type);
    setMaterialId('');
    setQuantity('');
    setDetails('');
    setProviderId('');
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    const isPurchase = activeForm === 'compra';
    
    if (!materialId || !quantity || !date || (isPurchase ? !providerId : !details)) {
      setFormError('Todos los campos son obligatorios.');
      setSubmitting(false);
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setFormError('La cantidad debe ser mayor a cero.');
      setSubmitting(false);
      return;
    }

    try {
      const isPurchase = activeForm === 'compra';
      const endpoint = isPurchase ? '/transactions/purchases' : '/transactions/usages';
      const payload = isPurchase 
        ? { material_id: materialId, quantity: qty, purchase_date: date, provider_id: providerId }
        : { material_id: materialId, quantity: qty, usage_date: date, responsible: details };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al procesar movimiento.');
      }

      setFormSuccess(data.message);
      
      // Reset forms
      setMaterialId('');
      setQuantity('');
      setDetails('');
      setProviderId('');

      // Refresh transactions and stock
      await fetchInitialData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHistory = history.filter(item => 
    item.material_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Movimientos de Inventario</h1>
        <p className="text-slate-500 text-sm mt-1">Registra entradas, salidas e inspecciona el historial.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Panel */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header Tabs */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => handleFormToggle('compra')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center border-b-2 transition-all ${
                  activeForm === 'compra' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva Compra (Entrada)
              </button>
              <button
                onClick={() => handleFormToggle('gasto')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center border-b-2 transition-all ${
                  activeForm === 'gasto' 
                    ? 'border-rose-600 text-rose-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Minus className="mr-2 h-4 w-4" />
                Registrar Gasto (Salida)
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold">
                  {formSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Seleccionar Material
                </label>
                <select
                  required
                  value={materialId}
                  onChange={(e) => setMaterialId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-600 transition-all"
                >
                  <option value="">-- Elige un material --</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Stock: {parseFloat(m.current_stock)} {m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="Ej. 15.5"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              {activeForm === 'compra' ? (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Proveedor
                    </label>
                    <a href="/suppliers" className="text-[10px] text-blue-600 hover:text-blue-500 font-bold">
                      + Crear Proveedor
                    </a>
                  </div>
                  <div className="relative">
                    <ShoppingBag className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <select
                      required
                      value={providerId}
                      onChange={(e) => setProviderId(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-600 transition-all"
                    >
                      <option value="">-- Elige un proveedor --</option>
                      {suppliersList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Responsable que lo Usó
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ej. Ing. Rafael Gómez"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 px-4 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center ${
                  activeForm === 'compra' 
                    ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800' 
                    : 'bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800'
                }`}
              >
                {submitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : activeForm === 'compra' ? (
                  'Registrar Entrada'
                ) : (
                  'Registrar Salida'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* History Panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center">
              <History className="h-5 w-5 text-slate-500 mr-2.5" />
              <h2 className="text-base font-bold text-slate-900">Historial de Transacciones</h2>
            </div>
            
            {/* Search History */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar en historial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] mt-4 space-y-4 pr-1">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <History className="h-8 w-8 mb-2 text-slate-300" />
                <p className="text-sm font-medium">No se encontraron movimientos registrados</p>
              </div>
            ) : (
              filteredHistory.map((tx, idx) => {
                const isPurchase = tx.type === 'compra';
                return (
                  <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100/50 transition-colors">
                    <div className="flex items-center min-w-0">
                      <div className={`h-9 w-9 rounded-xl shrink-0 ${isPurchase ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} flex items-center justify-center mr-3`}>
                        {isPurchase ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{tx.material_name}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {isPurchase ? 'Proveedor: ' : 'Responsable: '}
                          <span className="font-semibold text-slate-700">{tx.details}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Registrado por: {tx.user_name || 'Desconocido'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className={`text-sm font-black ${isPurchase ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isPurchase ? '+' : '-'}{parseFloat(tx.quantity)} {tx.unit}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end font-medium">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(tx.date).toISOString().split('T')[0]}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
