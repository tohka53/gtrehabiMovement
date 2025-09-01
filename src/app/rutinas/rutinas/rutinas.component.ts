// src/app/rutinas/rutinas/rutinas.component.ts
import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { 
  Rutina, 
  TipoSeccion, 
  Ejercicio, 
  SeccionRutina, 
  SeccionInfo,
  SeccionConEjercicios
} from '../../interfaces/rutinas.interfaces';

@Component({
  selector: 'app-rutinas',
  standalone: false,
  templateUrl: './rutinas.component.html',
  styleUrls: ['./rutinas.component.css']
})
export class RutinasComponent implements OnInit {
  rutinas: Rutina[] = [];
  filteredRutinas: Rutina[] = [];
  tiposSeccion: TipoSeccion[] = [];
  loading = false;
  error = '';
  showModal = false;
  modalMode: 'create' | 'edit' | 'view' = 'create';
  selectedRutina: Rutina | null = null;

  // Modal de vista independiente
  showViewModal = false;
  selectedViewRutina: Rutina | null = null;
  copySuccess = false;

  // NUEVAS PROPIEDADES PARA NIVEL EDITABLE
  showNivelSuggestions = false;
  nivelesSugeridos: string[] = [
    'Principiante',
    'Intermedio', 
    'Avanzado',
    'CrossFit Rx',
    'CrossFit Scaled',
    'Elite',
    'Competencia',
    'Rehabilitación',
    'Adulto Mayor',
    'Juvenil',
    'Profesional',
    'Amateur'
  ];

  // Formulario para rutina con index signature
  rutinaForm: Rutina = {
    nombre: '',
    descripcion: '',
    tipo: 'entrenamiento',
    nivel: 'Intermedio', // Valor por defecto actualizado
    duracion_estimada: 60,
    tags: [],
    status: 1
  };

  // Secciones disponibles
  seccionesDisponibles: SeccionInfo[] = [
    { key: 'warm_upg', nombre: 'General Warm Up', descripcion: 'Calentamiento Calendario' },
    { key: 'warm_up', nombre: 'Warm Up', descripcion: 'Calentamiento' },
    { key: 'met_con', nombre: 'Metcon', descripcion: 'Metabolic Conditioning' },
    { key: 'strength', nombre: 'Strength', descripcion: 'Entrenamiento de Fuerza' },
    { key: 'core', nombre: 'Core', descripcion: 'Trabajo de Core' },
    { key: 'skill', nombre: 'Skill', descripcion: 'Skills' },
    { key: 'extra', nombre: 'Extra', descripcion: 'Trabajo Adicional' }
  ];

  // Filtros - ACTUALIZADO: nivelFilter ahora es string vacío
  searchTerm = '';
  tipoFilter = 'all';
  nivelFilter = ''; // Cambio: de 'all' a string vacío
  statusFilter = 'active';

