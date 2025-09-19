// src/app/rutinas-usuario/rutinas-usuario.component.ts
import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { Profile } from '../../interfaces/user.interfaces';
import { Rutina } from '../../interfaces/rutinas.interfaces';

export interface AsignacionMasiva {
  id?: number;
  id_rutina: number;
  usuarios_asignados: number[];
  asignado_por: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: string;
  notas?: string;
  created_at?: string;
  updated_at?: string;
  status?: number;
}

export interface SeguimientoIndividual {
  id?: number;
  id_asignacion_masiva: number;
  id_profile: number;
  id_rutina: number;
  progreso: number;
  estado_individual: string;
  fecha_inicio_real?: string;
  fecha_fin_real?: string;
  notas_individuales?: string;
  created_at?: string;
  updated_at?: string;
}

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

// NUEVA INTERFACE: Para manejar múltiples asignaciones
export interface AsignacionRutina {
  id: number; // ID único temporal para el formulario
  id_rutina: number;
  fecha_inicio: string;
  duracion_dias: number;
  notas: string;
  rutina_nombre?: string; // Para mostrar en la UI
}

@Component({
  selector: 'app-rutinas-usuario',
  standalone: false,
  templateUrl: './rutinas-usuario.component.html',
  styleUrls: ['./rutinas-usuario.component.css']
})
export class RutinasUsuarioComponent implements OnInit {
  // Datos principales
  rutinas: Rutina[] = [];
  usuarios: Profile[] = [];
  asignaciones: AsignacionCompleta[] = [];
  
  // Control de UI
  loading = false;
  error = '';
  showAsignarModal = false;
  showVerModal = false;
  selectedAsignacion: AsignacionCompleta | null = null;
  seguimientoDetalle: any[] = [];

  // NUEVA FUNCIONALIDAD: Formulario de múltiples asignaciones
  asignacionesRutinas: AsignacionRutina[] = [];
  usuarios_seleccionados: number[] = [];
  nextTempId = 1; // Para generar IDs únicos temporales

  // Opciones de duración predefinidas
  duracionesDisponibles = [
    { dias: 7, label: '1 semana' },
    { dias: 14, label: '2 semanas' },
    { dias: 21, label: '3 semanas' },
    { dias: 30, label: '1 mes' },
    { dias: 45, label: '1.5 meses' },
    { dias: 60, label: '2 meses' },
    { dias: 90, label: '3 meses' }
  ];

