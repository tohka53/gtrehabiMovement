// src/app/calendario-asignacion-rutinas/calendario-asignacion-rutinas.component.ts
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

// Importar las interfaces desde el componente principal
export interface AsignacionCompleta {
  asignacion_id: number;
  rutina_nombre: string;
  rutina_descripcion?: string;
  fecha_inicio_programada: string;
  fecha_fin_programada: string;
  usuarios_count: number;
  estado_asignacion: string;
  asignado_por_nombre: string;
  fecha_asignacion: string;
  notas_asignacion?: string;
  status?: number;
  es_activa?: boolean;
}

export interface SeguimientoDetallado {
  seguimiento_id: number;
  asignacion_id: number;
  id_profile: number;
  username: string;
  full_name: string;
  progreso: number;
  estado_individual: string;
  fecha_inicio_real?: string;
  fecha_fin_real?: string;
  notas_individuales?: string;
}

export interface DiaCalendario {
  fecha: Date;
  esMesActual: boolean;
  esHoy: boolean;
  asignaciones: AsignacionCalendario[];
}

export interface AsignacionCalendario {
  asignacion: AsignacionCompleta;
  tipo: 'inicio' | 'fin' | 'en_curso';
  diasTranscurridos?: number;
  progreso?: number;
  usuariosCompletos?: number;
  seguimientos?: SeguimientoDetallado[];
}

@Component({
  selector: 'app-calendario-asignacion-rutinas',
  standalone: false,
  templateUrl: './calendario-asignacion-rutinas.component.html',
  styleUrls: ['./calendario-asignacion-rutinas.component.css']
})
export class CalendarioAsignacionRutinasComponent implements OnInit {
  @Input() asignaciones: AsignacionCompleta[] = [];
  @Output() verAsignacion = new EventEmitter<AsignacionCompleta>();
  @Output() editarAsignacion = new EventEmitter<AsignacionCompleta>();

  // Estado del calendario
  mesActual = new Date();
  diasCalendario: DiaCalendario[] = [];
  diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Control de UI
  loading = false;
  asignacionSeleccionada: AsignacionCompleta | null = null;
  showDetalleModal = false;
  seguimientosDetalle: SeguimientoDetallado[] = [];

