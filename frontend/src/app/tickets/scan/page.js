'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../utils/api';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  QrCode, 
  CheckCircle, 
  AlertTriangle, 
  Truck, 
  User, 
  Calendar,
  AlertCircle,
  FileText,
  Camera
} from 'lucide-react';
import Link from 'next/link';

export default function ScanTicket() {
  const [scanResult, setScanResult] = useState('');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Only initialize scanner if we don't have a ticket loaded
    if (ticket || success) return;

    const scanner = new Html5QrcodeScanner('reader', {
      fps: 5,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    });

    scanner.render(
      (decodedText) => {
        // Success
        setScanResult(decodedText);
        scanner.clear().then(() => {
          loadTicketData(decodedText);
        }).catch(err => {
          console.error("Error clearing scanner:", err);
          loadTicketData(decodedText);
        });
      },
      (error) => {
        // Scan errors can be frequent as it scans frames, ignore them
      }
    );

    return () => {
      scanner.clear().catch(err => console.log("Scanner cleanup error:", err));
    };
  }, [ticket, success]);

  const loadTicketData = async (token) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`/tickets/token/${token}`);
      const data = await response.json();

      if (response.ok) {
        setTicket(data);
      } else {
        setError(data.message || 'El código QR no pertenece a un ticket válido.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReception = async () => {
    if (!ticket) return;

    setValidating(true);
    setError('');
    try {
      const response = await apiFetch(`/tickets/token/${ticket.qr_token}/receive`, {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTicket(null);
      } else {
        setError(data.message || 'Error al validar el ticket.');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al validar el ticket.');
    } finally {
      setValidating(false);
    }
  };

  const handleResetScanner = () => {
    setTicket(null);
    setScanResult('');
    setSuccess(false);
    setError('');
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-2">
          <QrCode className="h-7 w-7 text-blue-600" />
          Recepción en Obra (Escanear)
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Escanea el código QR del camión de volteo para validar la entrega y descontar del inventario.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Error de validación</span>
            <span className="mt-0.5 block">{error}</span>
            <button 
              onClick={handleResetScanner} 
              className="mt-3 text-xs font-bold text-rose-800 underline block"
            >
              Reintentar escaneo
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm font-semibold text-slate-500">Cargando datos del ticket...</p>
        </div>
      )}

      {/* SCANNING MODE */}
      {!ticket && !loading && !success && !error && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-4 overflow-hidden">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
            <Camera className="h-5 w-5 text-slate-500 shrink-0" />
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Permite el acceso a la cámara si el navegador lo solicita. Apunta al código QR impreso o en la pantalla de otro celular.
            </p>
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
            <div id="reader" className="w-full"></div>
          </div>
        </div>
      )}

      {/* PREVIEW AND VALIDATE TICKET */}
      {ticket && !loading && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-lg overflow-hidden">
          <div className="bg-slate-900 p-5 text-white text-center flex items-center justify-between">
            <div className="text-left">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-[10px] font-bold text-slate-900 uppercase">
                {ticket.status === 'pending' ? 'Pendiente de Validación' : ticket.status}
              </span>
              <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">Folio: TK-{String(ticket.id).padStart(5, '0')}</p>
            </div>
            <Truck className="h-8 w-8 text-blue-400" />
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-3.5 border-b border-dashed border-slate-100 pb-5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Material</span>
                <span className="font-bold text-slate-900 text-base">{ticket.material_name}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Cantidad a Recibir</span>
                <span className="font-extrabold text-blue-600 text-lg">
                  {parseFloat(ticket.quantity).toFixed(2)} {ticket.material_unit}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Vehículo</span>
                <span className="font-bold text-slate-900">{ticket.vehicle_info}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Despachó (Almacén)</span>
                <span className="font-bold text-slate-900">{ticket.authorized_by_name}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Fecha Carga</span>
                <span className="font-bold text-slate-900">
                  {new Date(ticket.created_at).toLocaleDateString()} {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {ticket.status === 'pending' ? (
              <div className="space-y-3">
                <button
                  onClick={handleConfirmReception}
                  disabled={validating}
                  className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 disabled:bg-emerald-300 transition-all shadow-sm flex items-center justify-center"
                >
                  {validating ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Confirmar y Recibir Carga
                    </>
                  )}
                </button>
                <button
                  onClick={handleResetScanner}
                  className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  Cancelar Escaneo
                </button>
              </div>
            ) : (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-rose-800">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold">Este ticket no puede ser procesado.</p>
                  <p className="mt-1">
                    El estado actual es <strong>{ticket.status === 'received' ? 'ENTREGADO' : 'CANCELADO'}</strong>.
                  </p>
                  <button
                    onClick={handleResetScanner}
                    className="mt-3 font-bold text-rose-900 underline block"
                  >
                    Volver a Escanear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUCCESS SCREEN */}
      {success && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-lg text-center space-y-6">
          <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle className="h-10 w-10" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">¡Recepción Exitosa!</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              El ticket ha sido validado, el material ha ingresado a la obra y se ha descontado correctamente del inventario.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={handleResetScanner}
              className="py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition-all shadow-sm"
            >
              Escanear Otro Volteo
            </button>
            <Link
              href="/tickets"
              className="py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all block text-center"
            >
              Ver Historial de Tickets
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
