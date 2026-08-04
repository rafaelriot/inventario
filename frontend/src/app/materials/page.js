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
  ChevronRight,
  LayoutGrid,
  Table as TableIcon,
  FolderKanban,
  DollarSign,
  TrendingDown,
  Activity
} from 'lucide-react';

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentMaterialId, setCurrentMaterialId] = useState(null);
  
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
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchMaterials(selectedProjectId);
  }, [selectedProjectId]);

  const fetchInitialData = async () => {
    try {
      const projRes = await apiFetch('/projects');
      if (projRes.ok) {
        setProjects(await projRes.json());
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchMaterials = async (projectId = '') => {
    setLoading(true);
    try {
      const url = projectId ? `/materials?project_id=${projectId}` : '/materials';
      const res = await apiFetch(url);
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

      await fetchMaterials(selectedProjectId);
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
      fetchMaterials(selectedProjectId);
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

  // Calculate accumulated totals for top summary cards
  const totalStockValuation = filteredMaterials.reduce((sum, m) => sum + (parseFloat(m.current_stock) * parseFloat(m.unit_price)), 0);
  const totalSpentValuation = filteredMaterials.reduce((sum, m) => sum + parseFloat(m.total_spent_val || 0), 0);
  const selectedProjectName = projects.find(p => String(p.id) === String(selectedProjectId))?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Inventario de Materiales</h1>
          <p className="text-slate-500 text-sm mt-1">Catálogo, existencias en almacén y consumo acumulado.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Material
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center">
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mr-4 shrink-0">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Materiales</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{filteredMaterials.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mr-4 shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Valoración Stock Almacén</p>
            <p className="text-xl font-black text-emerald-600 mt-0.5">
              ${totalStockValuation.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center">
          <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mr-4 shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {selectedProjectId ? `Gasto en ${selectedProjectName}` : 'Gasto Total Historico'}
            </p>
            <p className="text-xl font-black text-rose-600 mt-0.5">
              ${totalSpentValuation.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Filter, Search & View Toggle Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Project & Search Filters */}
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

            {/* Filter by Project */}
            <div className="relative sm:w-60">
              <FolderKanban className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-600 transition-all shrink-0 cursor-pointer"
              >
                <option value="">🌐 Todos los Proyectos (Global)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    🏗️ {p.name}
                  </option>
                ))}
              </select>
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full sm:w-48 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-600 transition-all shrink-0"
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
          
          {/* Quick Filters & View Switcher */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterStatus === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterStatus('low')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterStatus === 'low' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Alertas
              </button>
              <button
                onClick={() => setFilterStatus('ok')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterStatus === 'ok' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Suficiente
              </button>
            </div>

            {/* View Toggle: Table vs Cards */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors ${
                  viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Vista de Tabla"
              >
                <TableIcon className="h-4 w-4 mr-1" />
                Tabla
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors ${
                  viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Vista de Tarjetas"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Cards
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Materials Main Content */}
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
      ) : viewMode === 'table' ? (

        /* ─── VISTA EN TABLA ────────────────────────────────── */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-4 px-5">Material</th>
                  <th className="py-4 px-4">Categoría</th>
                  <th className="py-4 px-4 text-right">Stock Actual</th>
                  <th className="py-4 px-4 text-right">P. Unitario</th>
                  <th className="py-4 px-4 text-right">Valor Stock</th>
                  <th className="py-4 px-4 text-right">
                    {selectedProjectId ? `Gastado (${selectedProjectName})` : 'Gastado Total ($)'}
                  </th>
                  <th className="py-4 px-4 text-center">Estado</th>
                  <th className="py-4 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaterials.map((m) => {
                  const isLow = m.is_low_stock === 1 || parseFloat(m.current_stock) <= parseFloat(m.min_stock);
                  const isOut = m.is_out_of_stock === 1 || parseFloat(m.current_stock) === 0;
                  const stockVal = parseFloat(m.current_stock) * parseFloat(m.unit_price);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-5">
                        <p className="font-bold text-slate-900">{m.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Mín. Alerta: {m.min_stock} {m.unit}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-block text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                          {m.category || 'Otros'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-black text-slate-900">{parseFloat(m.current_stock)}</span>
                        <span className="text-xs text-slate-400 ml-1">{m.unit}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-600">
                        ${parseFloat(m.unit_price).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-emerald-600">
                        ${stockVal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-rose-600">
                        ${m.total_spent_val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <p className="text-[10px] text-slate-400 font-normal">{m.total_used_qty} {m.unit}</p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Agotado
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Stock Bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                            Suficiente
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar Material"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {user.role === 'admin' && (
                            <button
                              onClick={() => handleDelete(m.id, m.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Eliminar Material"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* ─── VISTA EN CARDS ────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((m) => {
            const isLow = m.is_low_stock === 1 || parseFloat(m.current_stock) <= parseFloat(m.min_stock);
            const isOut = m.is_out_of_stock === 1 || parseFloat(m.current_stock) === 0;
            const threshold = parseFloat(m.min_stock);
            const current = parseFloat(m.current_stock);
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

                  {/* Progress bar */}
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
                      <span>Stock Mínimo: {threshold} {m.unit}</span>
                      <span className="text-rose-600 font-bold">
                        Gastado: ${m.total_spent_val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
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

      {/* Modal Crear / Editar Material */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">
                {modalMode === 'edit' ? 'Editar Material' : 'Nuevo Material'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
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
                  placeholder="Ej. Cemento Gris Tolteca"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Unidad de Medida
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Sacos, m³, Pza"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {modalMode === 'create' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Stock Inicial
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                    />
                  </div>
                )}

                <div className={modalMode === 'edit' ? 'col-span-1' : ''}>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="10"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>

                <div className={modalMode === 'edit' ? 'col-span-2' : ''}>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Precio Unitario ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center"
                >
                  {submitting ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : modalMode === 'edit' ? (
                    'Guardar Cambios'
                  ) : (
                    'Crear Material'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
