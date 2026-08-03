'use client';

import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/api';
import {
  FlaskConical,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Send,
  Eye,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Package,
  ArrowLeft,
  History
} from 'lucide-react';

function MixturesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const detailId = searchParams.get('detail');

  const [mixtures, setMixtures] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail view
  const [detailMixture, setDetailMixture] = useState(null);
  const [detailHistory, setDetailHistory] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentMixtureId, setCurrentMixtureId] = useState(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('Kg');
  const [formDescription, setFormDescription] = useState('');
  const [formComponents, setFormComponents] = useState([{ material_id: '', percentage: '' }]);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Usage modal
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [usageMixture, setUsageMixture] = useState(null);
  const [usageQuantity, setUsageQuantity] = useState('');
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);
  const [usageResponsible, setUsageResponsible] = useState('');
  const [usageNotes, setUsageNotes] = useState('');
  const [usageError, setUsageError] = useState('');
  const [usageSuccess, setUsageSuccess] = useState('');
  const [usageSubmitting, setUsageSubmitting] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const unitOptions = ['Kg', 'Litros', 'Metros Cúbicos', 'Sacos', 'Toneladas', 'Piezas', 'Galones'];

  const componentColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
    'bg-violet-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
    'bg-teal-500', 'bg-indigo-500'
  ];

  const componentTextColors = [
    'text-blue-700', 'text-emerald-700', 'text-amber-700', 'text-rose-700',
    'text-violet-700', 'text-cyan-700', 'text-orange-700', 'text-pink-700',
    'text-teal-700', 'text-indigo-700'
  ];

  const componentBgColors = [
    'bg-blue-50', 'bg-emerald-50', 'bg-amber-50', 'bg-rose-50',
    'bg-violet-50', 'bg-cyan-50', 'bg-orange-50', 'bg-pink-50',
    'bg-teal-50', 'bg-indigo-50'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (detailId) {
      fetchDetail(detailId);
    } else {
      setDetailMixture(null);
      setDetailHistory([]);
    }
  }, [detailId]);

  const fetchData = async () => {
    try {
      const [mixRes, matRes] = await Promise.all([
        apiFetch('/mixtures'),
        apiFetch('/materials')
      ]);

      if (mixRes.ok) setMixtures(await mixRes.json());
      if (matRes.ok) setMaterials(await matRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (mixtureId) => {
    setDetailLoading(true);
    try {
      const [mixRes, histRes] = await Promise.all([
        apiFetch(`/mixtures/${mixtureId}`),
        apiFetch(`/mixtures/${mixtureId}/history`)
      ]);

      if (mixRes.ok) setDetailMixture(await mixRes.json());
      if (histRes.ok) setDetailHistory(await histRes.json());
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Create/Edit Modal ──────────────────────────────────

  const openCreateModal = () => {
    setModalMode('create');
    setCurrentMixtureId(null);
    setFormName('');
    setFormUnit('Kg');
    setFormDescription('');
    setFormComponents([{ material_id: '', percentage: '' }]);
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const openEditModal = (mixture) => {
    setModalMode('edit');
    setCurrentMixtureId(mixture.id);
    setFormName(mixture.name);
    setFormUnit(mixture.unit);
    setFormDescription(mixture.description || '');
    setFormComponents(
      mixture.components.map(c => ({
        material_id: String(c.material_id),
        percentage: String(c.percentage)
      }))
    );
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError('');
    setFormSuccess('');
  };

  const addComponent = () => {
    setFormComponents([...formComponents, { material_id: '', percentage: '' }]);
  };

  const removeComponent = (index) => {
    if (formComponents.length <= 1) return;
    setFormComponents(formComponents.filter((_, i) => i !== index));
  };

  const updateComponent = (index, field, value) => {
    const updated = [...formComponents];
    updated[index] = { ...updated[index], [field]: value };
    setFormComponents(updated);
  };

  const totalPercentage = formComponents.reduce((sum, c) => sum + (parseFloat(c.percentage) || 0), 0);

  const handleSaveMixture = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    if (!formName || !formUnit) {
      setFormError('Nombre y unidad son obligatorios.');
      setSubmitting(false);
      return;
    }

    const validComponents = formComponents.filter(c => c.material_id && c.percentage);
    if (validComponents.length === 0) {
      setFormError('Agrega al menos un componente.');
      setSubmitting(false);
      return;
    }

    if (Math.abs(totalPercentage - 100) > 0.01) {
      setFormError(`Los porcentajes deben sumar 100%. Suma actual: ${totalPercentage.toFixed(2)}%`);
      setSubmitting(false);
      return;
    }

    const ids = validComponents.map(c => c.material_id);
    if (new Set(ids).size !== ids.length) {
      setFormError('No puedes agregar el mismo material más de una vez.');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: formName,
      unit: formUnit,
      description: formDescription,
      components: validComponents.map(c => ({
        material_id: parseInt(c.material_id),
        percentage: parseFloat(c.percentage)
      }))
    };

    try {
      const url = modalMode === 'create' ? '/mixtures' : `/mixtures/${currentMixtureId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setFormSuccess(data.message);
      await fetchData();
      if (detailId) await fetchDetail(detailId);
      setTimeout(() => closeModal(), 1200);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Usage (Shipment) Modal ──────────────────────────────

  const openUsageModal = (mixture) => {
    setUsageMixture(mixture);
    setUsageQuantity('');
    setUsageDate(new Date().toISOString().split('T')[0]);
    setUsageResponsible('');
    setUsageNotes('');
    setUsageError('');
    setUsageSuccess('');
    setIsUsageModalOpen(true);
  };

  const closeUsageModal = () => {
    setIsUsageModalOpen(false);
    setUsageError('');
    setUsageSuccess('');
  };

  const getDeductionPreview = () => {
    if (!usageMixture || !usageQuantity) return [];
    const qty = parseFloat(usageQuantity);
    if (isNaN(qty) || qty <= 0) return [];

    return usageMixture.components.map(comp => {
      const required = parseFloat((qty * (comp.percentage / 100)).toFixed(2));
      const stock = parseFloat(comp.current_stock);
      return { ...comp, required, sufficient: stock >= required };
    });
  };

  const handleRegisterUsage = async (e) => {
    e.preventDefault();
    setUsageError('');
    setUsageSuccess('');
    setUsageSubmitting(true);

    if (!usageQuantity || !usageDate || !usageResponsible) {
      setUsageError('Cantidad, fecha y responsable son obligatorios.');
      setUsageSubmitting(false);
      return;
    }

    try {
      const res = await apiFetch(`/mixtures/${usageMixture.id}/usage`, {
        method: 'POST',
        body: JSON.stringify({
          total_quantity: parseFloat(usageQuantity),
          usage_date: usageDate,
          responsible: usageResponsible,
          notes: usageNotes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setUsageSuccess(data.message);
      await fetchData();
      if (detailId) await fetchDetail(detailId);
      setTimeout(() => closeUsageModal(), 1500);
    } catch (err) {
      setUsageError(err.message);
    } finally {
      setUsageSubmitting(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────

  const handleDelete = async (id) => {
    try {
      const res = await apiFetch(`/mixtures/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDeleteConfirmId(null);
      if (detailId === String(id)) router.push('/mixtures');
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // ─── Filter ──────────────────────────────────────────────

  const filteredMixtures = mixtures.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ═════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═════════════════════════════════════════════════════════

  if (detailId) {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-600"></div>
        </div>
      );
    }

    if (!detailMixture) {
      return (
        <div className="text-center py-16">
          <FlaskConical className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Mezcla no encontrada</p>
          <button onClick={() => router.push('/mixtures')} className="text-violet-600 text-sm font-bold mt-2 hover:underline">
            ← Volver a Mezclas
          </button>
        </div>
      );
    }

    const totalUsed = detailHistory.reduce((sum, h) => sum + parseFloat(h.total_quantity), 0);

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/mixtures')}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{detailMixture.name}</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Unidad: {detailMixture.unit} • {detailMixture.components?.length || 0} componentes
                {detailMixture.creator_name && <span> • Creada por {detailMixture.creator_name}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => openUsageModal(detailMixture)}
            className="flex items-center justify-center px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
          >
            <Send className="mr-2 h-4 w-4" />
            Registrar Envío
          </button>
        </div>

        {detailMixture.description && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-sm text-slate-600">{detailMixture.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Components */}
          <div className="lg:col-span-1 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
                <p className="text-2xl font-black text-violet-600">{detailMixture.components?.length || 0}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Componentes</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
                <p className="text-2xl font-black text-emerald-600">{totalUsed.toFixed(2)}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Total Enviado ({detailMixture.unit})</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <Package className="h-4 w-4 mr-2 text-slate-500" />
                  Composición
                </h3>
              </div>
              <div className="px-5 pt-4">
                <div className="flex rounded-lg overflow-hidden h-4">
                  {(detailMixture.components || []).map((comp, i) => (
                    <div
                      key={comp.id}
                      className={`${componentColors[i % componentColors.length]} transition-all`}
                      style={{ width: `${comp.percentage}%` }}
                      title={`${comp.material_name}: ${comp.percentage}%`}
                    />
                  ))}
                </div>
              </div>
              <div className="p-5 space-y-3">
                {(detailMixture.components || []).map((comp, i) => (
                  <div key={comp.id} className={`${componentBgColors[i % componentBgColors.length]} rounded-xl p-3.5`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <div className={`h-3 w-3 rounded-full ${componentColors[i % componentColors.length]} mr-2`} />
                        <span className="text-sm font-bold text-slate-900">{comp.material_name}</span>
                      </div>
                      <span className={`text-sm font-black ${componentTextColors[i % componentTextColors.length]}`}>
                        {parseFloat(comp.percentage)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 ml-5">
                      <span>Stock: <span className="font-semibold text-slate-700">{parseFloat(comp.current_stock)} {comp.material_unit}</span></span>
                      {parseFloat(comp.current_stock) <= 0 && (
                        <span className="text-rose-600 font-semibold flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-0.5" /> Sin stock
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center">
                <History className="h-5 w-5 text-slate-500 mr-2.5" />
                <h3 className="text-sm font-bold text-slate-900">Historial de Envíos</h3>
                <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                  {detailHistory.length} registros
                </span>
              </div>
              <div className="p-5 max-h-[600px] overflow-y-auto">
                {detailHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <Send className="h-8 w-8 mb-2 text-slate-300" />
                    <p className="text-sm font-medium">No se han registrado envíos</p>
                    <p className="text-xs mt-1">Usa el botón &ldquo;Registrar Envío&rdquo; para comenzar.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailHistory.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100/50 transition-colors">
                        <div className="flex items-center min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mr-3">
                            <Send className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">
                              {parseFloat(entry.total_quantity)} {entry.mixture_unit}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              Responsable: <span className="font-semibold text-slate-700">{entry.responsible}</span>
                            </p>
                            {entry.notes && (
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">📝 {entry.notes}</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">
                              Registrado por: {entry.user_name || 'Desconocido'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-[10px] text-slate-400 flex items-center justify-end font-medium">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(entry.usage_date).toISOString().split('T')[0]}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Usage Modal (reused) */}
        {renderUsageModal()}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════
  // LIST VIEW (default)
  // ═════════════════════════════════════════════════════════

  function renderUsageModal() {
    if (!isUsageModalOpen || !usageMixture) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Registrar Envío</h2>
              <p className="text-xs text-slate-400 mt-0.5">{usageMixture.name}</p>
            </div>
            <button onClick={closeUsageModal} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleRegisterUsage} className="p-6 space-y-5">
            {usageError && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold">
                {usageError}
              </div>
            )}
            {usageSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold">
                {usageSuccess}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Cantidad Total ({usageMixture.unit})
                </label>
                <input
                  type="number" min="0.01" step="0.01" required placeholder="Ej. 100"
                  value={usageQuantity}
                  onChange={(e) => setUsageQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-600 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fecha</label>
                <input
                  type="date" required value={usageDate}
                  onChange={(e) => setUsageDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-600 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Responsable</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text" required placeholder="Ej. Ing. Rafael Gómez"
                  value={usageResponsible}
                  onChange={(e) => setUsageResponsible(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-600 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
              <textarea
                placeholder="Observaciones..." value={usageNotes}
                onChange={(e) => setUsageNotes(e.target.value)} rows={2}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-600 transition-all resize-none"
              />
            </div>
            {/* Deduction Preview */}
            {usageQuantity && parseFloat(usageQuantity) > 0 && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center">
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                  Preview de Descuento
                </h4>
                <div className="space-y-2">
                  {getDeductionPreview().map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center">
                        <div className={`h-2 w-2 rounded-full ${componentColors[i % componentColors.length]} mr-2`} />
                        <span className="font-medium text-slate-700">{item.material_name}</span>
                        <span className="text-slate-400 ml-1">({item.percentage}%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black ${item.sufficient ? 'text-slate-900' : 'text-rose-600'}`}>
                          -{item.required} {item.material_unit}
                        </span>
                        {item.sufficient ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <div className="flex items-center">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                            <span className="text-[10px] text-rose-500 ml-1">
                              Disponible: {parseFloat(item.current_stock)} {item.material_unit}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {getDeductionPreview().some(d => !d.sufficient) && (
                  <div className="mt-3 p-2 bg-rose-50 border border-rose-100 rounded-lg text-[10px] text-rose-700 font-semibold flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1.5 shrink-0" />
                    Stock insuficiente en uno o más materiales. El envío no se puede procesar.
                  </div>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={usageSubmitting || (getDeductionPreview().some(d => !d.sufficient) && usageQuantity)}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-60 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center"
            >
              {usageSubmitting ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Confirmar Envío
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Mezclas y Compuestos</h1>
          <p className="text-slate-500 text-sm mt-1">Crea fórmulas de productos compuestos y registra envíos.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva Mezcla
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text" placeholder="Buscar mezclas..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10 transition-all"
        />
      </div>

      {/* Mixtures List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-600"></div>
        </div>
      ) : filteredMixtures.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <FlaskConical className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No se encontraron mezclas</p>
          <p className="text-slate-400 text-sm mt-1">Crea tu primera mezcla para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMixtures.map((mixture) => (
            <div key={mixture.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                      <FlaskConical className="h-5 w-5" />
                    </div>
                    <div className="ml-3 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{mixture.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Unidad: {mixture.unit} • {mixture.components?.length || 0} componentes</p>
                    </div>
                  </div>
                </div>
                {mixture.description && (
                  <p className="text-xs text-slate-500 mt-3 line-clamp-2">{mixture.description}</p>
                )}
              </div>

              {/* Component Percentage Bar */}
              <div className="px-5 pb-3">
                <div className="flex rounded-lg overflow-hidden h-3">
                  {(mixture.components || []).map((comp, i) => (
                    <div
                      key={comp.id}
                      className={`${componentColors[i % componentColors.length]} transition-all`}
                      style={{ width: `${comp.percentage}%` }}
                      title={`${comp.material_name}: ${comp.percentage}%`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {(mixture.components || []).map((comp, i) => (
                    <div key={comp.id} className="flex items-center text-[10px] text-slate-500">
                      <div className={`h-2 w-2 rounded-full ${componentColors[i % componentColors.length]} mr-1`} />
                      <span className="font-medium">{comp.material_name}</span>
                      <span className="ml-1 text-slate-400">{parseFloat(comp.percentage)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Actions */}
              <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => openUsageModal(mixture)}
                  className="flex items-center px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Enviar
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => router.push(`/mixtures?detail=${mixture.id}`)}
                    className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                    title="Ver detalle"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(mixture)}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {user?.role === 'admin' && (
                    <>
                      {deleteConfirmId === mixture.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(mixture.id)} className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold">Sí</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(mixture.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Create/Edit Modal ──────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {modalMode === 'create' ? 'Nueva Mezcla' : 'Editar Mezcla'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveMixture} className="p-6 space-y-5">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold">{formError}</div>
              )}
              {formSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold">{formSuccess}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nombre del Producto</label>
                  <input
                    type="text" required placeholder="Ej. Concreto f'c 200"
                    value={formName} onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-600 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Unidad de Medida</label>
                  <select
                    value={formUnit} onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-600 transition-all"
                  >
                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Descripción (opcional)</label>
                <textarea
                  placeholder="Ej. Mezcla para cimentación..."
                  value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-600 transition-all resize-none"
                />
              </div>
              {/* Components */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Componentes</label>
                  <button type="button" onClick={addComponent} className="flex items-center text-xs font-bold text-violet-600 hover:text-violet-500 transition-colors">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Agregar Material
                  </button>
                </div>
                <div className="space-y-3">
                  {formComponents.map((comp, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex-1">
                        <select
                          value={comp.material_id} onChange={(e) => updateComponent(index, 'material_id', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-violet-600 transition-all"
                        >
                          <option value="">-- Material --</option>
                          {materials.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({parseFloat(m.current_stock)} {m.unit})</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28 shrink-0">
                        <div className="relative">
                          <input
                            type="number" min="0.01" max="100" step="0.01" placeholder="0.00"
                            value={comp.percentage} onChange={(e) => updateComponent(index, 'percentage', e.target.value)}
                            className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-600 transition-all"
                          />
                          <Percent className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        </div>
                      </div>
                      <button
                        type="button" onClick={() => removeComponent(index)}
                        disabled={formComponents.length <= 1}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Percentage Indicator */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-500">Porcentaje Total</span>
                    <span className={`font-black ${Math.abs(totalPercentage - 100) <= 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {totalPercentage.toFixed(2)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        Math.abs(totalPercentage - 100) <= 0.01 ? 'bg-emerald-500' : totalPercentage > 100 ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                    />
                  </div>
                  {Math.abs(totalPercentage - 100) > 0.01 && (
                    <p className="text-[10px] text-rose-500 font-medium mt-1 flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {totalPercentage < 100
                        ? `Faltan ${(100 - totalPercentage).toFixed(2)}% para completar`
                        : `Excede por ${(totalPercentage - 100).toFixed(2)}%`
                      }
                    </p>
                  )}
                </div>
              </div>
              <button
                type="submit" disabled={submitting}
                className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center"
              >
                {submitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : modalMode === 'create' ? 'Crear Mezcla' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Usage Modal (shared) */}
      {renderUsageModal()}
    </div>
  );
}

export default function MixturesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-600"></div>
      </div>
    }>
      <MixturesContent />
    </Suspense>
  );
}