  // Filtros del calendario
  filtroEstado = 'todas'; // 'todas', 'activas', 'completadas', 'vencidas'
  filtroRutina = 'todas';
  // Por defecto mostramos SOLO el día de inicio. Si el admin quiere ver también
  // los días intermedios y el día final, activa el toggle.
  mostrarPeriodoCompleto = false;
  // Alias retro-compatible: el HTML antiguo lo usaba como `mostrarSoloIniciosFines`.
  // (Cuando es true mostramos sólo inicios/fines; cuando es false, sólo inicios.)
  mostrarSoloIniciosFines = false;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    this.generarCalendario();
  }

  ngOnChanges(): void {
    // Regenerar calendario cuando cambien las asignaciones
    this.generarCalendario();
  }

  // =====================================
  // GENERACIÓN DEL CALENDARIO
  // =====================================

  generarCalendario(): void {
    console.log('🗓️ Generando calendario con', this.asignaciones.length, 'asignaciones');
    this.diasCalendario = [];

    const primerDiaMes = new Date(this.mesActual.getFullYear(), this.mesActual.getMonth(), 1);
    const ultimoDiaMes = new Date(this.mesActual.getFullYear(), this.mesActual.getMonth() + 1, 0);
    const hoy = new Date();

    // Días previos al mes actual para completar la primera semana
    const diasPrevios = primerDiaMes.getDay();
    for (let i = diasPrevios - 1; i >= 0; i--) {
      const fecha = new Date(primerDiaMes);
      fecha.setDate(fecha.getDate() - (i + 1));
      this.diasCalendario.push({
        fecha: new Date(fecha),
        esMesActual: false,
        esHoy: this.esMismaFecha(fecha, hoy),
        asignaciones: this.getAsignacionesDelDia(fecha)
      });
    }

    // Días del mes actual
    for (let dia = 1; dia <= ultimoDiaMes.getDate(); dia++) {
      const fecha = new Date(this.mesActual.getFullYear(), this.mesActual.getMonth(), dia);
      this.diasCalendario.push({
        fecha: new Date(fecha),
        esMesActual: true,
        esHoy: this.esMismaFecha(fecha, hoy),
        asignaciones: this.getAsignacionesDelDia(fecha)
      });
    }

    // Días posteriores para completar 42 celdas (6 semanas)
    const celdasRestantes = 42 - this.diasCalendario.length;
    for (let i = 1; i <= celdasRestantes; i++) {
      const fecha = new Date(ultimoDiaMes);
      fecha.setDate(fecha.getDate() + i);
      this.diasCalendario.push({
        fecha: new Date(fecha),
        esMesActual: false,
        esHoy: this.esMismaFecha(fecha, hoy),
        asignaciones: this.getAsignacionesDelDia(fecha)
      });
    }

    console.log('📊 Calendario generado con', this.diasCalendario.length, 'días');
  }

  // =====================================
  // LÓGICA DE ASIGNACIONES POR DÍA
  // =====================================

  // FIX bug "rutina se repite todos los días":
  // Antes la lógica era `fecha >= fechaInicio && fecha <= fechaFin` y por defecto
  // mostraba todos los días intermedios → la misma rutina se duplicaba en cada
  // celda del rango. Ahora por defecto mostramos SOLO el día de inicio.
  // El admin puede activar mostrarPeriodoCompleto si quiere ver el rango entero.
  // También usamos comparación de strings YYYY-MM-DD (sin new Date) para
  // evitar el shift de día por zona horaria en GMT-6.
  getAsignacionesDelDia(fecha: Date): AsignacionCalendario[] {
    const asignacionesDelDia: AsignacionCalendario[] = [];
    const fechaStr = this.formatDateForComparison(fecha);

    this.asignaciones.forEach(asignacion => {
      if (!this.cumpleFiltros(asignacion)) return;

      const fechaInicioStr = this.normalizarFecha(asignacion.fecha_inicio_programada);
      const fechaFinStr = this.normalizarFecha(asignacion.fecha_fin_programada);
      if (!fechaInicioStr || !fechaFinStr) return;

      const esInicio = fechaStr === fechaInicioStr;
      const esFin = fechaStr === fechaFinStr;
      const enRango = fechaStr >= fechaInicioStr && fechaStr <= fechaFinStr;

      let tipoEvento: 'inicio' | 'fin' | 'en_curso';
      if (esInicio) tipoEvento = 'inicio';
      else if (esFin) tipoEvento = 'fin';
      else tipoEvento = 'en_curso';

      // Modo por defecto: SÓLO el día de inicio
      if (!this.mostrarPeriodoCompleto && !this.mostrarSoloIniciosFines) {
        if (!esInicio) return;
      }
      // Modo "solo inicios y fines"
      else if (this.mostrarSoloIniciosFines && !this.mostrarPeriodoCompleto) {
        if (!esInicio && !esFin) return;
      }
      // Modo "período completo": cualquier día dentro del rango
      else {
        if (!enRango) return;
      }

      // Cálculos de progreso/días — sólo para tooltips, no afectan filtrado
      const diasTranscurridos = this.diasEntre(fechaInicioStr, fechaStr);
      const duracionTotal = this.diasEntre(fechaInicioStr, fechaFinStr) + 1;
      const progresoEstimado = duracionTotal > 0
        ? Math.min(100, Math.max(0, (diasTranscurridos / duracionTotal) * 100))
        : 0;

      asignacionesDelDia.push({
        asignacion,
        tipo: tipoEvento,
        diasTranscurridos,
        progreso: progresoEstimado
      });
    });

    return asignacionesDelDia.sort((a, b) => {
      // inicio primero, luego en_curso, luego fin
      const orden = { inicio: 1, en_curso: 2, fin: 3 };
      return orden[a.tipo] - orden[b.tipo];
    });
  }

  // Normaliza la fecha venga como string ("2026-04-27" o "2026-04-27T00:00:00+00:00")
  // o como Date — siempre devuelve YYYY-MM-DD sin pasar por new Date(string),
  // que en GMT-6 desplaza al día anterior.
  private normalizarFecha(valor: string | Date | null | undefined): string {
    if (!valor) return '';
    if (valor instanceof Date) return this.formatDateForComparison(valor);
    return String(valor).substring(0, 10);
  }

  // Días enteros entre dos fechas YYYY-MM-DD (sólo para tooltips)
  private diasEntre(desde: string, hasta: string): number {
    if (!desde || !hasta) return 0;
    const [y1, m1, d1] = desde.split('-').map(Number);
    const [y2, m2, d2] = hasta.split('-').map(Number);
    const a = new Date(y1, m1 - 1, d1).getTime();
    const b = new Date(y2, m2 - 1, d2).getTime();
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }

  cumpleFiltros(asignacion: AsignacionCompleta): boolean {
    // Filtro por estado
    if (this.filtroEstado !== 'todas') {
      switch (this.filtroEstado) {
        case 'activas':
          if (!asignacion.es_activa || asignacion.estado_asignacion !== 'activa') return false;
          break;
        case 'completadas':
          if (asignacion.estado_asignacion !== 'completada') return false;
          break;
        case 'vencidas':
          if (asignacion.es_activa) return false;
          break;
      }
    }

    // Filtro por rutina
    if (this.filtroRutina !== 'todas' && asignacion.rutina_nombre !== this.filtroRutina) {
      return false;
    }

    return true;
  }

  // =====================================
  // NAVEGACIÓN DEL CALENDARIO
  // =====================================

  mesAnterior(): void {
    this.mesActual = new Date(this.mesActual.getFullYear(), this.mesActual.getMonth() - 1, 1);
    this.generarCalendario();
  }

  mesSiguiente(): void {
    this.mesActual = new Date(this.mesActual.getFullYear(), this.mesActual.getMonth() + 1, 1);
    this.generarCalendario();
  }

  irAHoy(): void {
    this.mesActual = new Date();
    this.generarCalendario();
  }

  // =====================================
  // MANEJO DE EVENTOS
  // =====================================

  async onDiaClick(dia: DiaCalendario): Promise<void> {
    if (dia.asignaciones.length === 0) return;
    
    // Si hay una sola asignación, mostrar directamente
    if (dia.asignaciones.length === 1) {
      await this.verDetalleAsignacion(dia.asignaciones[0].asignacion);
    } else {
      // Si hay múltiples, mostrar lista para seleccionar
      this.mostrarListaAsignacionesDia(dia);
    }
  }

  mostrarListaAsignacionesDia(dia: DiaCalendario): void {
    const mensaje = dia.asignaciones.map((ac, index) => 
      `${index + 1}. ${ac.asignacion.rutina_nombre} (${ac.tipo}) - ${ac.asignacion.usuarios_count} usuarios`
    ).join('\n');

    const seleccion = prompt(`Seleccione una asignación (${dia.asignaciones.length} disponibles):\n\n${mensaje}\n\nIngrese el número (1-${dia.asignaciones.length}):`);
    
    if (seleccion) {
      const index = parseInt(seleccion) - 1;
      if (index >= 0 && index < dia.asignaciones.length) {
        this.verDetalleAsignacion(dia.asignaciones[index].asignacion);
      }
    }
  }

  async verDetalleAsignacion(asignacion: AsignacionCompleta): Promise<void> {
    this.asignacionSeleccionada = asignacion;
    await this.loadSeguimientoDetalle(asignacion.asignacion_id);
    this.showDetalleModal = true;
  }

  async loadSeguimientoDetalle(asignacionId: number): Promise<void> {
    try {
      this.loading = true;
      
      const { data, error } = await this.supabaseService.client
        .from('v_rutinas_asignadas_usuarios')
        .select('*')
        .eq('asignacion_id', asignacionId)
        .order('full_name');

      if (error) throw error;

      this.seguimientosDetalle = data || [];
    } catch (error) {
      console.error('Error cargando seguimiento:', error);
      this.seguimientosDetalle = [];
    } finally {
      this.loading = false;
    }
  }

  cerrarDetalleModal(): void {
    this.showDetalleModal = false;
    this.asignacionSeleccionada = null;
    this.seguimientosDetalle = [];
  }

  onVerCompleto(): void {
    if (this.asignacionSeleccionada) {
      this.verAsignacion.emit(this.asignacionSeleccionada);
      this.cerrarDetalleModal();
    }
  }

  // =====================================
  // UTILIDADES
  // =====================================

  formatDateForComparison(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  esMismaFecha(fecha1: Date, fecha2: Date): boolean {
    return this.formatDateForComparison(fecha1) === this.formatDateForComparison(fecha2);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getTipoEventoTexto(tipo: 'inicio' | 'fin' | 'en_curso'): string {
    const textos = {
      inicio: 'Inicia',
      fin: 'Termina',
      en_curso: 'En curso'
    };
    return textos[tipo];
  }

  getTipoEventoIcon(tipo: 'inicio' | 'fin' | 'en_curso'): string {
    const iconos = {
      inicio: 'fas fa-play-circle',
      fin: 'fas fa-stop-circle',
      en_curso: 'fas fa-clock'
    };
    return iconos[tipo];
  }

  getTipoEventoColor(tipo: 'inicio' | 'fin' | 'en_curso', estado?: string): string {
    if (estado === 'completada') return 'blue';
    if (estado === 'cancelada' || estado === 'expirada') return 'red';
    
    const colores = {
      inicio: 'green',
      fin: 'purple',
      en_curso: 'yellow'
    };
    return colores[tipo];
  }

  getEstadoColor(estado: string): string {
    const colores = {
      activa: 'green',
      completada: 'blue',
      pausada: 'yellow',
      cancelada: 'red',
      expirada: 'red'
    };
    return colores[estado as keyof typeof colores] || 'gray';
  }

  // Obtener rutinas únicas para el filtro
  get rutinasUnicas(): string[] {
    const rutinas = [...new Set(this.asignaciones.map(a => a.rutina_nombre))];
    return rutinas.sort();
  }

  // Contar asignaciones por estado para estadísticas
  getEstadisticasCalendario() {
    const stats = {
      total: this.asignaciones.length,
      activas: this.asignaciones.filter(a => a.es_activa && a.estado_asignacion === 'activa').length,
      completadas: this.asignaciones.filter(a => a.estado_asignacion === 'completada').length,
      vencidas: this.asignaciones.filter(a => !a.es_activa).length
    };
    return stats;
  }

  getDiasConAsignaciones(): number {
    return this.diasCalendario.filter(dia => dia.asignaciones.length > 0).length;
  }

  onFiltroChange(): void {
    this.generarCalendario();
  }

  // Cicla entre tres modos: solo-inicios → inicios+fines → período completo → solo-inicios
  toggleVistaCompleta(): void {
    if (!this.mostrarSoloIniciosFines && !this.mostrarPeriodoCompleto) {
      this.mostrarSoloIniciosFines = true;
      this.mostrarPeriodoCompleto = false;
    } else if (this.mostrarSoloIniciosFines && !this.mostrarPeriodoCompleto) {
      this.mostrarSoloIniciosFines = false;
      this.mostrarPeriodoCompleto = true;
    } else {
      this.mostrarSoloIniciosFines = false;
      this.mostrarPeriodoCompleto = false;
    }
    this.generarCalendario();
  }

  // Etiqueta del modo actual para el botón del toggle
  get vistaCompletaLabel(): string {
    if (this.mostrarPeriodoCompleto) return 'Período completo';
    if (this.mostrarSoloIniciosFines) return 'Inicios y fines';
    return 'Sólo inicios';
  }

  // Track by functions para optimización
  trackByFecha(index: number, item: DiaCalendario): any {
    return item.fecha.getTime();
  }

  trackByAsignacion(index: number, item: AsignacionCalendario): any {
    return item.asignacion.asignacion_id;
  }

  getTooltipText(asignacionCalendario: AsignacionCalendario): string {
    const asignacion = asignacionCalendario.asignacion;
    const tipo = this.getTipoEventoTexto(asignacionCalendario.tipo);
    return `${asignacion.rutina_nombre} - ${tipo} - ${asignacion.usuarios_count} usuarios - Estado: ${asignacion.estado_asignacion}`;
  }
}