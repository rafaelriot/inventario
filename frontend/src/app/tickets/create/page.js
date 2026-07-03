'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../utils/api';
import QRCode from 'qrcode';
import { 
  FileText, 
  Truck, 
  User, 
  Calendar, 
  QrCode, 
  Download, 
  PlusCircle, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

// Self-contained component to render individual QR Code
function TicketQR({ token }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (token && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current, 
        token, 
        { 
          width: 140,
          margin: 1,
          color: {
            dark: '#1e293b',
            light: '#ffffff'
          }
        }, 
        (err) => {
          if (err) console.error('Error rendering QR Code:', err);
        }
      );
    }
  }, [token]);

  return <canvas ref={canvasRef} className="mx-auto" />;
}

export default function CreateTicket() {
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [quantity, setQuantity] = useState('');
  const [numTrucks, setNumTrucks] = useState('1');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // State for created tickets
  const [createdTickets, setCreatedTickets] = useState([]);
  const router = useRouter();

  // Load materials
  useEffect(() => {
    async function loadMaterials() {
      setLoading(true);
      try {
        const response = await apiFetch('/materials');
        if (response.ok) {
          const data = await response.json();
          setMaterials(data);
        } else {
          setError('Error al cargar la lista de materiales.');
        }
      } catch (err) {
        console.error(err);
        setError('Error de conexión al cargar materiales.');
      } finally {
        setLoading(false);
      }
    }
    loadMaterials();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMaterial || !quantity || !numTrucks) {
      setError('Todos los campos son obligatorios.');
      return;
    }
    
    setError('');
    setSubmitting(true);

    try {
      const response = await apiFetch('/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          material_id: selectedMaterial,
          quantity: parseFloat(quantity),
          num_trucks: parseInt(numTrucks)
        })
      });

      const data = await response.json();

      if (response.ok) {
        setCreatedTickets(data.tickets);
      } else {
        setError(data.message || 'Error al generar los tickets.');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al intentar generar los tickets.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickQuantity = (value) => {
    setQuantity(value.toString());
  };

  // Reset form to generate another ticket
  const handleReset = () => {
    setCreatedTickets([]);
    setSelectedMaterial('');
    setQuantity('');
    setNumTrucks('1');
    setError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Get selected material units for display
  const materialUnit = materials.find(m => m.id === parseInt(selectedMaterial))?.unit || 'm³';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Carga en Volteo (Despacho)
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Genera tickets digitales de despacho con código QR para autorizar la salida de material hacia la obra.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {createdTickets.length === 0 ? (
        /* CREATION FORM */
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 block">
              1. Selecciona el Material
            </label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              required
            >
              <option value="">Seleccionar material disponible...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id} disabled={parseFloat(m.current_stock) <= 0}>
                  {m.name} - ({parseFloat(m.current_stock)} {m.unit} disponibles)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700 block">
              2. Cantidad a Cargar por Volteo ({materialUnit})
            </label>
            
            {/* Quick selectors for volumetric materials (e.g. sand, gravel) */}
            <div className="grid grid-cols-3 gap-2">
              {[7, 14, 28].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickQuantity(amt)}
                  className={`py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                    quantity === amt.toString()
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {amt} {materialUnit}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="Ingresar cantidad manual..."
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                required
              />
              <span className="absolute right-4 top-3 text-sm font-semibold text-slate-400">
                {materialUnit}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 block">
              3. Cantidad de Volteos (Viajes)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-slate-400">
                <Truck className="h-5 w-5" />
              </span>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Ej. 1"
                value={numTrucks}
                onChange={(e) => setNumTrucks(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center py-3.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 disabled:bg-blue-300 transition-all shadow-sm cursor-pointer"
          >
            {submitting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              <>
                <PlusCircle className="mr-2 h-5 w-5" />
                Generar Tickets y QR
              </>
            )}
          </button>
        </form>
      ) : (
        /* SUCCESS TICKETS VIEW */
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex items-center gap-4 text-emerald-800">
            <CheckCircle className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-base">¡{createdTickets.length} Tickets Generados Exitosamente!</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                El material ha sido reservado. Se descontará del inventario a medida que el supervisor en obra escanee cada código QR de forma individual.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/tickets/print/pdf?ids=${createdTickets.map(t => t.id).join(',')}&token=${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`}
              download
              className="flex items-center justify-center py-3.5 px-6 bg-slate-950 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
            >
              <Download className="mr-2 h-5 w-5" />
              Imprimir Todos los Tickets (PDF en Lote)
            </a>
          </div>

          {/* Grid of created tickets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {createdTickets.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col justify-between">
                {/* Ticket Header */}
                <div className="bg-slate-900 p-4 text-white text-center">
                  <h2 className="text-sm font-extrabold tracking-wide uppercase">Ticket de Despacho</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5 uppercase font-semibold">Folio: TK-{String(t.id).padStart(5, '0')}</p>
                </div>

                {/* Ticket Body */}
                <div className="p-5 space-y-4 text-slate-700 flex-1">
                  <div className="space-y-2 border-b border-dashed border-slate-100 pb-4 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Material</span>
                      <span className="font-bold text-slate-900">{t.material_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Cantidad</span>
                      <span className="font-extrabold text-blue-600 text-sm">
                        {parseFloat(t.quantity).toFixed(2)} {t.material_unit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Vehículo</span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5 text-slate-400" />
                        {t.vehicle_info}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Autorizó</span>
                      <span className="font-bold text-slate-900">{t.authorized_by_name}</span>
                    </div>
                  </div>

                  {/* QR Container */}
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-1.5 border border-slate-100 rounded-xl bg-white shadow-xs">
                      <TicketQR token={t.qr_token} />
                    </div>
                    <p className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase flex items-center gap-0.5">
                      <QrCode className="h-2.5 w-2.5" />
                      QR Único: {t.qr_token.substring(0, 8)}...
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={handleReset}
              className="py-3 px-6 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              Generar Nueva Carga
            </button>
            <Link 
              href="/tickets" 
              className="py-3 px-6 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
            >
              Ir al Historial de Tickets
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
