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
  Camera,
  Clock,
  WifiOff
} from 'lucide-react';
import Link from 'next/link';

export default function ScanTicket() {
  const [scanResult, setScanResult] = useState('');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [truckNumber, setTruckNumber] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  // Offline status & queue
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const queue = JSON.parse(localStorage.getItem('offline_scans_queue') || '[]');
      setOfflineQueue(queue);

      const handleOnline = () => {
        setIsOnline(true);
        syncOfflineQueue();
      };
      const handleOffline = () => {
        setIsOnline(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('offline_scans_queue') || '[]');
    if (queue.length === 0) return;
    
    setSyncing(true);
    try {
      const response = await apiFetch('/tickets/bulk-receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scans: queue })
      });
      
      const data = await response.json();
      if (response.ok) {
        const failedScans = [];
        const logs = [];
        
        data.results.forEach((res, index) => {
          if (!res.success) {
            failedScans.push(queue[index]);
            logs.push(`Error en ticket ${res.qr_token.substring(0,8)}...: ${res.message}`);
          } else {
            logs.push(`Ticket ${res.qr_token.substring(0,8)}... sincronizado con éxito.`);
          }
        });
        
        localStorage.setItem('offline_scans_queue', JSON.stringify(failedScans));
        setOfflineQueue(failedScans);
        setSyncLogs(logs);
        
        if (failedScans.length === 0) {
          alert('¡Sincronización completada! Todos los tickets guardados offline se sincronizaron con éxito.');
        } else {
          alert(`Sincronización parcial: ${failedScans.length} tickets no pudieron ser validados por el servidor.`);
        }
      } else {
        alert('Error al sincronizar con el servidor.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al intentar sincronizar los tickets offline.');
    } finally {
      setSyncing(false);
    }
  };

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
        setScanResult(decodedText);
        scanner.clear().then(() => {
          if (!navigator.onLine) {
            // Trigger offline reception form
            setTicket({
              id: 0,
              qr_token: decodedText,
              material_name: 'Desconocido (Modo Sin Conexión)',
              material_unit: 'unidad',
              quantity: 0,
              vehicle_info: 'Carga Offline',
              status: 'pending',
              isOffline: true
            });
          } else {
            loadTicketData(decodedText);
          }
        }).catch(err => {
          console.error("Error clearing scanner:", err);
          if (!navigator.onLine) {
            setTicket({
              id: 0,
              qr_token: decodedText,
              material_name: 'Desconocido (Modo Sin Conexión)',
              material_unit: 'unidad',
              quantity: 0,
              vehicle_info: 'Carga Offline',
              status: 'pending',
              isOffline: true
            });
          } else {
            loadTicketData(decodedText);
          }
        });
      },
      (error) => {
        // Scan errors occur frequently while looking for QR, ignore them
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

  const handleConfirmReception = async (e) => {
    if (e) e.preventDefault();
    if (!ticket) return;
    if (!truckNumber.trim() || !licensePlate.trim()) {
      setError('Por favor, ingrese el número de camión y la placa.');
      return;
    }

    if (ticket.isOffline) {
      const newScan = {
        qr_token: ticket.qr_token,
        truck_number: truckNumber,
        license_plate: licensePlate,
        scanned_at: new Date().toISOString()
      };
      
      const currentQueue = JSON.parse(localStorage.getItem('offline_scans_queue') || '[]');
      if (currentQueue.some(x => x.qr_token === newScan.qr_token)) {
        setError('Este ticket ya está en la cola de sincronización offline.');
        return;
      }
      
      const updatedQueue = [...currentQueue, newScan];
      localStorage.setItem('offline_scans_queue', JSON.stringify(updatedQueue));
      setOfflineQueue(updatedQueue);
      
      setSuccess(true);
      setTicket(null);
      return;
    }

    setValidating(true);
    setError('');
    try {
      const response = await apiFetch(`/tickets/token/${ticket.qr_token}/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          truck_number: truckNumber,
          license_plate: licensePlate
        })
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
    setTruckNumber('');
    setLicensePlate('');
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-2">
          <QrCode className="h-7 w-7 text-blue-600" />
          Recepción en Obra (Escanear)
          {!isOnline && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-950 text-white uppercase tracking-wider animate-pulse flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              Sin Conexión
            </span>
          )}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Escanea el código QR del camión de volteo para validar la entrega y descontar del inventario.
        </p>
      </div>

      {/* Offline Queue Status Banner */}
      {offlineQueue.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 p-4.5 rounded-2xl flex flex-col gap-3.5 shadow-sm">
          <div className="flex items-center gap-2.5 text-sm text-amber-800 font-semibold">
            <Clock className="h-5 w-5 text-amber-600 animate-pulse shrink-0" />
            <span>Tienes {offlineQueue.length} ticket(s) escaneado(s) offline pendiente(s).</span>
          </div>
          {isOnline && (
            <button
              onClick={syncOfflineQueue}
              disabled={syncing}
              className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-500 disabled:bg-amber-300 transition-all flex items-center justify-center cursor-pointer shadow-xs"
            >
              {syncing ? (
                <div className="animate-spin rounded-full h-4.5 w-4.5 border-t-2 border-b-2 border-white"></div>
              ) : (
                'Sincronizar ahora con el Servidor'
              )}
            </button>
          )}
        </div>
      )}

      {syncLogs.length > 0 && (
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs text-slate-600 space-y-1 max-h-32 overflow-y-auto">
          <p className="font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Historial de Sincronización:</p>
          {syncLogs.map((log, idx) => (
            <p key={idx} className="font-mono">{log}</p>
          ))}
        </div>
      )}

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
              {isOnline 
                ? "Permite el acceso a la cámara si el navegador lo solicita. Apunta al código QR impreso o en pantalla."
                : "Modo sin conexión activo. Apunta la cámara al código QR impreso para almacenar la recepción de forma local."}
            </p>
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
            <div id="reader" className="w-full"></div>
          </div>
        </div>
      )}

      {/* PREVIEW AND VALIDATE TICKET */}
      {ticket && !loading && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-lg overflow-hidden animate-fade-in">
          <div className="bg-slate-900 p-5 text-white text-center flex items-center justify-between">
            <div className="text-left">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-slate-900 uppercase ${ticket.isOffline ? 'bg-amber-400' : 'bg-blue-400'}`}>
                {ticket.isOffline ? 'Escaneo Offline (Pendiente)' : 'Pendiente de Validación'}
              </span>
              {!ticket.isOffline && (
                <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">Folio: TK-{String(ticket.id).padStart(5, '0')}</p>
              )}
            </div>
            <Truck className="h-8 w-8 text-blue-400" />
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-3.5 border-b border-dashed border-slate-100 pb-5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Material</span>
                <span className="font-bold text-slate-900 text-base">{ticket.material_name}</span>
              </div>
              {!ticket.isOffline && (
                <>
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
                </>
              )}
              {ticket.isOffline && (
                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-xs text-amber-800 leading-relaxed">
                  Dado que no hay conexión a internet, los detalles del material se obtendrán y validarán en el servidor una vez se sincronice.
                </div>
              )}
            </div>

            {ticket.status === 'pending' ? (
              <form onSubmit={handleConfirmReception} className="space-y-5">
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Datos del Vehículo en Recepción
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="truck_number" className="block text-[11px] font-semibold text-slate-500 mb-1">
                        No. de Camión *
                      </label>
                      <input
                        type="text"
                        id="truck_number"
                        placeholder="Ej. C-04"
                        value={truckNumber}
                        onChange={(e) => setTruckNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="license_plate" className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Placa *
                      </label>
                      <input
                        type="text"
                        id="license_plate"
                        placeholder="Ej. AB-1234-A"
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={validating}
                    className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 disabled:bg-emerald-300 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                  >
                    {validating ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-5 w-5" />
                        {ticket.isOffline ? 'Guardar Recepción Offline' : 'Confirmar y Recibir Carga'}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetScanner}
                    className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancelar Escaneo
                  </button>
                </div>
              </form>
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
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-lg text-center space-y-6 animate-fade-in">
          <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle className="h-10 w-10" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">
              {offlineQueue.length > 0 && !isOnline ? '¡Guardado Offline!' : '¡Recepción Exitosa!'}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              {offlineQueue.length > 0 && !isOnline 
                ? 'El ticket se ha guardado localmente en tu dispositivo. Se sincronizará automáticamente con el servidor cuando recuperes la conexión a internet.'
                : 'El ticket ha sido validado, el material ha ingresado a la obra y se ha descontado correctamente del inventario.'}
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
