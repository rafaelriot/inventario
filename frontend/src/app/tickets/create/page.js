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

export default function CreateTicket() {
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [quantity, setQuantity] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // State for created ticket
  const [createdTicket, setCreatedTicket] = useState(null);
  const canvasRef = useRef(null);
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

  // Draw QR code when ticket is created
  useEffect(() => {
    if (createdTicket?.qr_token && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current, 
        createdTicket.qr_token, 
        { 
          width: 220,
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
  }, [createdTicket]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMaterial || !quantity || !vehicleInfo) {
      setError('Todos los campos son obligatorios.');
      return;
    }
    
    setError('');
    setSubmitting(true);

    try {
      const response = await apiFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          material_id: selectedMaterial,
          quantity: parseFloat(quantity),
          vehicle_info: vehicleInfo
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Fetch created ticket details
        const ticketDetailRes = await apiFetch(`/tickets/token/${data.qr_token}`);
        if (ticketDetailRes.ok) {
          const ticketDetail = await ticketDetailRes.json();
          setCreatedTicket(ticketDetail);
        } else {
          setError('Ticket generado, pero hubo un problema al cargar los detalles.');
        }
      } else {
        setError(data.message || 'Error al generar el ticket.');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al intentar generar el ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickQuantity = (value) => {
    setQuantity(value.toString());
  };

  // Reset form to generate another ticket
  const handleReset = () => {
    setCreatedTicket(null);
    setSelectedMaterial('');
    setQuantity('');
    setVehicleInfo('');
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
          Genera un ticket digital de despacho con código QR para autorizar la salida de material hacia la obra.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!createdTicket ? (
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
              2. Cantidad a Cargar ({materialUnit})
            </label>
            
            {/* Quick selectors for volumetric materials (e.g. sand, gravel) */}
            <div className="grid grid-cols-3 gap-2">
              {[7, 14, 28].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickQuantity(amt)}
                  className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                    quantity === amt.toString()
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {amt} m³
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
              3. Identificación del Volteo / Vehículo
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-slate-400">
                <Truck className="h-5 w-5" />
              </span>
              <input
                type="text"
                placeholder="Ej. Volteo 7 - Placas: GY-4820 / Nro. Interno: V-02"
                value={vehicleInfo}
                onChange={(e) => setVehicleInfo(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center py-3.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 disabled:bg-blue-300 transition-all shadow-sm"
          >
            {submitting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              <>
                <PlusCircle className="mr-2 h-5 w-5" />
                Generar Ticket y QR
              </>
            )}
          </button>
        </form>
      ) : (
        /* SUCCESS TICKET VIEW */
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex items-center gap-4 text-emerald-800">
            <CheckCircle className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-base">¡Ticket Generado Exitosamente!</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                El material ha sido reservado. Se descontará del inventario cuando el supervisor en obra escanee el código QR.
              </p>
            </div>
          </div>

          {/* Ticket styling card */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-md overflow-hidden max-w-sm mx-auto">
            {/* Ticket Header */}
            <div className="bg-slate-900 p-5 text-white text-center">
              <h2 className="text-lg font-extrabold tracking-wide uppercase">Ticket de Despacho</h2>
              <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">Folio: TK-{String(createdTicket.id).padStart(5, '0')}</p>
            </div>

            {/* Ticket Body */}
            <div className="p-6 space-y-6 text-slate-700 bg-[radial-gradient(#f1f5f9_1.5px,transparent_1.5px)] [background-size:16px_16px]">
              <div className="space-y-3.5 border-b border-dashed border-slate-200 pb-5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-medium">Material</span>
                  <span className="font-bold text-slate-900">{createdTicket.material_name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-medium">Cantidad</span>
                  <span className="font-extrabold text-blue-600 text-base">
                    {parseFloat(createdTicket.quantity).toFixed(2)} {createdTicket.material_unit}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-medium">Vehículo</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-slate-400" />
                    {createdTicket.vehicle_info}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-medium">Autorizó</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="h-4 w-4 text-slate-400" />
                    {createdTicket.authorized_by_name}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-medium">Fecha Carga</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {new Date(createdTicket.created_at).toLocaleDateString()} {new Date(createdTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* QR Container */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-2 border border-slate-200 rounded-2xl bg-white shadow-sm">
                  <canvas ref={canvasRef}></canvas>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase flex items-center gap-1">
                  <QrCode className="h-3 w-3" />
                  Código de Validación QR Único
                </p>
              </div>
            </div>

            {/* Ticket Footer */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex gap-2">
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/tickets/${createdTicket.id}/pdf?token=${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`}
                download
                className="flex-1 flex items-center justify-center py-2.5 px-4 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm"
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
              >
                Nueva Carga
              </button>
            </div>
          </div>
          
          <div className="text-center">
            <Link href="/tickets" className="text-sm font-bold text-blue-600 hover:text-blue-500">
              Ir al Historial de Tickets
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
