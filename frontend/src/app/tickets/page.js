'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { 
  FileText, 
  QrCode, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Truck,
  Plus
} from 'lucide-react';
import Link from 'next/link';

export default function TicketsHistory() {
  const [tickets, setTickets] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  // Filters
  const [searchVehicle, setSearchVehicle] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, materialsRes] = await Promise.all([
        apiFetch('/tickets'),
        apiFetch('/materials')
      ]);

      if (ticketsRes.ok && materialsRes.ok) {
        const ticketsData = await ticketsRes.json();
        const materialsData = await materialsRes.json();
        setTickets(ticketsData);
        setMaterials(materialsData);
      } else {
        setError('Error al obtener los datos de la base de datos.');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al cargar el historial.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelTicket = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas cancelar este ticket de despacho?')) return;

    try {
      const response = await apiFetch(`/tickets/${id}/cancel`, {
        method: 'POST'
      });

      if (response.ok) {
        // Reload list
        loadData();
      } else {
        const data = await response.json();
        alert(data.message || 'Error al cancelar el ticket.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al intentar cancelar.');
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const folioStr = `TK-${String(t.id).padStart(5, '0')}`;
    const matchesSearch = 
      t.vehicle_info.toLowerCase().includes(searchVehicle.toLowerCase()) ||
      folioStr.toLowerCase().includes(searchVehicle.toLowerCase()) ||
      t.id.toString().includes(searchVehicle.trim());
      
    const matchesMaterial = filterMaterial === '' || t.material_name === filterMaterial;
    const matchesStatus = filterStatus === '' || t.status === filterStatus;
    return matchesSearch && matchesMaterial && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Historial de Tickets QR</h1>
          <p className="text-slate-500 text-sm mt-1">Control y trazabilidad de despachos en volteo (Carga y Recepción).</p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/tickets/create"
            className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors shadow-sm"
          >
            <Plus className="mr-1.5 h-4.5 w-4.5" />
            Nueva Carga (Despacho)
          </Link>
          <Link
            href="/tickets/scan"
            className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-slate-950 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            <QrCode className="mr-1.5 h-4.5 w-4.5" />
            Escanear Recepción
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por folio o vehículo/volteo..."
            value={searchVehicle}
            onChange={(e) => setSearchVehicle(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:w-2/5">
          <select
            value={filterMaterial}
            onChange={(e) => setFilterMaterial(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="">Todos los materiales</option>
            {materials.map((m, idx) => (
              <option key={idx} value={m.name}>{m.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendientes en Ruta</option>
            <option value="received">Entregados en Obra</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
      </div>

      {/* Table view */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="py-4 px-6">Ticket / Folio</th>
                <th className="py-4 px-6">Material</th>
                <th className="py-4 px-6 text-right">Cantidad</th>
                <th className="py-4 px-6">Vehículo</th>
                <th className="py-4 px-6">Despachó (Fecha)</th>
                <th className="py-4 px-6">Estado</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    No se encontraron tickets registrados.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const dateFormatted = new Date(t.created_at).toLocaleDateString();
                  const timeFormatted = new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        TK-{String(t.id).padStart(5, '0')}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-800">
                        {t.material_name}
                      </td>
                      <td className="py-4 px-6 text-right font-extrabold text-slate-900">
                        {parseFloat(t.quantity).toFixed(2)} <span className="text-xs font-medium text-slate-400">{t.material_unit}</span>
                      </td>
                      <td className="py-4 px-6 font-medium flex items-center gap-1.5 mt-0.5">
                        <Truck className="h-4 w-4 text-slate-400" />
                        {t.vehicle_info}
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-800">{t.authorized_by_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{dateFormatted} {timeFormatted}</p>
                      </td>
                      <td className="py-4 px-6">
                        {t.status === 'received' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Entregado
                          </span>
                        ) : t.status === 'cancelled' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-600">
                            <XCircle className="h-3.5 w-3.5" />
                            Cancelado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-600">
                            <Clock className="h-3.5 w-3.5" />
                            En Ruta
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/tickets/${t.id}/pdf?token=${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`}
                          download
                          title="Descargar Ticket PDF"
                          className="inline-flex p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all shadow-sm"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        
                        {t.status === 'pending' && (
                          <button
                            onClick={() => handleCancelTicket(t.id)}
                            title="Cancelar Ticket"
                            className="inline-flex p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