  // Control de secciones activas en el formulario
  seccionesActivas: Set<string> = new Set();

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadTiposSeccion();
    await this.loadRutinas();
  }

  async loadTiposSeccion(): Promise<void> {
    try {
      const data = await this.supabaseService.getData('tipos_seccion');
      this.tiposSeccion = data?.filter(tipo => tipo.status === 1) || [];
    } catch (error) {
      console.error('Error cargando tipos de sección:', error);
    }
  }

  async loadRutinas(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const data = await this.supabaseService.getData('rutinas');
      this.rutinas = data || [];

      // Ordenar alfabéticamente las rutinas por nombre
      this.rutinas = this.rutinas.sort((a, b) => {
        return a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase());
      });

      this.filteredRutinas = [...this.rutinas];
      this.applyFilters();
      console.log('Rutinas cargadas:', this.rutinas.length);
    } catch (error) {
      console.error('Error cargando rutinas:', error);
      this.error = 'Error al cargar las rutinas';
    } finally {
      this.loading = false;
    }
  }

  // MÉTODO MODIFICADO: applyFilters() con filtro de nivel como texto
  applyFilters(): void {
    let filtered = [...this.rutinas];

    // Filtro por status
    if (this.statusFilter === 'active') {
      filtered = filtered.filter(rutina => rutina.status === 1);
    } else if (this.statusFilter === 'inactive') {
      filtered = filtered.filter(rutina => rutina.status === 0);
    }

    // Filtro por búsqueda
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(rutina => 
        rutina.nombre.toLowerCase().includes(term) ||
        rutina.descripcion?.toLowerCase().includes(term) ||
        rutina.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Filtro por tipo
    if (this.tipoFilter !== 'all') {
      filtered = filtered.filter(rutina => rutina.tipo === this.tipoFilter);
    }

    // FILTRO POR NIVEL MODIFICADO - AHORA ES TEXTO LIBRE
    if (this.nivelFilter && this.nivelFilter.trim()) {
      const nivelTerm = this.nivelFilter.toLowerCase().trim();
      filtered = filtered.filter(rutina => 
        rutina.nivel?.toLowerCase().includes(nivelTerm)
      );
    }

    // Ordenamiento alfabético por nombre
    filtered = filtered.sort((a, b) => {
      return a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase());
    });

    this.filteredRutinas = filtered;
  }

  // MÉTODO MODIFICADO: openCreateModal() con valor de nivel por defecto actualizado
  openCreateModal(): void {
    this.modalMode = 'create';
    this.rutinaForm = {
      nombre: '',
      descripcion: '',
      tipo: 'entrenamiento',
      nivel: 'Intermedio', // Cambiar el valor por defecto
      duracion_estimada: 60,
      tags: [],
      status: 1
    };
    this.seccionesActivas.clear();
    this.error = '';
    this.showModal = true;
    this.showNivelSuggestions = false; // Asegurar que se cierre el dropdown
  }

  openEditModal(rutina: Rutina): void {
    this.modalMode = 'edit';
    this.selectedRutina = rutina;
    this.rutinaForm = JSON.parse(JSON.stringify(rutina)); // Deep copy
    
    // Identificar secciones activas
    this.seccionesActivas.clear();
    this.seccionesDisponibles.forEach(seccion => {
      if (this.getSeccionData(this.rutinaForm, seccion.key)) {
        this.seccionesActivas.add(seccion.key);
      }
    });
    
    this.error = '';
    this.showModal = true;
    this.showNivelSuggestions = false; // Asegurar que se cierre el dropdown
  }

  // Modal de vista independiente
  openViewModal(rutina: Rutina): void {
    console.log('Abriendo modal de vista para rutina:', rutina.nombre);
    this.selectedViewRutina = rutina;
    this.showViewModal = true;
  }

  closeViewModal(): void {
    console.log('Cerrando modal de vista');
    this.showViewModal = false;
    this.selectedViewRutina = null;
    this.copySuccess = false;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedRutina = null;
    this.error = '';
    this.seccionesActivas.clear();
    this.showNivelSuggestions = false; // Limpiar estado del dropdown
  }

  // NUEVOS MÉTODOS PARA MANEJO DEL DROPDOWN DE SUGERENCIAS
  selectNivelSugerencia(sugerencia: string): void {
    this.rutinaForm.nivel = sugerencia;
    this.showNivelSuggestions = false;
  }

  hideNivelSuggestions(): void {
    // Usar setTimeout para permitir que el click en la sugerencia funcione
    setTimeout(() => {
      this.showNivelSuggestions = false;
    }, 200);
  }

  // MÉTODO PARA VALIDAR EL NIVEL EN EL FORMULARIO
  private validateNivel(): boolean {
    if (!this.rutinaForm.nivel || !this.rutinaForm.nivel.trim()) {
      this.error = 'El nivel es requerido';
      return false;
    }
    
    // Validar longitud máxima
    if (this.rutinaForm.nivel.length > 50) {
      this.error = 'El nivel no puede exceder 50 caracteres';
      return false;
    }
    
    return true;
  }

  // MÉTODO MODIFICADO: saveRutina() con validación de nivel
  async saveRutina(): Promise<void> {
    try {
      this.error = '';

      // Validaciones existentes
      if (!this.rutinaForm.nombre.trim()) {
        this.error = 'El nombre es requerido';
        return;
      }

      // NUEVA VALIDACIÓN DE NIVEL
      if (!this.validateNivel()) {
        return;
      }

      if (this.seccionesActivas.size === 0) {
        this.error = 'Debe activar al menos una sección';
        return;
      }

      // Limpiar y normalizar el nivel
      this.rutinaForm.nivel = this.rutinaForm.nivel.trim();

      // Preparar datos para guardar
      const dataToSave = { ...this.rutinaForm };
      
      // Limpiar secciones no activas
      this.seccionesDisponibles.forEach(seccion => {
        if (!this.seccionesActivas.has(seccion.key)) {
          delete dataToSave[seccion.key];
        }
      });

      if (this.modalMode === 'create') {
        console.log('Creando rutina:', dataToSave);
        await this.supabaseService.insertData('rutinas', dataToSave);
      } else {
        dataToSave.updated_at = new Date().toISOString();
        console.log('Actualizando rutina:', dataToSave);
        await this.supabaseService.updateData('rutinas', this.selectedRutina!.id!.toString(), dataToSave);
      }

      await this.loadRutinas();
      this.closeModal();
    } catch (error) {
      console.error('Error guardando rutina:', error);
      this.error = 'Error al guardar la rutina';
    }
  }

  async deleteRutina(rutina: Rutina): Promise<void> {
    const confirmMessage = `¿Está seguro de eliminar la rutina "${rutina.nombre}"?`;
    if (confirm(confirmMessage)) {
      try {
        await this.supabaseService.updateData('rutinas', rutina.id!.toString(), { status: 0 });
        await this.loadRutinas();
      } catch (error) {
        console.error('Error eliminando rutina:', error);
        this.error = 'Error al eliminar la rutina';
      }
    }
  }

  async reactivateRutina(rutina: Rutina): Promise<void> {
    const confirmMessage = `¿Está seguro de reactivar la rutina "${rutina.nombre}"?`;
    if (confirm(confirmMessage)) {
      try {
        await this.supabaseService.updateData('rutinas', rutina.id!.toString(), { status: 1 });
        await this.loadRutinas();
      } catch (error) {
        console.error('Error reactivando rutina:', error);
        this.error = 'Error al reactivar la rutina';
      }
    }
  }

  // Gestión de secciones con métodos seguros para TypeScript
  toggleSeccion(seccionKey: string): void {
    if (this.seccionesActivas.has(seccionKey)) {
      this.seccionesActivas.delete(seccionKey);
      this.setSeccionData(this.rutinaForm, seccionKey, undefined);
    } else {
      this.seccionesActivas.add(seccionKey);
      this.setSeccionData(this.rutinaForm, seccionKey, {
        descripcion: '',
        ejercicios: []
      });
    }
  }

  isSeccionActiva(seccionKey: string): boolean {
    return this.seccionesActivas.has(seccionKey);
  }

  // Métodos auxiliares para acceso seguro a propiedades dinámicas
  getSeccionData(rutina: Rutina, seccionKey: string): SeccionRutina | undefined {
    return rutina[seccionKey] as SeccionRutina | undefined;
  }

  setSeccionData(rutina: Rutina, seccionKey: string, data: SeccionRutina | undefined): void {
    rutina[seccionKey] = data;
  }

  // Métodos auxiliares para manejar two-way binding de secciones
  updateSeccionDescripcion(seccionKey: string, event: any): void {
    const seccion = this.getSeccionData(this.rutinaForm, seccionKey);
    if (seccion) {
      seccion.descripcion = event.target.value;
    }
  }

  updateSeccionTiempoTotal(seccionKey: string, event: any): void {
    const seccion = this.getSeccionData(this.rutinaForm, seccionKey);
    if (seccion) {
      seccion.tiempo_total = event.target.value;
    }
  }

  updateSeccionSeries(seccionKey: string, event: any): void {
    const seccion = this.getSeccionData(this.rutinaForm, seccionKey);
    if (seccion) {
      seccion.series = parseInt(event.target.value) || undefined;
    }
  }

  updateSeccionTimeCap(seccionKey: string, event: any): void {
    const seccion = this.getSeccionData(this.rutinaForm, seccionKey);
    if (seccion) {
      seccion.time_cap = event.target.value;
    }
  }

  // Gestión de ejercicios
  addEjercicio(seccionKey: string): void {
    const seccion = this.getSeccionData(this.rutinaForm, seccionKey);
    if (seccion && seccion.ejercicios) {
      const nuevoEjercicio: Ejercicio = {
        orden: seccion.ejercicios.length + 1,
        nombre: '',
        tipo: 'funcional'
      };
      seccion.ejercicios.push(nuevoEjercicio);
    }
  }

  removeEjercicio(seccionKey: string, index: number): void {
    const seccion = this.getSeccionData(this.rutinaForm, seccionKey);
    if (seccion && seccion.ejercicios) {
      seccion.ejercicios.splice(index, 1);
      // Reordenar
      seccion.ejercicios.forEach((ejercicio, i) => {
        ejercicio.orden = i + 1;
      });
    }
  }

  // Gestión de tags
  addTag(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    
    if (value && event.key === 'Enter') {
      if (!this.rutinaForm.tags) {
        this.rutinaForm.tags = [];
      }
      if (!this.rutinaForm.tags.includes(value)) {
        this.rutinaForm.tags.push(value);
      }
      input.value = '';
      event.preventDefault();
    }
  }

  removeTag(index: number): void {
    if (this.rutinaForm.tags) {
      this.rutinaForm.tags.splice(index, 1);
    }
  }

  // Métodos de utilidad
  getSeccionNombre(key: string): string {
    const seccion = this.seccionesDisponibles.find(s => s.key === key);
    return seccion ? seccion.nombre : key;
  }

  getSeccionesConEjercicios(rutina: Rutina): SeccionConEjercicios[] {
    const secciones: SeccionConEjercicios[] = [];
    
    this.seccionesDisponibles.forEach(s => {
      const seccionData = this.getSeccionData(rutina, s.key);
      if (seccionData && seccionData.ejercicios && seccionData.ejercicios.length > 0) {
        secciones.push({
          key: s.key,
          nombre: s.nombre,
          seccion: seccionData
        });
      }
    });
    
    return secciones;
  }

  formatDuracion(minutos?: number): string {
    if (!minutos) return 'N/A';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
  }

  getTotalEjercicios(rutina: Rutina): number {
    let total = 0;
    this.seccionesDisponibles.forEach(s => {
      const seccionData = this.getSeccionData(rutina, s.key);
      if (seccionData && seccionData.ejercicios) {
        total += seccionData.ejercicios.length;
      }
    });
    return total;
  }

  onSearch(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  // MÉTODO MODIFICADO: clearFilters() con nivelFilter como string vacío
  clearFilters(): void {
    this.searchTerm = '';
    this.tipoFilter = 'all';
    this.nivelFilter = ''; // Cambio: de 'all' a string vacío
    this.statusFilter = 'active';
    this.applyFilters();
  }

  async refreshRutinas(): Promise<void> {
    await this.loadRutinas();
  }

  trackByRutinaId(index: number, rutina: Rutina): any {
    return rutina.id || index;
  }

  trackByEjercicioOrden(index: number, ejercicio: Ejercicio): any {
    return ejercicio.orden || index;
  }

  // Formatear rutina para el modal de vista
 // REEMPLAZA COMPLETAMENTE el método getFormattedRutina en rutinas.component.ts con este código:
getFormattedRutina(rutina: Rutina | null): string {
  console.log('🎨 Formateando rutina con NUEVO FORMATO (Admin):', rutina?.nombre); // Debug
  
  if (!rutina) return '';

  let texto = '';
  
  // =====================================
  // HEADER PRINCIPAL CON DISEÑO MEJORADO
  // =====================================
  texto += '╔' + '═'.repeat(78) + '╗\n';
  texto += '║' + `🏋️  ${rutina.nombre.toUpperCase()}`.padEnd(78) + '║\n';
  texto += '╚' + '═'.repeat(78) + '╝\n';
  
  texto += `${rutina.descripcion || 'Rutina de entrenamiento completa'}\n\n`;
  
  // Información básica con iconos
  const nivelText = `Nivel: ${rutina.nivel.toUpperCase()}`;
  const duracionText = `Duración: ${this.formatDuracion(rutina.duracion_estimada)}`;
  const tipoText = `Tipo: ${rutina.tipo.toUpperCase()}`;
  
  texto += `🎯 ${nivelText} | ⏱️  ${duracionText} | 📋 ${tipoText}\n\n`;
  
  // =====================================
  // PLAN DE ENTRENAMIENTO CON FORMATO MEJORADO
  // =====================================
  texto += '╔' + '═'.repeat(78) + '╗\n';
  texto += '║' + `💪 PLAN DE ENTRENAMIENTO`.padEnd(78) + '║\n';
  texto += '╚' + '═'.repeat(78) + '╝\n\n';

  // Iconos para cada sección - CORREGIDO CON TIPADO ADECUADO
  const iconosSecciones: { [key: string]: string } = {
    'warm_upg': '🌡️',
    'warm_up': '🔥',
    'met_con': '💨',
    'strength': '🏋️',
    'core': '🎯',
    'skill': '🎪',
    'extra': '✨'
  };

  // Procesar cada sección con formato mejorado
  const ordenSecciones = ['warm_upg', 'warm_up', 'met_con', 'strength', 'core', 'skill', 'extra'];
  
  let seccionesEncontradas = 0;
  
  ordenSecciones.forEach((sectionKey, index) => {
    const seccionInfo = this.seccionesDisponibles.find(s => s.key === sectionKey);
    const seccionData = this.getSeccionData(rutina, sectionKey);
    
    if (seccionData && seccionData.ejercicios && seccionData.ejercicios.length > 0 && seccionInfo) {
      seccionesEncontradas++;
      
      console.log(`📋 Procesando sección: ${seccionInfo.nombre}`); // Debug
      
      // Header de sección con icono
      const icono = iconosSecciones[sectionKey] || '📋';
      texto += '┌' + '─'.repeat(76) + '┐\n';
      texto += '│ ' + `${icono} ${seccionInfo.nombre.toUpperCase()}`.padEnd(75) + '│\n';
      texto += '└' + '─'.repeat(76) + '┘\n';
      
      // Descripción de la sección si existe
      if (seccionData.descripcion) {
        texto += `📝 ${seccionData.descripcion}\n`;
      }
      
      // Información adicional de la sección con iconos - CORREGIDAS LAS PROPIEDADES
      const infoAdicional = [];
      if (seccionData.tiempo_total) infoAdicional.push(`⏱️  Tiempo: ${seccionData.tiempo_total}`);
      if (seccionData.series) infoAdicional.push(`🔄 Series: ${seccionData.series}`);
      if (seccionData.time_cap) infoAdicional.push(`⏰ Time Cap: ${seccionData.time_cap}`);
      
      // Usar propiedades que existen en SeccionRutina o acceder de forma segura
      const seccionAny = seccionData as any;
      if (seccionAny.rest_between_exercises) infoAdicional.push(`⏸️  Descanso: ${seccionAny.rest_between_exercises}`);
      if (seccionAny.rest_between_sets) infoAdicional.push(`💤 Descanso series: ${seccionAny.rest_between_sets}`);
      
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
        if (ejercicio.cals) detalles.push(`🔢 ${ejercicio.cals} cals`);
        if (ejercicio.series) detalles.push(`🔄 ${ejercicio.series} series`);
        if (ejercicio.peso) detalles.push(`⚖️  ${ejercicio.peso}`);
        if (ejercicio.distancia) detalles.push(`📏 ${ejercicio.distancia}`);
        if (ejercicio.tiempo) detalles.push(`⏱️  ${ejercicio.tiempo}`);
        if (ejercicio.duracion) detalles.push(`⏳ ${ejercicio.duracion}`);
        
        if (detalles.length > 0) {
          texto += `    └─ ${detalles.join(' • ')}\n`;
        }
        
        // RPE si existe
        if (ejercicio.rpe) {
          texto += `    💪 RPE: ${ejercicio.rpe}/10\n`;
        } if (ejercicio.cals) {
          texto += `    💪 RPE: ${ejercicio.cals}/10\n`;
        }
        
        
        
        // Descanso si existe
        if (ejercicio.descanso) {
          texto += `    ⏸️  Descanso: ${ejercicio.descanso}\n`;
        }
        
        // Observaciones si existen
        if (ejercicio.observaciones) {
          texto += `    📝 ${ejercicio.observaciones}\n`;
        }
        
        // Notas adicionales si existen
        if (ejercicio.notas) {
          texto += `    💡 ${ejercicio.notas}\n`;
        }
        
        // Espaciado entre ejercicios
        if (ejercicioIndex < seccionData.ejercicios.length - 1) {
          texto += '\n';
        }
      });
      
      // Separador entre secciones
      if (index < ordenSecciones.length - 1 && seccionesEncontradas > 0) {
        texto += '\n' + '═'.repeat(78) + '\n\n';
      }
    }
  });

  // Si no se encontraron secciones con ejercicios
  if (seccionesEncontradas === 0) {
    console.log('⚠️ No se encontraron secciones con ejercicios'); // Debug
    texto += `┌${'─'.repeat(76)}┐\n`;
    texto += `│ ℹ️  RUTINA EN DESARROLLO${' '.repeat(51)}│\n`;
    texto += `└${'─'.repeat(76)}┘\n`;
    texto += `Esta rutina está siendo desarrollada.\n`;
    texto += `Los ejercicios serán agregados próximamente.\n\n`;
  }

  // =====================================
  // TAGS DE LA RUTINA
  // =====================================
  if (rutina.tags && rutina.tags.length > 0) {
    texto += `🏷️  Tags: ${rutina.tags.map((tag: string) => `#${tag}`).join(' ')}\n\n`;
  }

  // =====================================
  // FOOTER CON RESUMEN E INFORMACIÓN DEL SISTEMA
  // =====================================
  texto += '╔' + '═'.repeat(78) + '╗\n';
  texto += '║' + `📱 rehabiMovement - Sistema de Entrenamiento`.padEnd(78) + '║\n';
  texto += '╠' + '═'.repeat(78) + '╣\n';
  
  // Resumen de la rutina
  const totalEjercicios = this.getTotalEjercicios(rutina);
  texto += '║' + `📈 RESUMEN: ${totalEjercicios} ejercicios total`.padEnd(78) + '║\n';
  
  if (rutina.duracion_estimada) {
    texto += '║' + `⏱️  Duración estimada: ${this.formatDuracion(rutina.duracion_estimada)}`.padEnd(78) + '║\n';
  }
  
  texto += '║' + `📅 Generado: ${this.formatDate(new Date().toISOString())}`.padEnd(78) + '║\n';
  texto += '║' + `🆔 ID Rutina: ${rutina.id || 'N/A'}`.padEnd(78) + '║\n';
  texto += '║' + `👤 Creado por: Administrador del Sistema`.padEnd(78) + '║\n';
  
  texto += '╚' + '═'.repeat(78) + '╝\n';

  console.log('✅ Nuevo formato aplicado exitosamente!'); // Debug
  return texto;
}

