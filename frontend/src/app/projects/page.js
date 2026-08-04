'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../utils/api';
import {
  FolderKanban,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  MapPin,
  Eye,
  Calendar,
  User,
  CheckCircle2,
  PauseCircle,
  Clock,
  Package
} from 'lucide-react';

export default function ProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentProjectId, setCurrentProjectId] = useState(null);

  // Form
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await apiFetch('/projects');
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setCurrentProjectId(null);
    setFormName('');
    setFormDescription('');
    setFormLocation('');
    setFormStatus('active');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const openEditModal = (project) => {
    setModalMode('edit');
    setCurrentProjectId(project.id);
    setFormName(project.name);
    setFormDescription(project.description || '');
    setFormLocation(project.location || '');
    setFormStatus(project.status);
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError('');
    setFormSuccess('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    if (!formName.trim()) {
      setFormError('El nombre del proyecto es obligatorio.');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      location: formLocation.trim() || null,
      status: formStatus
    };

    try {
      const url = modalMode === 'create' ? '/projects' : `/projects/${currentProjectId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setFormSuccess(data.message);
      await fetchProjects();
      setTimeout(() => closeModal(), 1200);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await apiFetch(`/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDeleteConfirmId(null);
      await fetchProjects();
    } catch (err) {
      alert(err.message);
    }
  };

  const statusConfig = {
    active: { label: 'Activo', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    paused: { label: 'Pausado', color: 'bg-amber-100 text-amber-700', icon: PauseCircle },
    completed: { label: 'Completado', color: 'bg-blue-100 text-blue-700', icon: Clock }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = !filterStatus || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Proyectos / Obras</h1>
          <p className="text-slate-500 text-sm mt-1">Administra las obras y proyectos de construcción.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Proyecto
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar proyectos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 transition-all"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="paused">Pausado</option>
          <option value="completed">Completado</option>
        </select>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <FolderKanban className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No se encontraron proyectos</p>
          <p className="text-slate-400 text-sm mt-1">Crea tu primer proyecto para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const cfg = statusConfig[project.status] || statusConfig.active;
            const StatusIcon = cfg.icon;
            return (
              <div key={project.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <FolderKanban className="h-5 w-5" />
                      </div>
                      <div className="ml-3 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{project.name}</h3>
                        {project.location && (
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center truncate">
                            <MapPin className="h-3 w-3 mr-1 shrink-0" />
                            {project.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center shrink-0 ml-2 ${cfg.color}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {cfg.label}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{project.description}</p>
                  )}

                  <div className="flex items-center text-[10px] text-slate-400 font-medium">
                    <Calendar className="h-3 w-3 mr-1" />
                    Creado: {new Date(project.created_at).toISOString().split('T')[0]}
                    {project.creator_name && (
                      <span className="ml-3 flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        {project.creator_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-2">
                  <button
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="flex items-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Ver Consumo
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(project)}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {user?.role === 'admin' && (
                      <>
                        {deleteConfirmId === project.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(project.id)} className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold">Sí</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(project.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {modalMode === 'create' ? 'Nuevo Proyecto' : 'Editar Proyecto'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold">
                  {formSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nombre del Proyecto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Casa Residencial Norte"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Ubicación (opcional)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ej. Col. Centro, Calle Principal #123"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Descripción (opcional)
                </label>
                <textarea
                  placeholder="Breve descripción del proyecto..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 transition-all resize-none"
                />
              </div>

              {modalMode === 'edit' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Estado
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-indigo-600 transition-all"
                  >
                    <option value="active">Activo</option>
                    <option value="paused">Pausado</option>
                    <option value="completed">Completado</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center"
              >
                {submitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : modalMode === 'create' ? 'Crear Proyecto' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
