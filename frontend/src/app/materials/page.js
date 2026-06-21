'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { 
  Boxes, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  Search, 
  X,
  FileCheck,
  ChevronRight
} from 'lucide-react';

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentMaterialId, setCurrentMaterialId] = useState(null);
  
  // Filter states
  // Filter states
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'low' | 'ok'
  const [filterCategory, setFilterCategory] = useState('all');

  // Form states
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('Sacos');
  const [minStock, setMinStock] = useState('10');
  const [initialStock, setInitialStock] = useState('0');
  const [unitPrice, setUnitPrice] = useState('0');
  const [category, setCategory] = useState('Otros');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const res = await apiFetch('/materials');
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setName('');
    setUnit('Sacos');
    setMinStock('10');
    setInitialStock('0');
    setUnitPrice('0');
    setCategory('Otros');
    setError('');
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (material) => {
    setCurrentMaterialId(material.id);
    setName(material.name);
    setUnit(material.unit);
    setMinStock(material.min_stock.toString());
    setInitialStock(material.current_stock.toString());
    setUnitPrice(material.unit_price.toString());
    setCategory(material.category || 'Otros');
    setError('');
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!name || !unit) {
      setError('El nombre y la unidad son obligatorios.');
      setSubmitting(false);
      return;
    }

    try {
      const isEdit = modalMode === 'edit';
      const endpoint = isEdit ? `/materials/${currentMaterialId}` : '/materials';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit 
        ? { name, unit, min_stock: parseFloat(minStock), unit_price: parseFloat(unitPrice), category }
        : { name, unit, min_stock: parseFloat(minStock), current_stock: parseFloat(initialStock), unit_price: parseFloat(unitPrice), category };

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Ocurrió un error en la solicitud.');
      }

      await fetchMaterials();
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${name}" del inventario? Esta acción también eliminará su historial.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/materials/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al eliminar material.');
      }
      fetchMaterials();
    } catch (err) {
      alert(err.message);
    }
  };

  // Filter logic
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const matchesCategory = filterCategory === 'all' || m.category === filterCategory;
    if (!matchesCategory) return false;
    
    const isLow = parseFloat(m.current_stock) <= parseFloat(m.min_stock);
    if (filterStatus === 'low') return isLow;
    if (filterStatus === 'ok') return !isLow;
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Inventario de Materiales</h1>
          <p className="text-slate-500 text-sm mt-1">Catálogo y existencias disponibles en la obra.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Material
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between w-full">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar material..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
              />
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full sm:w-52 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-600 transition-all shrink-0"
            >
              <option value="all">Todas las Categorías</option>
              <option value="Cemento/Pegamentos">Cemento/Pegamentos</option>
              <option value="Metales/Aceros">Metales/Aceros</option>
              <option value="Áridos/Arenas">Áridos/Arenas</option>
              <option value="Herramientas">Herramientas</option>
              <option value="Aditivos/Químicos">Aditivos/Químicos</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
          
          {/* Quick Filters */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full sm:w-auto shrink-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterStatus === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterStatus('low')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterStatus === 'low' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Stock Bajo / Alertas
            </button>
            <button
              onClick={() => setFilterStatus('ok')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterStatus === 'ok' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Stock Suficiente
            </button>
          </div>
        </div>
        
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">
          Mostrando {filteredMaterials.length} de {materials.length} materiales
        </div>
      </div>

      {/* Materials List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Boxes className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-900">No se encontraron materiales</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || filterStatus !== 'all' ? 'Prueba ajustando los filtros o la búsqueda.' : 'Comienza agregando un nuevo material al catálogo.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((m) => {
            const isLow = m.is_low_stock === 1 || parseFloat(m.current_stock) <= parseFloat(m.min_stock);
            const isOut = m.is_out_of_stock === 1 || parseFloat(m.current_stock) === 0;
            
            // Calculate a percentage for progress bar
            const threshold = parseFloat(m.min_stock);
            const current = parseFloat(m.current_stock);
            // We set 100% as min_stock * 2.5 to show space, or 100% if empty
            const maxRef = threshold > 0 ? threshold * 2.5 : 10;
            const percentage = Math.min((current / maxRef) * 100, 100);

            return (
              <div 
                key={m.id} 
                className={`bg-white rounded-2xl border p-5 shadow-sm transition-all flex flex-col justify-between ${
                  isOut ? 'border-rose-200 bg-rose-50/10' : isLow ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="inline-block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 bg-slate-100 px-2 py-0.5 rounded">
                        {m.category || 'Otros'}
                      </span>
                      <h3 className="font-bold text-slate-900 line-clamp-2">{m.name}</h3>
                    </div>
                    {isOut ? (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Agotado
                      </span>
                    ) : isLow ? (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Stock Bajo
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                        Suficiente
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline space-x-1.5 mt-2 justify-between">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-2xl font-black text-slate-900">{parseFloat(m.current_stock)}</span>
                      <span className="text-sm text-slate-500 font-medium">{m.unit}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">P. Unitario: <span className="font-semibold text-slate-700">${parseFloat(m.unit_price).toFixed(2)}</span></p>
                      <p className="text-xs font-bold text-blue-600">Valor: ${(parseFloat(m.current_stock) * parseFloat(m.unit_price)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {/* Visual Progress Bar (UX Addition) */}
                  <div className="mt-3.5 space-y-1">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOut ? 'w-0' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>0%</span>
                      <span>Stock Mínimo: {threshold} {m.unit}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-xs text-slate-500">
                    <span>Unidad de medida:</span>
                    <span className="font-semibold text-slate-700">{m.unit}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-end space-x-2">
                  <button
                    onClick={() => handleOpenEdit(m)}
                    className="p-2 text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors border border-slate-100"
                    title="Editar Material"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {user.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(m.id, m.name)}
                      className="p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors border border-slate-100"
                      title="Eliminar Material"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal - Create/Edit Material */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {modalMode === 'create' ? 'Agregar Nuevo Material' : 'Editar Datos del Material'}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nombre del Material
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cemento Portland Tipo 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-600 transition-all"
                >
                  <option value="Cemento/Pegamentos">Cemento/Pegamentos</option>
                  <option value="Metales/Aceros">Metales/Aceros</option>
                  <option value="Áridos/Arenas">Áridos/Arenas</option>
                  <option value="Herramientas">Herramientas</option>
                  <option value="Aditivos/Químicos">Aditivos/Químicos</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Unidad de Medida
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-600 transition-all"
                  >
                    <option value="Sacos">Sacos</option>
                    <option value="Piezas">Piezas</option>
                    <option value="Kilogramos">Kilogramos</option>
                    <option value="Metros Cúbicos">Metros Cúbicos</option>
                    <option value="Metros Lineales">Metros Lineales</option>
                    <option value="Galones">Galones</option>
                    <option value="Libras">Libras</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Stock Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Precio Unitario ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>

                {modalMode === 'create' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Stock Inicial
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>
                ) : (
                  <div className="flex items-end justify-start pb-2">
                    <p className="text-[10px] text-slate-400">El stock se modifica registrando compras o gastos.</p>
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                >
                  {submitting ? 'Guardando...' : modalMode === 'create' ? 'Crear Material' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
