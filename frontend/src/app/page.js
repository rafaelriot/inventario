'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../utils/api';
import {
  Boxes,
  AlertTriangle,
  ArrowDownRight,
  Package,
  FlaskConical,
  DollarSign,
  TrendingDown,
  FolderKanban,
  Truck,
  Search,
  CalendarDays,
  FilterX,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ClipboardList,
  Activity
} from 'lucide-react';
import Link from 'next/link';

// ─── Date helpers ─────────────────────────────────────────────
function toISODate(d) {
  return d.toISOString().split('T')[0];
}

function getPresetDates(preset) {
  const now = new Date();
  const today = toISODate(now);
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay()); // Sunday start
      return { start: toISODate(d), end: today };
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toISODate(d), end: today };
    }
    case 'quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { start: toISODate(d), end: today };
    }
    default:
      return { start: '', end: '' };
  }
}

// ─── Number formatting ───────────────────────────────────────
function fmtMoney(n) {
  return `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(n) {
  return (n || 0).toLocaleString('es-MX');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    normal: { label: 'Normal', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    low: { label: 'Bajo', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    out: { label: 'Agotado', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' }
  };
  const c = config[status] || config.normal;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function Dashboard() {
  const router = useRouter();

  // ─── Filter state ─────────────────────────────────────────
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState('');

  // ─── Data state ───────────────────────────────────────────
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── UI state ─────────────────────────────────────────────
  const [inventorySearch, setInventorySearch] = useState('');
  const [consumptionSearch, setConsumptionSearch] = useState('');
  const [showAllInventory, setShowAllInventory] = useState(false);
  const [shipmentsExpanded, setShipmentsExpanded] = useState(true);
  const [consumptionExpanded, setConsumptionExpanded] = useState(true);

  // ─── Initial load: fetch project list ─────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/projects');
        if (res.ok) setProjects(await res.json());
      } catch (e) {
        console.error('Error loading projects:', e);
      }
    })();
  }, []);

  // ─── Fetch dashboard data on filter change ────────────────
  useEffect(() => {
    fetchDashboard();
  }, [selectedProjectId, dateFrom, dateTo]);

  const fetchDashboard = async () => {
    if (data) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedProjectId) params.set('project_id', selectedProjectId);
      if (dateFrom) params.set('start_date', dateFrom);
      if (dateTo) params.set('end_date', dateTo);

      const res = await apiFetch(`/transactions/advanced-dashboard?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      } else if (res.status === 404) {
        // Fallback: endpoint not deployed yet, use legacy endpoints
        await fetchLegacyDashboard();
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      // Also try fallback on network errors
      try { await fetchLegacyDashboard(); } catch (e2) { console.error('Legacy fallback also failed:', e2); }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fallback: assemble dashboard data from legacy endpoints
  const fetchLegacyDashboard = async () => {
    const [sumRes, matRes, histRes] = await Promise.all([
      selectedProjectId
        ? apiFetch(`/transactions/project-summary/${selectedProjectId}`)
        : apiFetch('/transactions/dashboard-summary'),
      apiFetch('/materials'),
      apiFetch('/transactions/history')
    ]);

    const materials = matRes.ok ? await matRes.json() : [];
    const history = histRes.ok ? await histRes.json() : [];

    // Build inventory from materials
    const inventory = materials.map(m => {
      const stock = parseFloat(m.current_stock);
      const min = parseFloat(m.min_stock);
      let status = 'normal';
      if (stock === 0) status = 'out';
      else if (stock <= min) status = 'low';
      return {
        id: m.id, name: m.name, unit: m.unit,
        current_stock: stock, min_stock: min,
        unit_price: parseFloat(m.unit_price),
        category: m.category || 'Otros',
        value: stock * parseFloat(m.unit_price),
        status
      };
    });

    if (selectedProjectId && sumRes.ok) {
      const ps = await sumRes.json();
      // Filter history for this project
      const projHistory = history.filter(tx => tx.project_name === ps.project_name && tx.type === 'gasto');

      setData({
        inventory,
        kpis: {
          total_materials: materials.length,
          low_stock: inventory.filter(m => m.status === 'low').length,
          out_of_stock: inventory.filter(m => m.status === 'out').length,
          total_valuation: inventory.reduce((s, m) => s + m.value, 0),
          total_usage_records: ps.total_usage_records || 0,
          distinct_materials_used: ps.total_materials_used || 0,
          estimated_cost: ps.estimated_cost || 0,
          total_shipments: ps.total_mixture_records || 0,
          total_mixture_quantity: 0
        },
        consumption: projHistory.map((tx, i) => ({
          id: i, quantity: tx.quantity, usage_date: tx.date,
          responsible: tx.details, material_name: tx.material_name,
          unit: tx.unit, unit_price: 0, line_cost: 0,
          project_name: tx.project_name, user_name: tx.user_name
        })),
        top_materials: (ps.top_materials || []).map(m => ({
          material_id: 0, name: m.name, unit: m.unit,
          total_qty: m.total_qty, total_cost: m.cost, record_count: 0
        })),
        shipments: [],
        project: { id: parseInt(selectedProjectId), name: ps.project_name, status: ps.project_status },
        filters: { project_id: selectedProjectId, start_date: dateFrom || null, end_date: dateTo || null }
      });
    } else if (sumRes.ok) {
      const gs = await sumRes.json();
      const gastos = history.filter(tx => tx.type === 'gasto');

      // Build top materials from history
      const matMap = {};
      gastos.forEach(tx => {
        if (!matMap[tx.material_name]) matMap[tx.material_name] = { name: tx.material_name, unit: tx.unit, total_qty: 0, total_cost: 0, record_count: 0 };
        matMap[tx.material_name].total_qty += parseFloat(tx.quantity);
        matMap[tx.material_name].record_count++;
      });
      const topMats = Object.values(matMap).sort((a, b) => b.total_qty - a.total_qty).slice(0, 15);

      setData({
        inventory,
        kpis: {
          total_materials: gs.total_materials || materials.length,
          low_stock: gs.low_stock || 0,
          out_of_stock: gs.out_of_stock || 0,
          total_valuation: gs.total_valuation || 0,
          total_usage_records: gs.total_usages || 0,
          distinct_materials_used: Object.keys(matMap).length,
          estimated_cost: 0,
          total_shipments: 0,
          total_mixture_quantity: 0
        },
        consumption: gastos.slice(0, 50).map((tx, i) => ({
          id: i, quantity: tx.quantity, usage_date: tx.date,
          responsible: tx.details, material_name: tx.material_name,
          unit: tx.unit, unit_price: 0, line_cost: 0,
          project_name: tx.project_name, user_name: tx.user_name
        })),
        top_materials: topMats,
        shipments: [],
        project: null,
        filters: { project_id: null, start_date: dateFrom || null, end_date: dateTo || null }
      });
    }
  };


  // ─── Preset handler ───────────────────────────────────────
  const applyPreset = (preset) => {
    if (activePreset === preset) {
      setActivePreset('');
      setDateFrom('');
      setDateTo('');
    } else {
      const { start, end } = getPresetDates(preset);
      setActivePreset(preset);
      setDateFrom(start);
      setDateTo(end);
    }
  };

  // ─── Clear all filters ────────────────────────────────────
  const clearFilters = () => {
    setSelectedProjectId('');
    setDateFrom('');
    setDateTo('');
    setActivePreset('');
  };

  const hasFilters = !!selectedProjectId || !!dateFrom || !!dateTo;
  const isProjectView = !!selectedProjectId && !!data?.project;

  // ─── Filtered inventory for search ────────────────────────
  const filteredInventory = useMemo(() => {
    if (!data?.inventory) return [];
    const q = inventorySearch.toLowerCase().trim();
    let items = data.inventory;
    if (q) {
      items = items.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    }
    // Sort: out first, then low, then normal
    const order = { out: 0, low: 1, normal: 2 };
    return items.sort((a, b) => order[a.status] - order[b.status]);
  }, [data?.inventory, inventorySearch]);

  const inventoryToShow = showAllInventory ? filteredInventory : filteredInventory.slice(0, 10);

  // ─── Filtered consumption for search ──────────────────────
  const filteredConsumption = useMemo(() => {
    if (!data?.top_materials) return [];
    const q = consumptionSearch.toLowerCase().trim();
    if (!q) return data.top_materials;
    return data.top_materials.filter(m =>
      m.name.toLowerCase().includes(q)
    );
  }, [data?.top_materials, consumptionSearch]);

  // ─── Loading skeleton ─────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-xl w-1/3" />
        <div className="h-16 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-100 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  // ─── KPI Cards definition ────────────────────────────────
  const kpi = data?.kpis || {};

  const globalKpiCards = [
    {
      title: 'Materiales en Inventario',
      value: fmtNum(kpi.total_materials),
      icon: Boxes,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgLight: 'bg-blue-50'
    },
    {
      title: 'Valoración del Almacén',
      value: fmtMoney(kpi.total_valuation),
      icon: DollarSign,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      bgLight: 'bg-emerald-50'
    },
    {
      title: 'Total de Envíos',
      value: fmtNum(kpi.total_shipments),
      subtitle: `${fmtNum(kpi.total_mixture_quantity)} unidades enviadas`,
      icon: Truck,
      color: 'bg-violet-500',
      textColor: 'text-violet-600',
      bgLight: 'bg-violet-50'
    },
    {
      title: 'Salidas de Material',
      value: fmtNum(kpi.total_usage_records),
      subtitle: `${fmtNum(kpi.distinct_materials_used)} materiales distintos`,
      icon: TrendingDown,
      color: 'bg-rose-500',
      textColor: 'text-rose-600',
      bgLight: 'bg-rose-50'
    },
    {
      title: 'Alertas de Stock',
      value: `${fmtNum(kpi.low_stock + kpi.out_of_stock)}`,
      subtitle: `${kpi.out_of_stock} agotados · ${kpi.low_stock} bajos`,
      icon: AlertTriangle,
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
      bgLight: 'bg-amber-50'
    }
  ];

  const projectKpiCards = [
    {
      title: 'Materiales Consumidos',
      value: fmtNum(kpi.distinct_materials_used),
      icon: Package,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgLight: 'bg-indigo-50'
    },
    {
      title: 'Salidas Registradas',
      value: fmtNum(kpi.total_usage_records),
      icon: TrendingDown,
      color: 'bg-rose-500',
      textColor: 'text-rose-600',
      bgLight: 'bg-rose-50'
    },
    {
      title: 'Envíos de Mezcla',
      value: fmtNum(kpi.total_shipments),
      subtitle: `${fmtNum(kpi.total_mixture_quantity)} unidades`,
      icon: Truck,
      color: 'bg-violet-500',
      textColor: 'text-violet-600',
      bgLight: 'bg-violet-50'
    },
    {
      title: 'Costo Estimado',
      value: fmtMoney(kpi.estimated_cost),
      icon: DollarSign,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      bgLight: 'bg-emerald-50'
    }
  ];

  const statCards = isProjectView ? projectKpiCards : globalKpiCards;

  // ─── Presets config ────────────────────────────────────────
  const presets = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Esta Semana' },
    { key: 'month', label: 'Este Mes' },
    { key: 'quarter', label: 'Último Trimestre' }
  ];

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ─── HEADER ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            {isProjectView ? 'Dashboard de Obra' : 'Dashboard General'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isProjectView
              ? `Proyecto: ${data.project.name}${data.project.location ? ` — ${data.project.location}` : ''}`
              : 'Inventario y consumo de materiales en todas las obras'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/transactions?action=compra"
            className="flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Comprar Material
          </Link>
          <Link
            href="/transactions?action=gasto"
            className="flex items-center px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Minus className="mr-2 h-4 w-4" />
            Registrar Gasto
          </Link>
        </div>
      </div>

      {/* ─── ZONA 1: FILTER BAR ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          {/* Project selector */}
          <div className="flex-1 min-w-0">
            <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <FolderKanban className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
              Proyecto / Obra
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all appearance-none cursor-pointer"
            >
              <option value="">🏠 Todas las Obras — Vista Global</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  🏗️ {p.name}{p.location ? ` — ${p.location}` : ''} ({p.status === 'active' ? 'Activo' : p.status === 'paused' ? 'Pausado' : 'Completado'})
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setActivePreset(''); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setActivePreset(''); }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all"
              />
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5">
              {presets.map(p => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activePreset === p.key
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center px-3 py-2.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
              >
                <FilterX className="h-3.5 w-3.5 mr-1" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Refreshing indicator */}
        {refreshing && (
          <div className="mt-3 flex items-center text-xs text-indigo-600 font-medium">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-indigo-600 mr-2" />
            Actualizando datos...
          </div>
        )}
      </div>

      {/* ─── ZONA 2: KPI CARDS ───────────────────────────── */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isProjectView ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-4`}>
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className={`h-11 w-11 rounded-xl ${card.bgLight} ${card.textColor} flex items-center justify-center`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-3">{card.value}</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1">{card.title}</p>
              {card.subtitle && (
                <p className="text-[11px] text-slate-400 mt-0.5">{card.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── ZONA 3: DATA PANELS ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ─── Panel: Inventario General ───────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Inventario General</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700">
                  {filteredInventory.filter(m => m.status === 'normal').length} ok
                </span>
                <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700">
                  {filteredInventory.filter(m => m.status === 'low').length} bajo
                </span>
                <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-rose-50 text-rose-700">
                  {filteredInventory.filter(m => m.status === 'out').length} agotado
                </span>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar material o categoría..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Material</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase text-slate-400">Stock</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase text-slate-400">Mínimo</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-bold uppercase text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody>
                {inventoryToShow.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-sm text-slate-400">
                      Sin resultados
                    </td>
                  </tr>
                ) : (
                  inventoryToShow.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-slate-900 text-sm">{m.name}</p>
                        <p className="text-[11px] text-slate-400">{m.category} · {m.unit}</p>
                      </td>
                      <td className="text-right py-2.5 px-3 font-bold text-slate-900">
                        {fmtNum(m.current_stock)}
                      </td>
                      <td className="text-right py-2.5 px-3 text-slate-500">
                        {fmtNum(m.min_stock)}
                      </td>
                      <td className="text-center py-2.5 px-3">
                        <StatusBadge status={m.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredInventory.length > 10 && (
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => setShowAllInventory(!showAllInventory)}
                className="w-full flex items-center justify-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-500 transition-colors py-1"
              >
                {showAllInventory ? (
                  <>Mostrar menos <ChevronUp className="h-3.5 w-3.5" /></>
                ) : (
                  <>Ver todos ({filteredInventory.length} materiales) <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ─── Panel: Consumo por Obra / Top Materials ─────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  {isProjectView ? 'Consumo de Materiales' : 'Top Materiales Consumidos'}
                </h2>
              </div>
              <button
                onClick={() => setConsumptionExpanded(!consumptionExpanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {consumptionExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar material consumido..."
                value={consumptionSearch}
                onChange={(e) => setConsumptionSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all"
              />
            </div>
          </div>

          {consumptionExpanded && (
            <div className="flex-1 overflow-auto max-h-[420px]">
              {filteredConsumption.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-10 w-10 text-slate-200 mb-3" />
                  <p className="text-sm font-medium text-slate-500">Sin consumo registrado</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {hasFilters ? 'Intenta ajustar los filtros o el término de búsqueda' : 'Registra salidas de material para ver el resumen'}
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {filteredConsumption.map((m, i) => {
                    const maxQty = data.top_materials[0]?.total_qty || 1;
                    const widthPct = Math.max(8, (m.total_qty / maxQty) * 100);
                    return (
                      <div key={m.material_id || i} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-bold text-slate-300 w-5 shrink-0 text-right">
                              {i + 1}.
                            </span>
                            <span className="text-sm font-semibold text-slate-900 truncate">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-bold text-slate-600">
                              {fmtNum(m.total_qty)} {m.unit}
                            </span>
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {fmtMoney(m.total_cost)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-7 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Panel: Registro de Envíos / Camiones ─────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-violet-600" />
              <h2 className="text-base font-bold text-slate-900">Registro de Envíos / Camiones</h2>
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-violet-50 text-violet-700">
                {data?.shipments?.length || 0} envíos
              </span>
            </div>
            <button
              onClick={() => setShipmentsExpanded(!shipmentsExpanded)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {shipmentsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {shipmentsExpanded && (
          <div className="overflow-auto max-h-[380px]">
            {(data?.shipments?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Truck className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-500">Sin envíos registrados</p>
                <p className="text-xs text-slate-400 mt-1">
                  {hasFilters ? 'Intenta ajustar los filtros' : 'Los envíos de mezcla aparecerán aquí'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Fecha</th>
                    <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Mezcla</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase text-slate-400">Cantidad</th>
                    <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Obra Destino</th>
                    <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Responsable</th>
                    <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shipments.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 text-slate-600 font-medium">{fmtDate(s.date)}</td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1">
                          <FlaskConical className="h-3.5 w-3.5 text-violet-500" />
                          <span className="font-semibold text-slate-900">{s.mixture_name}</span>
                        </span>
                      </td>
                      <td className="text-right py-2.5 px-3 font-bold text-violet-700">
                        {fmtNum(s.quantity)} {s.mixture_unit}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 text-indigo-600 font-medium text-xs">
                          <FolderKanban className="h-3 w-3" />
                          {s.project_name || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{s.responsible}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-xs max-w-[200px] truncate">{s.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ─── Panel: Actividad Reciente (Consumption detail) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-rose-600" />
              <h2 className="text-base font-bold text-slate-900">
                {isProjectView ? 'Detalle de Consumo' : 'Actividad de Salidas Reciente'}
              </h2>
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-rose-50 text-rose-700">
                {data?.consumption?.length || 0} registros
              </span>
            </div>
            <Link href="/transactions" className="text-xs font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
              Ver Historial Completo →
            </Link>
          </div>
        </div>

        <div className="overflow-auto max-h-[380px]">
          {(data?.consumption?.length || 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-500">Sin movimientos</p>
              <p className="text-xs text-slate-400 mt-1">
                {hasFilters ? 'Intenta ajustar los filtros' : 'Registra consumos para ver el detalle'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Fecha</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Material</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase text-slate-400">Cantidad</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-bold uppercase text-slate-400">Costo</th>
                  {!isProjectView && (
                    <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Obra</th>
                  )}
                  <th className="text-left py-2.5 px-4 text-[11px] font-bold uppercase text-slate-400">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {data.consumption.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4 text-slate-600 font-medium">{fmtDate(c.usage_date)}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-900">{c.material_name}</span>
                      <span className="ml-1.5 text-[11px] text-slate-400">{c.unit}</span>
                    </td>
                    <td className="text-right py-2.5 px-3 font-bold text-rose-600">
                      -{fmtNum(parseFloat(c.quantity))}
                    </td>
                    <td className="text-right py-2.5 px-3 text-emerald-600 font-semibold text-xs">
                      {fmtMoney(parseFloat(c.line_cost))}
                    </td>
                    {!isProjectView && (
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 text-indigo-600 font-medium text-xs">
                          <FolderKanban className="h-3 w-3" />
                          {c.project_name || '—'}
                        </span>
                      </td>
                    )}
                    <td className="py-2.5 px-4 text-slate-500 text-xs">{c.responsible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