// También necesitarás agregar este método helper si no lo tienes:
private formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    return 'Fecha inválida';
  }
}

  // Copiar al portapapeles
  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copySuccess = true;
      console.log('Texto copiado al portapapeles');
      
      // Mostrar mensaje temporal de éxito
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
      // Fallback para navegadores que no soporten clipboard API
      this.fallbackCopyTextToClipboard(text);
    }
  }

  // Fallback para copiar texto
  private fallbackCopyTextToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.copySuccess = true;
        setTimeout(() => {
          this.copySuccess = false;
        }, 2000);
      }
    } catch (err) {
      console.error('Fallback: Error al copiar al portapapeles:', err);
    }

    document.body.removeChild(textArea);
  }

  // Verificar permisos de visualización
  canViewRutina(): boolean {
    return this.authService.isAuthenticated();
  }

  // Verificar permisos de edición
  canEditRutina(): boolean {
    return this.authService.isAdmin() || this.authService.hasProfile(3); // Admin o Supervisor
  }

  // Exportar rutina como texto
  exportarRutina(rutina: Rutina): void {
    const texto = this.getFormattedRutina(rutina);
    
    // Crear y descargar archivo
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${rutina.nombre.replace(/\s+/g, '_')}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    console.log('Rutina exportada:', rutina.nombre);
  }

  // Obtener nombre de archivo para el modal
  getFileName(rutina: Rutina | null): string {
    if (!rutina || !rutina.nombre) {
      return 'rutina.txt';
    }
    return rutina.nombre.replace(/\s+/g, '_') + '.txt';
  }

  // MÉTODOS AUXILIARES ADICIONALES PARA NIVEL EDITABLE

  // Obtener niveles únicos existentes (útil para sugerencias dinámicas)
  getNivelesExistentes(): string[] {
    const niveles = new Set<string>();
    this.rutinas.forEach(rutina => {
      if (rutina.nivel && rutina.nivel.trim()) {
        niveles.add(rutina.nivel.trim());
      }
    });
    return Array.from(niveles).sort();
  }

  // Obtener estadísticas de niveles
  getEstadisticasNiveles(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    
    this.rutinas.forEach(rutina => {
      if (rutina.nivel && rutina.status === 1) {
        const nivel = rutina.nivel.trim();
        stats[nivel] = (stats[nivel] || 0) + 1;
      }
    });
    
    return stats;
  }

  // Actualizar sugerencias dinámicamente basadas en rutinas existentes
  updateNivelesSugeridos(): void {
    const nivelesExistentes = this.getNivelesExistentes();
    const sugerenciasBase = [
      'Principiante',
      'Intermedio', 
      'Avanzado',
      'CrossFit Rx',
      'CrossFit Scaled',
      'Elite',
      'Competencia',
      'Rehabilitación',
      'Adulto Mayor',
      'Juvenil',
      'Profesional',
      'Amateur'
    ];

    // Combinar sugerencias base con niveles existentes únicos
    const nivelesUnicos = new Set([...sugerenciasBase, ...nivelesExistentes]);
    this.nivelesSugeridos = Array.from(nivelesUnicos).sort();
  }
}