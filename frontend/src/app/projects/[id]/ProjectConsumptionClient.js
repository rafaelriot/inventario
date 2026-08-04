'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '../../../utils/api';
import {
  FolderKanban,
  ArrowLeft,
  Calendar,
  Package,
  FlaskConical,
  User,
  Search,
  MapPin,
  CheckCircle2,
  PauseCircle,
  Clock,
  ArrowDownRight,
  Filter,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';

export default function ProjectConsumptionClient() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [consumption, setConsumption] = useState([]);
  const [totals, setTotals] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState(''); // '' | 'material' | 'mixture'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  useEffect(() => {
    if (projectId) fetchConsumption();
  }, [projectId]);

  const fetchConsumption = async (sDate, eDate) => {
    setLoading(true);
    try {
      let url = `/projects/${projectId}/consumption`;
      const queryParams = [];
      const sd = sDate !== undefined ? sDate : startDate;
      const ed = eDate !== undefined ? eDate : endDate;
      if (sd) queryParams.push(`start_date=${sd}`);
      if (ed) queryParams.push(`end_date=${ed}`);
      if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setConsumption(data.consumption);
        setTotals(data.totals);
      }
    } catch (err) {
      console.error('Error fetching consumption:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilter = () => {
    fetchConsumption(startDate, endDate);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    fetchConsumption('', '');
  };

  const statusConfig = {
    active: { label: 'Activo', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    paused: { label: 'Pausado', color: 'bg-amber-100 text-amber-700', icon: PauseCircle },
    completed: { label: 'Completado', color: 'bg-blue-100 text-blue-700', icon: Clock }
  };

  const filteredConsumption = consumption.filter(item => {
    const matchesSearch = item.material_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.responsible.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || item.source_type === filterType;
    return matchesSearch && matchesType;
  });

  // Build summary by material
  const materialSummary = {};
  filteredConsumption.forEach(item => {
    const key = `${item.material_name}__${item.unit}`;
    if (!materialSummary[key]) {
      materialSummary[key] = { name: item.material_name, unit: item.unit, total: 0, count: 0 };
    }
    materialSummary[key].total += parseFloat(item.quantity);
    materialSummary[key].count += 1;
  });
  const summaryList = Object.values(materialSummary).sort((a, b) => b.total - a.total);

  if (loading && !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <FolderKanban className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Proyecto no encontrado</p>
        <button onClick={() => router.push('/projects')} className="text-indigo-600 text-sm font-bold mt-2 hover:underline">
          ← Volver a Proyectos
        </button>
      </div>
    );
  }

  const cfg = statusConfig[project.status] || statusConfig.active;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/projects')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{project.name}</h1>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center shrink-0 ${cfg.color}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {cfg.label}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              {project.location && (
                <span className="flex items-center">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  {project.location}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {project.description && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm text-slate-600">{project.description}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
          <p className="text-2xl font-black text-indigo-600">{totals.total_records || 0}</p>
          <p className="text-xs text-slate-500 font-medium mt-1">Total Registros de Consumo</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
          <div className="flex items-center justify-center text-2xl font-black text-rose-600">
            <Package className="h-5 w-5 mr-2" />
            {totals.material_records || 0}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">Salidas de Material</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
          <div className="flex items-center justify-center text-2xl font-black text-violet-600">
            <FlaskConical className="h-5 w-5 mr-2" />
            {totals.mixture_records || 0}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">Envíos de Mezcla</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Material Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <Package className="h-4 w-4 mr-2 text-slate-500" />
                Resumen Acumulado por Material
              </h3>
            </div>
            <div className="p-5 max-h-[500px] overflow-y-auto">
              {summaryList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                  <Package className="h-8 w-8 mb-2 text-slate-300" />
                  <p className="text-sm font-medium">Sin consumo registrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {summaryList.map((item, i) => (
                    <div key={i} className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-100/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 truncate">{item.name}</span>
                        <span className="text-sm font-black text-rose-600 shrink-0 ml-2">
                          {item.total.toFixed(2)} {item.unit}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{item.count} registro(s)</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Detailed History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <ArrowDownRight className="h-5 w-5 text-slate-500 mr-2" />
                  Historial de Consumo del Proyecto
                  <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                    {filteredConsumption.length} registros
                  </span>
                </h3>

                {/* View Switcher: Table vs Cards */}
                <div className="flex items-center gap-2">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-600 transition-all"
                  >
                    <option value="">Todo</option>
                    <option value="material">Solo Materiales</option>
                    <option value="mixture">Solo Mezclas</option>
                  </select>

                  <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors ${
                        viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Vista de Tabla"
                    >
                      <TableIcon className="h-4 w-4 mr-1" />
                      Tabla
                    </button>
                    <button
                      onClick={() => setViewMode('cards')}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors ${
                        viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Vista de Tarjetas"
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      Cards
                    </button>
                  </div>
                </div>
              </div>

              {/* Date Filter */}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Desde</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Hasta</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 transition-all"
                  />
                </div>
                <button
                  onClick={handleDateFilter}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center"
                >
                  <Filter className="h-3 w-3 mr-1" />
                  Filtrar
                </button>
                {(startDate || endDate) && (
                  <button
                    onClick={clearDateFilter}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar material o responsable..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="p-5 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                </div>
              ) : filteredConsumption.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                  <Package className="h-8 w-8 mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No se encontraron consumos para este proyecto</p>
                  <p className="text-xs mt-1">Registra salidas de material asignadas a este proyecto.</p>
                </div>
              ) : viewMode === 'table' ? (

                /* ─── VISTA EN TABLA ────────────────────────────────── */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <th className="py-3 px-3">Fecha</th>
                        <th className="py-3 px-3">Tipo</th>
                        <th className="py-3 px-3">Material / Mezcla</th>
                        <th className="py-3 px-3 text-right">Cantidad Consumida</th>
                        <th className="py-3 px-3">Responsable</th>
                        <th className="py-3 px-3">Registrado Por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredConsumption.map((item, idx) => {
                        const isMixture = item.source_type === 'mixture';
                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-3 font-medium text-slate-500">
                              {new Date(item.usage_date).toISOString().split('T')[0]}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${isMixture ? 'bg-violet-50 text-violet-600' : 'bg-rose-50 text-rose-600'}`}>
                                {isMixture ? 'Mezcla' : 'Material'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-900">
                              {item.material_name}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-rose-600">
                              -{parseFloat(item.quantity).toFixed(2)} {item.unit}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700">
                              {item.responsible}
                            </td>
                            <td className="py-3 px-3 text-slate-400">
                              {item.user_name || 'Desconocido'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              ) : (

                /* ─── VISTA EN CARDS ────────────────────────────────── */
                <div className="space-y-3">
                  {filteredConsumption.map((item, idx) => {
                    const isMixture = item.source_type === 'mixture';
                    return (
                      <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100/50 transition-colors">
                        <div className="flex items-center min-w-0">
                          <div className={`h-9 w-9 rounded-xl shrink-0 ${isMixture ? 'bg-violet-100 text-violet-700' : 'bg-rose-100 text-rose-700'} flex items-center justify-center mr-3`}>
                            {isMixture ? <FlaskConical className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{item.material_name}</p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              Responsable: <span className="font-semibold text-slate-700">{item.responsible}</span>
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isMixture ? 'bg-violet-50 text-violet-600' : 'bg-rose-50 text-rose-600'}`}>
                                {isMixture ? 'Mezcla' : 'Material'}
                              </span>
                              {item.user_name && (
                                <span className="text-[10px] text-slate-400">
                                  por: {item.user_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-sm font-black text-rose-700">
                            -{parseFloat(item.quantity).toFixed(2)} {item.unit}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end font-medium">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(item.usage_date).toISOString().split('T')[0]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
