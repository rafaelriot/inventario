'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../utils/api';
import { 
  Boxes, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  ClipboardList,
  Activity,
  Plus,
  Minus,
  FolderKanban,
  Package,
  FlaskConical,
  DollarSign,
  TrendingDown
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [lowStockMaterials, setLowStockMaterials] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Project filter
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectSummary, setProjectSummary] = useState(null);
  const [projectLoading, setProjectLoading] = useState(false);

  useEffect(() => {
    fetchGlobalData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectData(selectedProjectId);
    } else {
      setProjectSummary(null);
    }
  }, [selectedProjectId]);

  const fetchGlobalData = async () => {
    try {
      const [sumRes, matRes, histRes, projRes] = await Promise.all([
        apiFetch('/transactions/dashboard-summary'),
        apiFetch('/materials'),
        apiFetch('/transactions/history'),
        apiFetch('/projects')
      ]);

      if (sumRes.ok && matRes.ok && histRes.ok) {
        const sumData = await sumRes.json();
        const matData = await matRes.json();
        const histData = await histRes.json();

        setSummary(sumData);
        setLowStockMaterials(matData.filter(m => parseFloat(m.current_stock) <= parseFloat(m.min_stock)));
        setRecentTransactions(histData.slice(0, 5));
      }
      if (projRes.ok) {
        setProjects(await projRes.json());
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectData = async (projId) => {
    setProjectLoading(true);
    try {
      const [projSumRes, histRes] = await Promise.all([
        apiFetch(`/transactions/project-summary/${projId}`),
        apiFetch('/transactions/history')
      ]);

      if (projSumRes.ok) {
        setProjectSummary(await projSumRes.json());
      }
      if (histRes.ok) {
        const histData = await histRes.json();
        // Filter transactions for this project only
        const projName = projects.find(p => String(p.id) === String(projId))?.name;
        const filtered = histData.filter(tx => tx.project_name === projName);
        setRecentTransactions(filtered.slice(0, 8));
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setProjectLoading(false);
    }
  };

  const handleProjectChange = (e) => {
    const val = e.target.value;
    setSelectedProjectId(val);
    if (!val) {
      // Reset to global view
      fetchGlobalData();
    }
  };

  const isProjectView = !!selectedProjectId && !!projectSummary;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ─── Stat Cards ──────────────────────────────────────────
  const globalStatCards = [
    {
      title: 'Materiales Registrados',
      value: summary?.total_materials || 0,
      icon: Boxes,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Alertas de Stock Bajo',
      value: summary?.low_stock || 0,
      icon: AlertTriangle,
      color: 'bg-amber-500',
      textColor: 'text-amber-600'
    },
    {
      title: 'Agotados (Stock Cero)',
      value: summary?.out_of_stock || 0,
      icon: AlertTriangle,
      color: 'bg-rose-500',
      textColor: 'text-rose-600'
    },
    {
      title: 'Valoración del Almacén',
      value: `$${(summary?.total_valuation || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Activity,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600'
    }
  ];

  const projectStatCards = projectSummary ? [
    {
      title: 'Materiales Consumidos',
      value: projectSummary.total_materials_used || 0,
      icon: Package,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600'
    },
    {
      title: 'Salidas Registradas',
      value: projectSummary.total_usage_records || 0,
      icon: TrendingDown,
      color: 'bg-rose-500',
      textColor: 'text-rose-600'
    },
    {
      title: 'Envíos de Mezcla',
      value: projectSummary.total_mixture_records || 0,
      icon: FlaskConical,
      color: 'bg-violet-500',
      textColor: 'text-violet-600'
    },
    {
      title: 'Costo Estimado',
      value: `$${(projectSummary.estimated_cost || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600'
    }
  ] : [];

  const statCards = isProjectView ? projectStatCards : globalStatCards;

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard de Obra</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isProjectView 
              ? `Consumo del proyecto: ${projectSummary.project_name}` 
              : 'Resumen del estado y existencias actuales de materiales.'}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/transactions?action=compra"
            className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Comprar Material
          </Link>
          <Link
            href="/transactions?action=gasto"
            className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Minus className="mr-2 h-4 w-4" />
            Registrar Gasto
          </Link>
        </div>
      </div>

      {/* Project Filter */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center text-sm font-semibold text-slate-600">
          <FolderKanban className="h-4 w-4 mr-2 text-indigo-600" />
          Filtrar por Proyecto:
        </div>
        <div className="relative flex-1 max-w-md">
          <select
            value={selectedProjectId}
            onChange={handleProjectChange}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all appearance-none cursor-pointer"
          >
            <option value="">🏠 Vista General — Inventario Total</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                🏗️ {p.name}{p.location ? ` — ${p.location}` : ''} ({p.status === 'active' ? 'Activo' : p.status === 'paused' ? 'Pausado' : 'Completado'})
              </option>
            ))}
          </select>
        </div>
        {isProjectView && (
          <Link
            href={`/projects/${selectedProjectId}`}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-500 transition-colors shrink-0"
          >
            Ver Detalle Completo →
          </Link>
        )}
      </div>

      {/* Loading overlay for project switch */}
      {projectLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-sm text-slate-500 font-medium">Cargando datos del proyecto...</span>
        </div>
      )}

      {/* Grid of stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center">
              <div className={`h-12 w-12 rounded-xl ${card.color} bg-opacity-10 ${card.textColor} flex items-center justify-center mr-4`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left panel — Alerts or Top Materials */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              {isProjectView ? 'Top Materiales Consumidos' : 'Alertas de Stock'}
            </h2>
            {isProjectView ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-600">
                {projectSummary.top_materials?.length || 0} Materiales
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-600">
                {lowStockMaterials.length} Críticas
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] mt-4 space-y-3">
            {isProjectView ? (
              // ─── Project: Top Materials ─────────────────────
              projectSummary.top_materials?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Package className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-500">Sin consumo registrado</p>
                  <p className="text-xs text-slate-400 mt-0.5">Este proyecto aún no tiene salidas de material.</p>
                </div>
              ) : (
                projectSummary.top_materials.map((m, i) => (
                  <div key={i} className="p-3.5 rounded-xl border bg-indigo-50/50 border-indigo-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {m.total_qty} {m.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-emerald-100 text-emerald-700">
                        ${m.cost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
                        Costo
                      </p>
                    </div>
                  </div>
                ))
              )
            ) : (
              // ─── Global: Stock Alerts ─────────────────────
              lowStockMaterials.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Boxes className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-500">Todo en orden</p>
                  <p className="text-xs text-slate-400 mt-0.5">Todos los materiales tienen stock suficiente.</p>
                </div>
              ) : (
                lowStockMaterials.map((m) => {
                  const isOut = parseFloat(m.current_stock) === 0;
                  return (
                    <div key={m.id} className={`p-3.5 rounded-xl border ${isOut ? 'bg-rose-50/50 border-rose-100' : 'bg-amber-50/50 border-amber-100'} flex items-center justify-between`}>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Mínimo: {parseFloat(m.min_stock)} {m.unit}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md ${isOut ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {parseFloat(m.current_stock)} {m.unit}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
                          {isOut ? 'Agotado' : 'Bajo Stock'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Recent Transactions list */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              {isProjectView ? `Actividad del Proyecto` : 'Actividad Reciente'}
            </h2>
            <Link href="/transactions" className="text-sm text-blue-600 hover:text-blue-500 font-semibold">
              Ver Historial
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {recentTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <ClipboardList className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-500">
                  {isProjectView ? 'Sin movimientos en este proyecto' : 'Sin movimientos'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isProjectView ? 'Registra salidas de material asignadas a este proyecto.' : 'Registra compras o consumos para ver el historial.'}
                </p>
              </div>
            ) : (
              recentTransactions.map((tx, idx) => {
                const isPurchase = tx.type === 'compra';
                return (
                  <div key={idx} className="flex items-center justify-between py-2.5 last:pb-0 border-b border-slate-50 last:border-b-0">
                    <div className="flex items-center min-w-0">
                      <div className={`h-9 w-9 rounded-xl shrink-0 ${isPurchase ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center mr-3.5`}>
                        {isPurchase ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{tx.material_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {isPurchase ? `Proveedor: ${tx.details}` : `Usado por: ${tx.details}`}
                        </p>
                        {!isPurchase && tx.project_name && (
                          <p className="text-[10px] text-indigo-600 font-semibold mt-0.5 flex items-center">
                            <FolderKanban className="h-3 w-3 mr-0.5" />
                            {tx.project_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-sm font-bold ${isPurchase ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPurchase ? '+' : '-'}{parseFloat(tx.quantity)} {tx.unit}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(tx.date).toLocaleDateString()}
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