  // Filtros y búsqueda
  searchTerm = '';
  estadoFilter = 'all';
  rutinaFilter = 'all';
  mostrarInactivas = true;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadInitialData();
    await this.procesarAsignacionesVencidas();
  }

  async loadInitialData(): Promise<void> {
    this.loading = true;
    try {
      await Promise.all([
        this.loadRutinas(),
        this.loadUsuarios(),
        this.loadAsignaciones()
      ]);
    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
      this.error = 'Error al cargar los datos';
    } finally {
      this.loading = false;
    }
  }

  async loadRutinas(): Promise<void> {
    try {
      const data = await this.supabaseService.getData('rutinas');
      this.rutinas = data?.filter(r => r.status === 1) || [];
    } catch (error) {
      console.error('Error cargando rutinas:', error);
    }
  }

  async loadUsuarios(): Promise<void> {
    try {
      const data = await this.supabaseService.getData('profiles');
      this.usuarios = data?.filter(u => u.status === 1) || [];
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  }

  async loadAsignaciones(): Promise<void> {
    try {
      let query = this.supabaseService.client
        .from('rutina_asignaciones_masivas')
        .select(`
          id,
          id_rutina,
          usuarios_asignados,
          fecha_inicio,
          fecha_fin,
          estado,
          notas,
          created_at,
          status,
          rutinas(nombre, descripcion),
          profiles!rutina_asignaciones_masivas_asignado_por_fkey(full_name)
        `);

      if (!this.mostrarInactivas) {
        query = query.eq('status', 1);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      this.asignaciones = (data || []).map((item: any) => {
        const fechaFin = new Date(item.fecha_fin);
        const hoy = new Date();
        const esActiva = item.status === 1 && fechaFin >= hoy;

        return {
          asignacion_id: item.id,
          rutina_nombre: item.rutinas?.nombre || 'Rutina no encontrada',
          rutina_descripcion: item.rutinas?.descripcion || '',
          fecha_inicio_programada: item.fecha_inicio,
          fecha_fin_programada: item.fecha_fin,
          usuarios_count: item.usuarios_asignados?.length || 0,
          estado_asignacion: item.estado,
          asignado_por_nombre: item.profiles?.full_name || 'Usuario no encontrado',
          fecha_asignacion: item.created_at,
          notas_asignacion: item.notas,
          status: item.status,
          es_activa: esActiva
        };
      });

    } catch (error) {
      console.error('Error cargando asignaciones:', error);
      await this.loadAsignacionesAlternativo();
    }
  }

  async loadAsignacionesAlternativo(): Promise<void> {
    try {
      const [asignacionesData, rutinasData, usuariosData] = await Promise.all([
        this.supabaseService.getData('rutina_asignaciones_masivas'),
        this.supabaseService.getData('rutinas'),
        this.supabaseService.getData('profiles')
      ]);

      let asignacionesFiltradas = asignacionesData || [];
      
      if (!this.mostrarInactivas) {
        asignacionesFiltradas = asignacionesFiltradas.filter(a => a.status === 1);
      }

      this.asignaciones = asignacionesFiltradas.map((item: any) => {
        const rutina = rutinasData?.find(r => r.id === item.id_rutina);
        const asignador = usuariosData?.find(u => u.id === item.asignado_por);
        
        const fechaFin = new Date(item.fecha_fin);
        const hoy = new Date();
        const esActiva = item.status === 1 && fechaFin >= hoy;

        return {
          asignacion_id: item.id,
          rutina_nombre: rutina?.nombre || 'Rutina no encontrada',
          rutina_descripcion: rutina?.descripcion || '',
          fecha_inicio_programada: item.fecha_inicio,
          fecha_fin_programada: item.fecha_fin,
          usuarios_count: item.usuarios_asignados?.length || 0,
          estado_asignacion: item.estado,
          asignado_por_nombre: asignador?.full_name || 'Usuario no encontrado',
          fecha_asignacion: item.created_at,
          notas_asignacion: item.notas,
          status: item.status,
          es_activa: esActiva
        };
      });

    } catch (error) {
      console.error('Error en método alternativo:', error);
      this.asignaciones = [];
    }
  }

  async procesarAsignacionesVencidas(): Promise<void> {
    try {
      const hoy = new Date();
      const fechaHoy = hoy.toISOString().split('T')[0];

      const { data: asignacionesVencidas, error } = await this.supabaseService.client
        .from('rutina_asignaciones_masivas')
        .select('id')
        .eq('status', 1)
        .lt('fecha_fin', fechaHoy);

      if (error) {
        console.error('Error buscando asignaciones vencidas:', error);
        return;
      }

      if (asignacionesVencidas && asignacionesVencidas.length > 0) {
        const idsVencidas = asignacionesVencidas.map(a => a.id);
        
        const { error: updateError } = await this.supabaseService.client
          .from('rutina_asignaciones_masivas')
          .update({ 
            status: 0,
            estado: 'expirada',
            updated_at: new Date().toISOString()
          })
          .in('id', idsVencidas);

        if (updateError) {
          console.error('Error actualizando asignaciones vencidas:', updateError);
        } else {
          console.log(`${idsVencidas.length} asignaciones marcadas como vencidas`);
        }
      }
    } catch (error) {
      console.error('Error procesando asignaciones vencidas:', error);
    }
  }

  // ==============================================
  // NUEVAS FUNCIONES PARA MÚLTIPLES ASIGNACIONES
  // ==============================================

  openAsignarModal(): void {
    // Reiniciar formulario
    this.asignacionesRutinas = [];
    this.usuarios_seleccionados = [];
    this.nextTempId = 1;
    this.error = '';
    
    // Agregar primera asignación por defecto
    this.agregarNuevaAsignacion();
    this.showAsignarModal = true;
  }

  closeAsignarModal(): void {
    this.showAsignarModal = false;
    this.error = '';
    this.asignacionesRutinas = [];
    this.usuarios_seleccionados = [];
  }

  agregarNuevaAsignacion(): void {
    const nuevaAsignacion: AsignacionRutina = {
      id: this.nextTempId++,
      id_rutina: 0,
      fecha_inicio: this.getTomorrowDate(),
      duracion_dias: 30, // Por defecto 1 mes
      notas: '',
      rutina_nombre: ''
    };

    this.asignacionesRutinas.push(nuevaAsignacion);
  }

  eliminarAsignacion(tempId: number): void {
    this.asignacionesRutinas = this.asignacionesRutinas.filter(a => a.id !== tempId);
  }

  onRutinaChange(asignacion: AsignacionRutina): void {
    const rutina = this.rutinas.find(r => r.id === asignacion.id_rutina);
    asignacion.rutina_nombre = rutina?.nombre || '';
  }

  calcularFechaFin(fechaInicio: string, duracionDias: number): string {
    if (!fechaInicio) return '';
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + duracionDias);
    return fecha.toISOString().split('T')[0];
  }

  toggleUsuario(userId: number): void {
    const index = this.usuarios_seleccionados.indexOf(userId);
    if (index > -1) {
      this.usuarios_seleccionados.splice(index, 1);
    } else {
      this.usuarios_seleccionados.push(userId);
    }
  }

  isUsuarioSelected(userId: number): boolean {
    return this.usuarios_seleccionados.includes(userId);
  }

  selectAllUsuarios(): void {
    this.usuarios_seleccionados = this.usuarios.map(u => u.id!);
  }

  clearAllUsuarios(): void {
    this.usuarios_seleccionados = [];
  }

  async asignarRutinas(): Promise<void> {
    try {
      this.error = '';
      
      // Validaciones
      if (this.asignacionesRutinas.length === 0) {
        this.error = 'Debe agregar al menos una rutina';
        return;
      }

      if (this.usuarios_seleccionados.length === 0) {
        this.error = 'Debe seleccionar al menos un usuario';
        return;
      }

      // Validar cada asignación
      for (let i = 0; i < this.asignacionesRutinas.length; i++) {
        const asignacion = this.asignacionesRutinas[i];
        if (!asignacion.id_rutina) {
          this.error = `Debe seleccionar una rutina para la asignación ${i + 1}`;
          return;
        }
        if (!asignacion.fecha_inicio) {
          this.error = `Debe especificar la fecha de inicio para la asignación ${i + 1}`;
          return;
        }
      }

      this.loading = true;
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('Usuario no autenticado');
      }

      const asignacionesCreadas: number[] = [];

      // Procesar cada asignación de rutina
      for (const asignacionRutina of this.asignacionesRutinas) {
        const fechaFin = this.calcularFechaFin(asignacionRutina.fecha_inicio, asignacionRutina.duracion_dias);
        
        try {
          // Intentar usar la función RPC primero
          const { data, error } = await this.supabaseService.client
            .rpc('asignar_rutina_a_usuarios', {
              p_id_rutina: asignacionRutina.id_rutina,
              p_usuarios_ids: this.usuarios_seleccionados,
              p_asignado_por: currentUser.id,
              p_fecha_inicio: asignacionRutina.fecha_inicio,
              p_fecha_fin: fechaFin,
              p_notas: asignacionRutina.notas || null
            });

          if (error) throw error;
          asignacionesCreadas.push(data);

        } catch (rpcError) {
          console.log('Función RPC no disponible, usando método manual para rutina:', asignacionRutina.rutina_nombre);
          
          // Método manual
          const asignacionData = {
            id_rutina: asignacionRutina.id_rutina,
            usuarios_asignados: this.usuarios_seleccionados,
            asignado_por: currentUser.id,
            fecha_inicio: asignacionRutina.fecha_inicio,
            fecha_fin: fechaFin,
            notas: asignacionRutina.notas || null,
            estado: 'activa'
          };

          const { data: asignacion, error: asignacionError } = await this.supabaseService.client
            .from('rutina_asignaciones_masivas')
            .insert(asignacionData)
            .select()
            .single();

          if (asignacionError) throw asignacionError;

          const seguimientosData = this.usuarios_seleccionados.map(userId => ({
            id_asignacion_masiva: asignacion.id,
            id_profile: userId,
            id_rutina: asignacionRutina.id_rutina,
            progreso: 0,
            estado_individual: 'pendiente'
          }));

          const { error: seguimientoError } = await this.supabaseService.client
            .from('rutina_seguimiento_individual')
            .insert(seguimientosData);

          if (seguimientoError) throw seguimientoError;
          
          asignacionesCreadas.push(asignacion.id);
        }
      }

      console.log('Rutinas asignadas exitosamente:', asignacionesCreadas);

      await this.loadAsignaciones();
      this.closeAsignarModal();

      const mensaje = `Se asignaron ${this.asignacionesRutinas.length} rutinas exitosamente a ${this.usuarios_seleccionados.length} usuarios:\n` +
        this.asignacionesRutinas.map(a => `• ${a.rutina_nombre} (${a.duracion_dias} días)`).join('\n');
      
      alert(mensaje);

    } catch (error) {
      console.error('Error asignando rutinas:', error);
      this.error = error instanceof Error ? error.message : 'Error al asignar las rutinas';
    } finally {
      this.loading = false;
    }
  }

  // Método para obtener el resumen de asignaciones
  getResumenAsignaciones(): string {
    if (this.asignacionesRutinas.length === 0) return '';
    
    const rutinasSeleccionadas = this.asignacionesRutinas
      .filter(a => a.id_rutina > 0)
      .map(a => a.rutina_nombre || this.getRutinaNombre(a.id_rutina));

    return `${this.asignacionesRutinas.length} rutinas seleccionadas: ${rutinasSeleccionadas.join(', ')}`;
  }

  // Calcular duración total del programa
  getDuracionTotalPrograma(): number {
    if (this.asignacionesRutinas.length === 0) return 0;
    
    // Encontrar la fecha de inicio más temprana y la fecha de fin más tardía
    let fechaInicioMin = this.asignacionesRutinas[0]?.fecha_inicio;
    let fechaFinMax = '';

    this.asignacionesRutinas.forEach(asignacion => {
      if (asignacion.fecha_inicio < fechaInicioMin) {
        fechaInicioMin = asignacion.fecha_inicio;
      }
      
      const fechaFin = this.calcularFechaFin(asignacion.fecha_inicio, asignacion.duracion_dias);
      if (fechaFin > fechaFinMax) {
        fechaFinMax = fechaFin;
      }
    });

    if (!fechaInicioMin || !fechaFinMax) return 0;

    const inicio = new Date(fechaInicioMin);
    const fin = new Date(fechaFinMax);
    const diffTime = fin.getTime() - inicio.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // ==============================================
  // FUNCIONES EXISTENTES (mantenidas)
  // ==============================================

  async openVerModal(asignacion: AsignacionCompleta): Promise<void> {
    this.selectedAsignacion = asignacion;
    await this.loadSeguimientoDetalle(asignacion.asignacion_id);
    this.showVerModal = true;
  }

  closeVerModal(): void {
    this.showVerModal = false;
    this.selectedAsignacion = null;
    this.seguimientoDetalle = [];
  }

  async loadSeguimientoDetalle(asignacionId: number): Promise<void> {
    try {
      const { data: viaVista, error: errorVista } = await this.supabaseService.client
        .from('v_rutinas_asignadas_usuarios')
        .select('*')
        .eq('asignacion_id', asignacionId)
        .order('full_name');

      if (!errorVista && viaVista) {
        this.seguimientoDetalle = viaVista;
        return;
      }

      const { data: seguimientos, error: errorSeguimientos } = await this.supabaseService.client
        .from('rutina_seguimiento_individual')
        .select(`
          id,
          id_asignacion_masiva,
          id_profile,
          progreso,
          estado_individual,
          fecha_inicio_real,
          fecha_fin_real,
          notas_individuales,
          profiles(username, full_name)
        `)
        .eq('id_asignacion_masiva', asignacionId);

      if (errorSeguimientos) throw errorSeguimientos;

      this.seguimientoDetalle = (seguimientos || []).map((item: any) => ({
        seguimiento_id: item.id,
        asignacion_id: item.id_asignacion_masiva,
        id_profile: item.id_profile,
        username: item.profiles?.username || 'N/A',
        full_name: item.profiles?.full_name || 'Usuario no encontrado',
        progreso: item.progreso,
        estado_individual: item.estado_individual,
        fecha_inicio_real: item.fecha_inicio_real,
        fecha_fin_real: item.fecha_fin_real,
        notas_individuales: item.notas_individuales
      }));

    } catch (error) {
      console.error('Error cargando seguimiento detalle:', error);
      this.seguimientoDetalle = [];
    }
  }

  async cancelarAsignacion(asignacionId: number): Promise<void> {
    const confirmar = confirm('¿Está seguro de cancelar esta asignación? Esta acción afectará a todos los usuarios asignados.');
    
    if (confirmar) {
      try {
        const { error } = await this.supabaseService.client
          .from('rutina_asignaciones_masivas')
          .update({ 
            estado: 'cancelada',
            status: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', asignacionId);

        if (error) throw error;

        await this.loadAsignaciones();
        alert('Asignación cancelada exitosamente');
      } catch (error) {
        console.error('Error cancelando asignación:', error);
        alert('Error al cancelar la asignación');
      }
    }
  }

  async actualizarProgreso(seguimientoId: number, event: any): Promise<void> {
    try {
      const nuevoProgreso = parseInt(event.target?.value || event) || 0;
      
      if (nuevoProgreso < 0 || nuevoProgreso > 100) {
        alert('El progreso debe estar entre 0 y 100');
        return;
      }

      const updateData: any = {
        progreso: nuevoProgreso,
        updated_at: new Date().toISOString()
      };

      if (nuevoProgreso === 0) {
        updateData.estado_individual = 'pendiente';
      } else if (nuevoProgreso < 100) {
        updateData.estado_individual = 'en_progreso';
        const seguimiento = this.seguimientoDetalle.find(s => s.seguimiento_id === seguimientoId);
        if (seguimiento && !seguimiento.fecha_inicio_real) {
          updateData.fecha_inicio_real = new Date().toISOString().split('T')[0];
        }
      } else {
        updateData.estado_individual = 'completada';
        updateData.fecha_fin_real = new Date().toISOString().split('T')[0];
      }

      const { error } = await this.supabaseService.client
        .from('rutina_seguimiento_individual')
        .update(updateData)
        .eq('id', seguimientoId);

      if (error) throw error;

      if (this.selectedAsignacion) {
        await this.loadSeguimientoDetalle(this.selectedAsignacion.asignacion_id);
      }

    } catch (error) {
      console.error('Error actualizando progreso:', error);
      alert('Error al actualizar el progreso');
    }
  }

  async editarNotasIndividuales(seguimiento: any): Promise<void> {
    const nuevasNotas = prompt('Ingrese las notas para este usuario:', seguimiento.notas_individuales || '');
    
    if (nuevasNotas !== null) {
      try {
        const { error } = await this.supabaseService.client
          .from('rutina_seguimiento_individual')
          .update({ 
            notas_individuales: nuevasNotas,
            updated_at: new Date().toISOString()
          })
          .eq('id', seguimiento.seguimiento_id);

        if (error) throw error;

        if (this.selectedAsignacion) {
          await this.loadSeguimientoDetalle(this.selectedAsignacion.asignacion_id);
        }

      } catch (error) {
        console.error('Error actualizando notas:', error);
        alert('Error al actualizar las notas');
      }
    }
  }

  getEstadisticasProgreso(): any {
    if (!this.seguimientoDetalle || this.seguimientoDetalle.length === 0) {
      return {
        pendientes: 0,
        enProgreso: 0,
        completadas: 0,
        promedioProgreso: 0
      };
    }

    const pendientes = this.seguimientoDetalle.filter(s => s.estado_individual === 'pendiente').length;
    const enProgreso = this.seguimientoDetalle.filter(s => s.estado_individual === 'en_progreso').length;
    const completadas = this.seguimientoDetalle.filter(s => s.estado_individual === 'completada').length;
    
    const totalProgreso = this.seguimientoDetalle.reduce((sum, s) => sum + (s.progreso || 0), 0);
    const promedioProgreso = Math.round(totalProgreso / this.seguimientoDetalle.length);

    return {
      pendientes,
      enProgreso,
      completadas,
      promedioProgreso
    };
  }

  async toggleMostrarInactivas(): Promise<void> {
    this.mostrarInactivas = !this.mostrarInactivas;
    await this.loadAsignaciones();
  }

  // Métodos de utilidad
  getRutinaNombre(rutinaId: number): string {
    const rutina = this.rutinas.find(r => r.id === rutinaId);
    return rutina?.nombre || 'Rutina no encontrada';
  }

  getUserName(userId: number): string {
    const user = this.usuarios.find(u => u.id === userId);
    return user?.full_name || user?.username || 'Usuario no encontrado';
  }

  getEstadoColor(estado: string, esActiva: boolean = true): string {
    if (!esActiva) return 'gray';
    
    switch (estado) {
      case 'activa': return 'green';
      case 'completada': return 'blue';
      case 'pausada': return 'yellow';
      case 'cancelada': case 'expirada': return 'red';
      default: return 'gray';
    }
  }

  getEstadoIcon(estado: string): string {
    switch (estado) {
      case 'activa': return 'fas fa-play-circle';
      case 'completada': return 'fas fa-check-circle';
      case 'pausada': return 'fas fa-pause-circle';
      case 'cancelada': return 'fas fa-times-circle';
      case 'expirada': return 'fas fa-clock';
      default: return 'fas fa-circle';
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  getDiasRestantes(fechaFin: string): number {
    const fin = new Date(fechaFin);
    const hoy = new Date();
    const diffTime = fin.getTime() - hoy.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isVencida(fechaFin: string): boolean {
    return this.getDiasRestantes(fechaFin) < 0;
  }

  get filteredAsignaciones(): AsignacionCompleta[] {
    let filtered = [...this.asignaciones];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.rutina_nombre.toLowerCase().includes(term) ||
        a.asignado_por_nombre.toLowerCase().includes(term)
      );
    }

    if (this.estadoFilter !== 'all') {
      filtered = filtered.filter(a => a.estado_asignacion === this.estadoFilter);
    }

    if (this.rutinaFilter !== 'all') {
      filtered = filtered.filter(a => a.rutina_nombre === this.rutinaFilter);
    }

    return filtered;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.estadoFilter = 'all';
    this.rutinaFilter = 'all';
  }

  async refreshData(): Promise<void> {
    await this.procesarAsignacionesVencidas();
    await this.loadAsignaciones();
  }

  canAssignRoutines(): boolean {
    return this.authService.isAdmin() || this.authService.hasProfile(3);
  }

  trackByAsignacionId(index: number, item: AsignacionCompleta): any {
    return item.asignacion_id;
  }

  trackByUserId(index: number, item: Profile): any {
    return item.id;
  }

  trackByRutinaId(index: number, item: Rutina): any {
    return item.id;
  }

  trackByTempId(index: number, item: AsignacionRutina): any {
    return item.id;
  }
}