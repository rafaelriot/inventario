'use client';

import { useState } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Download, 
  AlertCircle 
} from 'lucide-react';

export default function ReportsPage() {
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [error, setError] = useState('');

  const triggerDownload = async (type) => {
    setError('');
    if (type === 'excel') setDownloadingExcel(true);
    if (type === 'pdf') setDownloadingPDF(true);

    try {
      const token = localStorage.getItem('token');
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      
      const response = await fetch(`${backendUrl}/reports/${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('No se pudo generar el reporte. Contacta al administrador.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'excel' ? 'Reporte_Inventario_Construccion.xlsx' : 'Reporte_Inventario_Construccion.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      if (type === 'excel') setDownloadingExcel(false);
      if (type === 'pdf') setDownloadingPDF(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reportes de Obra</h1>
        <p className="text-slate-500 text-sm mt-1">Exporta las existencias del inventario e historial de movimientos.</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start text-rose-700 text-sm">
          <AlertCircle className="h-5 w-5 mr-3 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Reports Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Excel Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between hover:border-slate-200 transition-colors">
          <div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Reporte Completo en Excel</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Descarga un libro de cálculo con dos pestañas detalladas:
            </p>
            <ul className="text-xs text-slate-500 mt-3 space-y-2 pl-4 list-disc">
              <li>Inventario actual con alertas de stock.</li>
              <li>Historial unificado de todas las compras y gastos.</li>
            </ul>
          </div>

          <button
            onClick={() => triggerDownload('excel')}
            disabled={downloadingExcel || downloadingPDF}
            className="w-full mt-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center shadow-sm shadow-emerald-600/10 hover:shadow-emerald-500/20 transition-all"
          >
            {downloadingExcel ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel (.xlsx)
              </>
            )}
          </button>
        </div>

        {/* PDF Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between hover:border-slate-200 transition-colors">
          <div>
            <div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-5">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Reporte de Inventario (PDF)</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Genera un documento en PDF listo para imprimir o enviar por correo:
            </p>
            <ul className="text-xs text-slate-500 mt-3 space-y-2 pl-4 list-disc">
              <li>Listado limpio de todos los materiales.</li>
              <li>Código de colores visual para alertas de stock.</li>
              <li>Diseño formateado listo para firma de supervisión.</li>
            </ul>
          </div>

          <button
            onClick={() => triggerDownload('pdf')}
            disabled={downloadingExcel || downloadingPDF}
            className="w-full mt-8 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center shadow-sm shadow-red-600/10 hover:shadow-red-500/20 transition-all"
          >
            {downloadingPDF ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF (.pdf)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
