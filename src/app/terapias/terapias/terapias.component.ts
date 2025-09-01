// src/app/terapias/terapias/terapias.component.ts
import { Component, OnInit } from '@angular/core';
import { TerapiasService } from '../../services/terapias.service';
import { AuthService } from '../../services/auth.service';
import {
  Terapia,
  TipoEjercicioTerapeutico,
  SeccionInfo,
  EjercicioTerapeutico,
  SeccionTerapia,
  NIVELES_SUGERIDOS
} from '../../interfaces/terapias.interfaces';

@Component({
  selector: 'app-terapias',
  standalone: false,
  templateUrl: './terapias.component.html',
  styleUrls: ['./terapias.component.css']
})
export class TerapiasComponent implements OnInit {
  terapias: Terapia[] = [];
  filteredTerapias: Terapia[] = [];
  tiposEjercicios: TipoEjercicioTerapeutico[] = [];
  loading = false;
  error = '';
  showModal = false;
  showViewModal = false;
  modalMode: 'create' | 'edit' = 'create';
  selectedTerapia: Terapia | null = null;
  selectedViewTerapia: Terapia | null = null;
  copySuccess = false;

  // PROPIEDADES PARA NIVEL EDITABLE CON SUGERENCIAS
  showNivelSuggestions = false;
  nivelesSugeridos: string[] = [...NIVELES_SUGERIDOS]; // Usar constantes de la interface

  // Hacer Array disponible en el template
  Array = Array;

  // Formulario para terapia - NIVEL COMO STRING LIBRE
  terapiaForm: Terapia = {
    nombre: '',
    descripcion: '',
    tipo: 'fisica',
    area_especializacion: '',
    nivel: 'Principiante', // Ahora es string libre
    duracion_estimada: 60,
    objetivo_principal: '',
    contraindicaciones: '',
    criterios_progresion: '',
    tags: [],
    status: 1,
    ejercicios: {}
  };

  // Secciones disponibles para terapias
  seccionesDisponibles: SeccionInfo[] = [
    { key: 'calentamiento', nombre: 'Calentamiento', descripcion: 'Ejercicios de preparación y movilización' },
    { key: 'fortalecimiento', nombre: 'Fortalecimiento', descripcion: 'Ejercicios de fortalecimiento muscular' },
    { key: 'equilibrio', nombre: 'Equilibrio', descripcion: 'Ejercicios de equilibrio y propiocepción' },
    { key: 'coordinacion', nombre: 'Coordinación', descripcion: 'Ejercicios de coordinación motora' },
    { key: 'estiramiento', nombre: 'Estiramiento', descripcion: 'Ejercicios de flexibilidad y relajación' },
    { key: 'respiracion', nombre: 'Respiración', descripcion: 'Ejercicios respiratorios y relajación' }
  ];

  // Filtros - nivelFilter como string libre
  searchTerm = '';
  tipoFilter = 'all';
  areaFilter = 'all';
  nivelFilter = ''; // String libre para filtro
  statusFilter = 'active';

  // Control de secciones activas en el formulario
  seccionesActivas: Set<string> = new Set();

  // Opciones para formularios
  tiposDisponibles = [
    { value: 'fisica', label: 'Fisioterapia' },
    { value: 'ocupacional', label: 'Terapia Ocupacional' },
    { value: 'respiratoria', label: 'Respiratoria' },
    { value: 'neurologica', label: 'Neurológica' },
    { value: 'cardiaca', label: 'Cardíaca' }
  ];

  areasEspecializacion = [
    'hombro', 'codo', 'muñeca', 'cadera', 'rodilla', 'tobillo', 
    'columna_cervical', 'columna_lumbar', 'core', 'respiratoria',
    'neurologica', 'cardiaca', 'pediatrica', 'geriatrica'
  ];

  intensidadesDisponibles = [
    { value: 'muy_baja', label: 'Muy Baja' },
    { value: 'baja', label: 'Baja' },
    { value: 'moderada', label: 'Moderada' },
    { value: 'alta', label: 'Alta' },
    { value: 'muy_alta', label: 'Muy Alta' }
  ];

  constructor(
    private terapiasService: TerapiasService,
    private authService: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadTiposEjercicios();
    await this.loadTerapias();
    this.updateNivelesSugeridos(); // Actualizar sugerencias con niveles existentes
  }

