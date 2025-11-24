// src/app/services/simple-rutinas.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SimpleRutinasService {

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {}

  /**
   * Obtiene las rutinas del usuario actual
   * Si es administrador (id_perfil = 1), obtiene TODAS las rutinas de TODOS los usuarios
   */
  async getRutinasUsuarioSimple(): Promise<any[]> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('Usuario no autenticado');
      }

      // Verificar si el usuario es administrador
      const esAdmin = currentUser.id_perfil === 1;

      console.log(`📋 Cargando rutinas. Usuario: ${currentUser.full_name}, Es Admin: ${esAdmin}`);

      let query = this.supabaseService.client
        .from('rutina_seguimiento_individual')
        .select(`
          id,
          id_asignacion_masiva,
          id_profile,
          id_rutina,
          progreso,
          estado_individual,
          fecha_inicio_real,
          fecha_fin_real,
          notas_individuales,
          rutina_asignaciones_masivas!inner(
            fecha_inicio,
            fecha_fin,
            estado,
            notas,
            status
          ),
          rutinas!inner(
            id,
            nombre,
            descripcion,
            tipo,
            nivel,
            duracion_estimada,
            warm_up,
            met_con,
            strength,
            core,
            extra,
            tags,
            status
          ),
          profiles!inner(
            id,
            username,
            full_name
          )
        `);

      // Si NO es administrador, filtrar solo sus rutinas
      if (!esAdmin) {
        query = query.eq('id_profile', currentUser.id);
      }

      // Aplicar filtros comunes
      const { data: seguimientos, error } = await query
        .eq('rutina_asignaciones_masivas.status', 1)
        .eq('rutinas.status', 1)
        .order('id', { ascending: false });

      if (error) throw error;

      console.log(`✅ Rutinas cargadas: ${seguimientos?.length || 0}`);

      return seguimientos || [];
    } catch (error) {
      console.error('❌ Error obteniendo rutinas del usuario:', error);
      return [];
    }
  }

  /**
   * Obtiene todas las rutinas de un usuario específico
   * Solo para administradores
   */
  async getRutinasPorUsuario(usuarioId: number): Promise<any[]> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('Usuario no autenticado');
      }

      // Verificar si el usuario es administrador
      const esAdmin = currentUser.id_perfil === 1;
      if (!esAdmin) {
        console.warn('⚠️ Solo administradores pueden consultar rutinas de otros usuarios');
        return [];
      }

      const { data: seguimientos, error } = await this.supabaseService.client
        .from('rutina_seguimiento_individual')
        .select(`
          id,
          id_asignacion_masiva,
          id_profile,
          id_rutina,
          progreso,
          estado_individual,
          fecha_inicio_real,
          fecha_fin_real,
          notas_individuales,
          rutina_asignaciones_masivas!inner(
            fecha_inicio,
            fecha_fin,
            estado,
            notas,
            status
          ),
          rutinas!inner(
            id,
            nombre,
            descripcion,
            tipo,
            nivel,
            duracion_estimada,
            warm_up,
            met_con,
            strength,
            core,
            extra,
            tags,
            status
          ),
          profiles!inner(
            id,
            username,
            full_name
          )
        `)
        .eq('id_profile', usuarioId)
        .eq('rutina_asignaciones_masivas.status', 1)
        .eq('rutinas.status', 1)
        .order('id', { ascending: false });

      if (error) throw error;

      return seguimientos || [];
    } catch (error) {
      console.error('❌ Error obteniendo rutinas del usuario específico:', error);
      return [];
    }
  }

  async actualizarProgresoSimple(seguimientoId: number, progreso: number): Promise<boolean> {
    try {
      const updateData: any = {
        progreso: progreso,
        updated_at: new Date().toISOString()
      };

      // Determinar estado basado en progreso
      if (progreso === 0) {
        updateData.estado_individual = 'pendiente';
      } else if (progreso < 100) {
        updateData.estado_individual = 'en_progreso';
        
        // Si no tiene fecha de inicio, agregarla
        const { data: current } = await this.supabaseService.client
          .from('rutina_seguimiento_individual')
          .select('fecha_inicio_real')
          .eq('id', seguimientoId)
          .single();

        if (current && !current.fecha_inicio_real) {
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
      return true;
    } catch (error) {
      console.error('Error actualizando progreso:', error);
      return false;
    }
  }

  calcularEstadoTemporal(fechaInicio: string, fechaFin: string): {
    estado: 'vigente' | 'pendiente' | 'vencida';
    diasRestantes: number;
  } {
    const hoy = new Date();
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    let estado: 'vigente' | 'pendiente' | 'vencida';
    if (hoy < inicio) {
      estado = 'pendiente';
    } else if (hoy > fin) {
      estado = 'vencida';
    } else {
      estado = 'vigente';
    }

    const diasRestantes = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 3600 * 24));

    return { estado, diasRestantes };
  }

  /**
   * Verifica si el usuario actual es administrador
   */
  esAdministrador(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.id_perfil === 1;
  }
}