'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { 
  Truck, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X,
  Phone,
  UserCheck
} from 'lucide-react';

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentSupplierId, setCurrentSupplierId] = useState(null);
  
  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await apiFetch('/suppliers');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setName('');
    setPhone('');
    setContact('');
    setError('');
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    setCurrentSupplierId(supplier.id);
    setName(supplier.name);
    setPhone(supplier.phone || '');
    setContact(supplier.contact || '');
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

    if (!name) {
      setError('El nombre del proveedor es obligatorio.');
      setSubmitting(false);
      return;
    }

    try {
      const isEdit = modalMode === 'edit';
      const endpoint = isEdit ? `/suppliers/${currentSupplierId}` : '/suppliers';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = { name, phone, contact };

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Ocurrió un error al procesar el proveedor.');
      }

      await fetchSuppliers();
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a "${name}"? Las compras asociadas a este proveedor quedarán registradas con proveedor desconocido.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/suppliers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al eliminar proveedor.');
      }
      fetchSuppliers();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.contact && s.contact.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Directorio de Proveedores</h1>
          <p className="text-slate-500 text-sm mt-1">Registra y administra proveedores frecuentes de la obra.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Registrar Proveedor
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o contacto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">
          Mostrando {filteredSuppliers.length} de {suppliers.length} proveedores
        </div>
      </div>

      {/* Suppliers List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Truck className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-900">No se encontraron proveedores</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery ? 'Prueba ajustando el término de búsqueda.' : 'Registra tus proveedores frecuentes para seleccionarlos al registrar compras.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((s) => (
            <div 
              key={s.id} 
              className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 p-5 shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-bold text-slate-900 line-clamp-1">{s.name}</h3>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700">
                    Activo
                  </span>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="flex items-center text-xs text-slate-500">
                    <UserCheck className="h-3.5 w-3.5 mr-2 text-slate-400 shrink-0" />
                    <span>Contacto: </span>
                    <span className="font-semibold text-slate-700 ml-1 truncate">{s.contact || 'Sin registrar'}</span>
                  </div>
                  <div className="flex items-center text-xs text-slate-500">
                    <Phone className="h-3.5 w-3.5 mr-2 text-slate-400 shrink-0" />
                    <span>Teléfono: </span>
                    <span className="font-semibold text-slate-700 ml-1">{s.phone || 'Sin registrar'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-end space-x-2">
                <button
                  onClick={() => handleOpenEdit(s)}
                  className="p-2 text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors border border-slate-100"
                  title="Editar Proveedor"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                {user.role === 'admin' && (
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    className="p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors border border-slate-100"
                    title="Eliminar Proveedor"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Create/Edit Supplier */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {modalMode === 'create' ? 'Registrar Proveedor' : 'Editar Datos del Proveedor'}
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
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nombre de la Empresa / Distribuidora
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Distribuidora de Aceros S.A."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nombre del Contacto / Vendedor
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ing. Carlos Pérez"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  placeholder="Ej. 555-0199"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all"
                />
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
                  {submitting ? 'Guardando...' : modalMode === 'create' ? 'Crear' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
