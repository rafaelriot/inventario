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
  Minus
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [lowStockMaterials, setLowStockMaterials] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const [sumRes, matRes, histRes] = await Promise.all([
          apiFetch('/transactions/dashboard-summary'),
          apiFetch('/materials'),
          apiFetch('/transactions/history')
        ]);

        if (sumRes.ok && matRes.ok && histRes.ok) {
          const sumData = await sumRes.json();
          const matData = await matRes.json();
          const histData = await histRes.json();

          setSummary(sumData);
          // Filter materials with alert (low stock or out of stock)
          setLowStockMaterials(matData.filter(m => parseFloat(m.current_stock) <= parseFloat(m.min_stock)));
          setRecentTransactions(histData.slice(0, 5));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
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

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard de Obra</h1>
          <p className="text-slate-500 text-sm mt-1">Resumen del estado y existencias actuales de materiales.</p>
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
        {/* Critical Alerts panel */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Alertas de Stock</h2>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-600">
              {lowStockMaterials.length} Críticas
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] mt-4 space-y-3">
            {lowStockMaterials.length === 0 ? (
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
            )}
          </div>
        </div>

        {/* Recent Transactions list */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Actividad Reciente</h2>
            <Link href="/transactions" className="text-sm text-blue-600 hover:text-blue-500 font-semibold">
              Ver Historial
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {recentTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <ClipboardList className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-500">Sin movimientos</p>
                <p className="text-xs text-slate-400 mt-0.5">Registra compras o consumos para ver el historial.</p>
              </div>
            ) : (
              recentTransactions.map((tx, idx) => {
                const isPurchase = tx.type === 'compra';
                return (
                  <div key={idx} className="flex items-center justify-between py-2.5 last:pb-0 border-b border-slate-50 last:border-b-0">
                    <div className="flex items-center">
                      <div className={`h-9 w-9 rounded-xl ${isPurchase ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center mr-3.5`}>
                        {isPurchase ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{tx.material_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {isPurchase ? `Proveedor: ${tx.details}` : `Usado por: ${tx.details}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
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