  async loadTiposEjercicios(): Promise<void> {
    try {
      this.tiposEjercicios = await this.terapiasService.getTiposEjerciciosTerapeuticos();
    } catch (error) {
      console.error('Error cargando tipos de ejercicios:', error);
      this.tiposEjercicios = [];
    }
  }

  async loadTerapias(): Promise<void> {
    try {
      this.loading = true;
      this.terapias = await this.terapiasService.getTerapias();
      this.updateNivelesSugeridos(); // Actualizar después de cargar terapias
      this.applyFilters();
    } catch (error) {
      console.error('Error cargando terapias:', error);
      this.error = 'Error al cargar las terapias';
      this.terapias = [];
    } finally {
      this.loading = false;
    }
  }

  // FILTROS ACTUALIZADO PARA NIVEL LIBRE
  applyFilters(): void {
    this.filteredTerapias = this.terapias.filter(terapia => {
      const matchesSearch = !this.searchTerm || 
        terapia.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        terapia.descripcion?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        terapia.area_especializacion?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesTipo = this.tipoFilter === 'all' || terapia.tipo === this.tipoFilter;
      const matchesArea = this.areaFilter === 'all' || terapia.area_especializacion === this.areaFilter;
      
      // FILTRO POR NIVEL COMO TEXTO LIBRE (coincidencia parcial)
      const matchesNivel = !this.nivelFilter || !this.nivelFilter.trim() ||
        terapia.nivel?.toLowerCase().includes(this.nivelFilter.toLowerCase().trim());
      
      const matchesStatus = this.statusFilter === 'all' || 
        (this.statusFilter === 'active' && terapia.status === 1) ||
        (this.statusFilter === 'inactive' && terapia.status === 0);

      return matchesSearch && matchesTipo && matchesArea && matchesNivel && matchesStatus;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.tipoFilter = 'all';
    this.areaFilter = 'all';
    this.nivelFilter = '';
    this.statusFilter = 'active';
    this.applyFilters();
  }

  // ===============================================
  // MÉTODOS PARA MANEJO DEL DROPDOWN DE SUGERENCIAS DE NIVEL
  // ===============================================

  selectNivelSugerencia(sugerencia: string): void {
    this.terapiaForm.nivel = sugerencia;
    this.showNivelSuggestions = false;
  }

  hideNivelSuggestions(): void {
    // Usar setTimeout para permitir que el click en la sugerencia funcione
    setTimeout(() => {
      this.showNivelSuggestions = false;
    }, 200);
  }

  onNivelInputFocus(): void {
    this.showNivelSuggestions = true;
  }

  onNivelInputChange(): void {
    // Filtrar sugerencias basadas en el texto actual
    const inputValue = this.terapiaForm.nivel?.toLowerCase() || '';
    if (inputValue) {
      const filteredSuggestions = this.nivelesSugeridos.filter(nivel =>
        nivel.toLowerCase().includes(inputValue)
      );
      // Solo mostrar sugerencias si hay coincidencias y no es exacta
      this.showNivelSuggestions = filteredSuggestions.length > 0 && 
        !filteredSuggestions.some(s => s.toLowerCase() === inputValue);
    } else {
      this.showNivelSuggestions = true;
    }
  }

  // VALIDACIÓN DEL NIVEL EN EL FORMULARIO
  private validateNivel(): boolean {
    if (!this.terapiaForm.nivel || !this.terapiaForm.nivel.trim()) {
      this.error = 'El nivel es requerido';
      return false;
    }
    
    // Validar longitud máxima
    if (this.terapiaForm.nivel.length > 50) {
      this.error = 'El nivel no puede exceder 50 caracteres';
      return false;
    }
    
    return true;
  }

  // OBTENER NIVELES ÚNICOS EXISTENTES
  getNivelesExistentes(): string[] {
    const niveles = new Set<string>();
    this.terapias.forEach(terapia => {
      if (terapia.nivel && terapia.nivel.trim()) {
        niveles.add(terapia.nivel.trim());
      }
    });
    return Array.from(niveles).sort();
  }

  // ACTUALIZAR SUGERENCIAS DINÁMICAMENTE
  updateNivelesSugeridos(): void {
    const nivelesExistentes = this.getNivelesExistentes();
    const sugerenciasBase = [...NIVELES_SUGERIDOS];

    // Combinar sugerencias base con niveles existentes únicos
    const nivelesUnicos = new Set([...sugerenciasBase, ...nivelesExistentes]);
    this.nivelesSugeridos = Array.from(nivelesUnicos).sort();
  }

  // ===============================================
  // MÉTODOS AUXILIARES PARA EL TEMPLATE
  // ===============================================

  getTipoLabel(tipo: string): string {
    const tipoObj = this.tiposDisponibles.find(t => t.value === tipo);
    return tipoObj ? tipoObj.label : tipo;
  }

  getSeccionNombre(seccionKey: string): string {
    const seccion = this.seccionesDisponibles.find(s => s.key === seccionKey);
    return seccion ? seccion.nombre : seccionKey;
  }

  getTipoEjercicioNombre(tipoNombre: string): string {
    const tipo = this.tiposEjercicios.find(t => t.nombre === tipoNombre);
    return tipo ? tipo.nombre : tipoNombre;
  }

  getIntensidadLabel(intensidad: string): string {
    const intensidadObj = this.intensidadesDisponibles.find(i => i.value === intensidad);
    return intensidadObj ? intensidadObj.label : intensidad;
  }

  exportarTerapia(terapia: Terapia): void {
    const texto = this.getFormattedTerapia(terapia);
    
    // Crear y descargar archivo
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.getFileNameSafe(terapia.nombre)}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    console.log('Terapia exportada:', terapia.nombre);
  }

  // ===============================================
  // GESTIÓN DE MODALES
  // ===============================================

  openCreateModal(): void {
    this.modalMode = 'create';
    this.selectedTerapia = null;
    this.resetForm();
    this.showModal = true;
    this.showNivelSuggestions = false;
  }

  openEditModal(terapia: Terapia): void {
    this.modalMode = 'edit';
    this.selectedTerapia = terapia;
    this.terapiaForm = JSON.parse(JSON.stringify(terapia)); // Deep copy
    
    // Identificar secciones activas basadas en ejercicios
    this.seccionesActivas.clear();
    if (this.terapiaForm.ejercicios) {
      this.seccionesDisponibles.forEach(seccion => {
        if (this.terapiaForm.ejercicios[seccion.key]) {
          this.seccionesActivas.add(seccion.key);
        }
      });
    }
    
    this.error = '';
    this.showModal = true;
    this.showNivelSuggestions = false;
  }

  openViewModal(terapia: Terapia): void {
    console.log('Abriendo modal de vista para terapia:', terapia.nombre);
    this.selectedViewTerapia = terapia;
    this.showViewModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedTerapia = null;
    this.error = '';
    this.resetForm();
    this.showNivelSuggestions = false;
  }

  closeViewModal(): void {
    console.log('Cerrando modal de vista');
    this.showViewModal = false;
    this.selectedViewTerapia = null;
    this.copySuccess = false;
  }

  resetForm(): void {
    this.terapiaForm = {
      nombre: '',
      descripcion: '',
      tipo: 'fisica',
      area_especializacion: '',
      nivel: 'Principiante', // Valor por defecto
      duracion_estimada: 60,
      objetivo_principal: '',
      contraindicaciones: '',
      criterios_progresion: '',
      tags: [],
      status: 1,
      ejercicios: {}
    };
    this.seccionesActivas.clear();
  }

  // ===============================================
  // GESTIÓN DE SECCIONES
  // ===============================================

  toggleSeccion(seccionKey: string): void {
    if (this.seccionesActivas.has(seccionKey)) {
      this.seccionesActivas.delete(seccionKey);
      // Eliminar la sección del objeto ejercicios
      if (this.terapiaForm.ejercicios) {
        delete this.terapiaForm.ejercicios[seccionKey];
      }
    } else {
      this.seccionesActivas.add(seccionKey);
      // Inicializar la sección si no existe
      if (!this.terapiaForm.ejercicios) {
        this.terapiaForm.ejercicios = {};
      }
      if (!this.terapiaForm.ejercicios[seccionKey]) {
        this.terapiaForm.ejercicios[seccionKey] = {
          descripcion: '',
          tiempo_total: '',
          objetivos: [],
          ejercicios: []
        };
      }
    }
  }

  getSeccionData(seccionKey: string): SeccionTerapia | null {
    if (!this.terapiaForm.ejercicios || !this.terapiaForm.ejercicios[seccionKey]) {
      // Inicializar si no existe pero la sección está activa
      if (this.seccionesActivas.has(seccionKey)) {
        if (!this.terapiaForm.ejercicios) {
          this.terapiaForm.ejercicios = {};
        }
        this.terapiaForm.ejercicios[seccionKey] = {
          descripcion: '',
          tiempo_total: '',
          objetivos: [],
          ejercicios: []
        };
        return this.terapiaForm.ejercicios[seccionKey];
      }
      return null;
    }
    return this.terapiaForm.ejercicios[seccionKey];
  }

  updateSeccionData(seccionKey: string, data: SeccionTerapia): void {
    if (!this.terapiaForm.ejercicios) {
      this.terapiaForm.ejercicios = {};
    }
    this.terapiaForm.ejercicios[seccionKey] = data;
  }

  // ===============================================
  // GESTIÓN DE EJERCICIOS
  // ===============================================

  addEjercicio(seccionKey: string): void {
    const seccion = this.getSeccionData(seccionKey);
    if (!seccion) return;

    const nuevoEjercicio: EjercicioTerapeutico = {
      orden: seccion.ejercicios.length + 1,
      nombre: '',
      tipo: 'movilidad',
      repeticiones: 10,
      series: 2,
      duracion: '2:00',
      descripcion: '',
      intensidad: 'moderada',
      precauciones: '',
          cals: 0 // ← NUEVA PROPIEDAD INICIALIZADA

    };

    seccion.ejercicios.push(nuevoEjercicio);
    this.updateSeccionData(seccionKey, seccion);
  }

  removeEjercicio(seccionKey: string, index: number): void {
    const seccion = this.getSeccionData(seccionKey);
    if (!seccion) return;

    seccion.ejercicios.splice(index, 1);
    
    // Reordenar
    seccion.ejercicios.forEach((ejercicio, i) => {
      ejercicio.orden = i + 1;
    });

    this.updateSeccionData(seccionKey, seccion);
  }

  moveEjercicio(seccionKey: string, fromIndex: number, toIndex: number): void {
    const seccion = this.getSeccionData(seccionKey);
    if (!seccion || toIndex < 0 || toIndex >= seccion.ejercicios.length) return;

    const ejercicio = seccion.ejercicios.splice(fromIndex, 1)[0];
    seccion.ejercicios.splice(toIndex, 0, ejercicio);
    
    // Reordenar
    seccion.ejercicios.forEach((ejercicio, i) => {
      ejercicio.orden = i + 1;
    });

    this.updateSeccionData(seccionKey, seccion);
  }

  // ===============================================
  // GUARDADO Y VALIDACIÓN CON VALIDACIÓN DE NIVEL
  // ===============================================

  async saveTerapia(): Promise<void> {
    try {
      this.error = '';
      this.loading = true;

      // Validaciones existentes
      if (!this.terapiaForm.nombre.trim()) {
        this.error = 'El nombre es requerido';
        return;
      }

      // VALIDACIÓN DE NIVEL
      if (!this.validateNivel()) {
        return;
      }

      if (this.seccionesActivas.size === 0) {
        this.error = 'Debe activar al menos una sección con ejercicios';
        return;
      }

      // Validar que las secciones activas tengan ejercicios
      let tieneEjercicios = false;
      for (const seccionKey of this.seccionesActivas) {
        const seccion = this.getSeccionData(seccionKey);
        if (seccion && seccion.ejercicios.length > 0) {
          tieneEjercicios = true;
          break;
        }
      }

      if (!tieneEjercicios) {
        this.error = 'Debe agregar al menos un ejercicio en alguna sección';
        return;
      }

      // Limpiar y normalizar el nivel
      this.terapiaForm.nivel = this.terapiaForm.nivel.trim();

      // Preparar datos para guardar
      const dataToSave = { ...this.terapiaForm };
      
      // Asegurar que solo se guarden las secciones activas
      const ejerciciosLimpios: any = {};
      this.seccionesActivas.forEach(seccionKey => {
        const seccion = this.getSeccionData(seccionKey);
        if (seccion && seccion.ejercicios.length > 0) {
          ejerciciosLimpios[seccionKey] = seccion;
        }
      });
      
      dataToSave.ejercicios = ejerciciosLimpios;

      if (this.modalMode === 'create') {
        await this.terapiasService.createTerapia(dataToSave);
      } else {
        await this.terapiasService.updateTerapia(this.selectedTerapia!.id!, dataToSave);
      }

      await this.loadTerapias();
      this.closeModal();
    } catch (error) {
      console.error('Error guardando terapia:', error);
      this.error = 'Error al guardar la terapia. Intente nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  async deleteTerapia(terapia: Terapia): Promise<void> {
    if (!confirm(`¿Está seguro de eliminar la terapia "${terapia.nombre}"?`)) {
      return;
    }

    try {
      this.loading = true;
      await this.terapiasService.deleteTerapia(terapia.id!);
      await this.loadTerapias();
    } catch (error) {
      console.error('Error eliminando terapia:', error);
      this.error = 'Error al eliminar la terapia';
    } finally {
      this.loading = false;
    }
  }

  // ===============================================
  // UTILIDADES Y MÉTODOS AUXILIARES
  // ===============================================

  canEditTerapia(): boolean {
    return this.authService.isAdmin() || this.authService.hasProfile(3); // Admin o Supervisor
  }

  formatDuracion(minutos?: number): string {
    if (!minutos) return 'Sin especificar';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
  }

  // Obtener áreas únicas de las terapias existentes
  getAreasUnicas(): string[] {
    const areas = new Set<string>();
    this.terapias.forEach(terapia => {
      if (terapia.area_especializacion) {
        areas.add(terapia.area_especializacion);
      }
    });
    return Array.from(areas).sort();
  }

  // Método para obtener nombre de archivo seguro
  getFileNameSafe(nombre: string): string {
    return nombre ? nombre.replace(/\s+/g, '_') : 'terapia';
  }

  // ===============================================
  // MÉTODOS PARA MODAL DE VISTA
  // ===============================================

  async copyToClipboard(): Promise<void> {
    if (!this.selectedViewTerapia) return;
    
    try {
      const formattedText = this.getFormattedTerapia(this.selectedViewTerapia);
      await navigator.clipboard.writeText(formattedText);
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    } catch (error) {
      console.error('Error al copiar:', error);
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = this.getFormattedTerapia(this.selectedViewTerapia);
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        this.copySuccess = true;
        setTimeout(() => {
          this.copySuccess = false;
        }, 2000);
      } catch (fallbackError) {
        console.error('Error en fallback de copia:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  }

 // ENCUENTRA y ACTUALIZA el método getFormattedTerapia en terapias.component.ts
// Específicamente la parte que muestra los detalles del ejercicio:

// REEMPLAZA COMPLETAMENTE el método getFormattedTerapia en terapias.component.ts para que coincida con el formato terminal:

getFormattedTerapia(terapia: Terapia): string {
  console.log('🩺 Formateando terapia con FORMATO TERMINAL:', terapia?.nombre);
  
  if (!terapia) return '';

  let texto = '';
  
  // =====================================
  // HEADER PRINCIPAL CON DISEÑO MEJORADO
  // =====================================
  texto += '╔' + '═'.repeat(78) + '╗\n';
  texto += '║' + `🩺 ${terapia.nombre.toUpperCase()}`.padEnd(78) + '║\n';
  texto += '╚' + '═'.repeat(78) + '╝\n';
  
  texto += `${terapia.descripcion || 'Terapia de rehabilitación integral'}\n\n`;
  
  // Información básica con iconos
  const nivelText = `Nivel: ${(terapia.nivel || 'No especificado').toUpperCase()}`;
  const duracionText = `Duración: ${this.formatDuracion(terapia.duracion_estimada)}`;
  const tipoText = `Tipo: ${this.getTipoLabel(terapia.tipo).toUpperCase()}`;
  
  texto += `🎯 ${nivelText} | ⏱️ ${duracionText} | 🏥 ${tipoText}\n\n`;
  
  // Información adicional
  if (terapia.area_especializacion) {
    texto += `📍 Área: ${terapia.area_especializacion.replace('_', ' ').toUpperCase()}\n`;
  }
  if (terapia.objetivo_principal) {
    texto += `🎯 Objetivo: ${terapia.objetivo_principal}\n`;
  }
  texto += '\n';
  
  // =====================================
  // PLAN TERAPÉUTICO CON FORMATO MEJORADO
  // =====================================
  texto += '╔' + '═'.repeat(78) + '╗\n';
  texto += '║' + `💪 PLAN TERAPÉUTICO`.padEnd(78) + '║\n';
  texto += '╚' + '═'.repeat(78) + '╝\n\n';

  // Iconos para cada sección
  const iconosSecciones: { [key: string]: string } = {
    'calentamiento': '🔥',
    'fortalecimiento': '💪',
    'equilibrio': '⚖️',
    'coordinacion': '🎯',
    'estiramiento': '🤸',
    'respiracion': '🫁'
  };

  let seccionesEncontradas = 0;
  
  if (this.hasEjercicios(terapia)) {
    const seccionesConEjercicios = this.getSeccionesConEjercicios(terapia);
    
    seccionesConEjercicios.forEach((sectionKey, index) => {
      const seccionData = terapia.ejercicios[sectionKey];
      if (seccionData && seccionData.ejercicios && seccionData.ejercicios.length > 0) {
        seccionesEncontradas++;
        
        // Header de sección con icono
        const icono = iconosSecciones[sectionKey] || '📋';
        const nombreSeccion = this.getNombreSeccion(sectionKey);
        texto += '┌' + '─'.repeat(76) + '┐\n';
        texto += '│ ' + `${icono} ${nombreSeccion.toUpperCase()}`.padEnd(75) + '│\n';
        texto += '└' + '─'.repeat(76) + '┘\n';
        
        // Descripción de la sección si existe
        if (seccionData.descripcion) {
          texto += `📝 ${seccionData.descripcion}\n`;
        }
        
        // Información adicional de la sección
        const infoAdicional = [];
        if (seccionData.tiempo_total) infoAdicional.push(`⏱️ Tiempo: ${seccionData.tiempo_total}`);
        
        if (infoAdicional.length > 0) {
          texto += `${infoAdicional.join(' | ')}\n`;
        }
        
        texto += '─'.repeat(78) + '\n';
        
        // EJERCICIOS CON NUMERACIÓN Y FORMATO MEJORADO
        seccionData.ejercicios.forEach((ejercicio: any, ejercicioIndex: number) => {
          texto += `${(ejercicioIndex + 1).toString().padStart(2, '0')}. 🔹 ${ejercicio.nombre || 'Ejercicio'}\n`;
          
          // Detalles del ejercicio con iconos
          const detalles = [];
          if (ejercicio.repeticiones) detalles.push(`🔢 ${ejercicio.repeticiones} reps`);
          if (ejercicio.series) detalles.push(`🔄 ${ejercicio.series} series`);
          if (ejercicio.duracion) detalles.push(`⏳ ${ejercicio.duracion}`);
          if (ejercicio.cals) detalles.push(`🔥 ${ejercicio.cals} cals`);
          if (ejercicio.intensidad) detalles.push(`⚡ ${ejercicio.intensidad}`);
          
          if (detalles.length > 0) {
            texto += `    └─ ${detalles.join(' • ')}\n`;
          }
          
          // Descripción si existe
          if (ejercicio.descripcion) {
            texto += `    📝 ${ejercicio.descripcion}\n`;
          }
          
          // Precauciones si existen
          if (ejercicio.precauciones) {
            texto += `    ⚠️ PRECAUCIÓN: ${ejercicio.precauciones}\n`;
          }
          
          // Espaciado entre ejercicios
          if (ejercicioIndex < seccionData.ejercicios.length - 1) {
            texto += '\n';
          }
        });
        
        // Separador entre secciones
        if (index < seccionesConEjercicios.length - 1) {
          texto += '\n' + '═'.repeat(78) + '\n\n';
        }
      }
    });
  }

  // Si no se encontraron secciones con ejercicios
  if (seccionesEncontradas === 0) {
    texto += `┌${'─'.repeat(76)}┐\n`;
    texto += `│ ℹ️ TERAPIA EN DESARROLLO${' '.repeat(50)}│\n`;
    texto += `└${'─'.repeat(76)}┘\n`;
    texto += `Esta terapia está siendo desarrollada.\n`;
    texto += `Los ejercicios serán agregados próximamente.\n\n`;
  }

  // =====================================
  // INFORMACIÓN CLÍNICA ADICIONAL
  // =====================================
  if (terapia.contraindicaciones || terapia.criterios_progresion) {
    texto += '╔' + '═'.repeat(78) + '╗\n';
    texto += '║' + `⚕️ INFORMACIÓN CLÍNICA`.padEnd(78) + '║\n';
    texto += '╚' + '═'.repeat(78) + '╝\n\n';
    
    if (terapia.contraindicaciones) {
      texto += '┌' + '─'.repeat(76) + '┐\n';
      texto += '│ ' + `⚠️ CONTRAINDICACIONES`.padEnd(75) + '│\n';
      texto += '└' + '─'.repeat(76) + '┘\n';
      texto += `${terapia.contraindicaciones}\n\n`;
    }
    
    if (terapia.criterios_progresion) {
      texto += '┌' + '─'.repeat(76) + '┐\n';
      texto += '│ ' + `📈 CRITERIOS DE PROGRESIÓN`.padEnd(75) + '│\n';
      texto += '└' + '─'.repeat(76) + '┘\n';
      texto += `${terapia.criterios_progresion}\n\n`;
    }
  }

  // =====================================
  // TAGS DE LA TERAPIA
  // =====================================
  if (terapia.tags && terapia.tags.length > 0) {
    texto += `🏷️ Tags: ${terapia.tags.map((tag: string) => `#${tag}`).join(' ')}\n\n`;
  }

  // =====================================
  // FOOTER CON RESUMEN E INFORMACIÓN DEL SISTEMA
  // =====================================
  texto += '╔' + '═'.repeat(78) + '╗\n';
  texto += '║' + `🏥 rehabiMovement - Sistema de Rehabilitación`.padEnd(78) + '║\n';
  texto += '╠' + '═'.repeat(78) + '╣\n';
  
  // Resumen de la terapia
  const totalEjercicios = this.getTotalEjercicios(terapia);
  texto += '║' + `📈 RESUMEN: ${totalEjercicios} ejercicios terapéuticos total`.padEnd(78) + '║\n';
  
  if (terapia.duracion_estimada) {
    texto += '║' + `⏱️ Duración estimada: ${this.formatDuracion(terapia.duracion_estimada)}`.padEnd(78) + '║\n';
  }
  
  const today = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  texto += '║' + `📅 Generado: ${today}`.padEnd(78) + '║\n';
  texto += '║' + `🆔 ID Terapia: ${terapia.id || 'N/A'}`.padEnd(78) + '║\n';
  texto += '║' + `👩‍⚕️ Creado por: Administrador del Sistema`.padEnd(78) + '║\n';
  
  texto += '╚' + '═'.repeat(78) + '╝\n';

  console.log('✅ Formato terminal aplicado exitosamente a terapia!');
  return texto;
}

  getNombreSeccion(key: string): string {
    const secciones: { [key: string]: string } = {
      'calentamiento': 'Calentamiento',
      'fortalecimiento': 'Fortalecimiento',
      'equilibrio': 'Equilibrio',
      'coordinacion': 'Coordinación',
      'estiramiento': 'Estiramiento',
      'respiracion': 'Respiración'
    };
    return secciones[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }

  hasEjercicios(terapia: Terapia): boolean {
    if (!terapia || !terapia.ejercicios) return false;
    
    return Object.keys(terapia.ejercicios).some(key => {
      const seccion = terapia.ejercicios[key];
      return seccion && seccion.ejercicios && Array.isArray(seccion.ejercicios) && seccion.ejercicios.length > 0;
    });
  }

  getTotalEjercicios(terapia: Terapia): number {
    if (!terapia || !terapia.ejercicios) return 0;
    
    let total = 0;
    Object.keys(terapia.ejercicios).forEach(key => {
      const seccion = terapia.ejercicios[key];
      if (seccion && seccion.ejercicios && Array.isArray(seccion.ejercicios)) {
        total += seccion.ejercicios.length;
      }
    });
    return total;
  }

  getSeccionesConEjercicios(terapia: Terapia): string[] {
    if (!terapia || !terapia.ejercicios) return [];
    
    return Object.keys(terapia.ejercicios).filter(key => {
      const seccion = terapia.ejercicios[key];
      return seccion && seccion.ejercicios && Array.isArray(seccion.ejercicios) && seccion.ejercicios.length > 0;
    });
  }

  // ===============================================
  // GESTIÓN DE TAGS
  // ===============================================

  addTag(event: any): void {
    const tag = event.target.value.trim();
    if (tag && !this.terapiaForm.tags?.includes(tag)) {
      if (!this.terapiaForm.tags) {
        this.terapiaForm.tags = [];
      }
      this.terapiaForm.tags.push(tag);
      event.target.value = '';
    }
  }

  removeTag(index: number): void {
    if (this.terapiaForm.tags) {
      this.terapiaForm.tags.splice(index, 1);
    }
  }
}