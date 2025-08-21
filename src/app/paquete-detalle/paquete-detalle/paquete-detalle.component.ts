import { Component, OnInit, OnDestroy} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaquetesService } from '../../services/paquetes.service';
import { Paquete } from '../../interfaces/paquetes.interfaces';
import { CommonModule, TitleCasePipe, SlicePipe, DatePipe, CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-paquete-detalle',
  standalone: false,
  templateUrl: './paquete-detalle.component.html',
  styleUrls: ['./paquete-detalle.component.css']
})
export class PaqueteDetalleComponent implements OnInit, OnDestroy {

  // ================================
  // PROPIEDADES CON TIPOS EXPLÍCITOS
  // ================================
  paquete: Paquete | null = null;
  cargando = false;
  error: string | null = null;
  paqueteId: number;

  // Estados del componente
  mostrarModalEliminar = false;
  mostrarModalActivar = false;
  procesandoAccion = false;

  // Datos calculados
  ahorroTotal = 0;
  preciosPorSesion = {
    base: 0,
    final: 0
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paquetesService: PaquetesService
  ) {
    this.paqueteId = parseInt(this.route.snapshot.paramMap.get('id') || '0');
  }

  ngOnInit(): void {
    if (this.paqueteId > 0) {
      this.cargarPaquete();
    } else {
      this.error = 'ID de paquete inválido';
    }
  }

  ngOnDestroy(): void {
    this.cancelarEliminacion();
    this.cancelarActivacion();
  }

  // ================================
  // MÉTODOS CON VERIFICACIONES DE NULL
  // ================================

  async cargarPaquete(): Promise<void> {
    this.cargando = true;
    this.error = null;

    try {
      this.paquete = await this.paquetesService.obtenerPaquetePorId(this.paqueteId);
      
      if (!this.paquete) {
        this.error = 'Paquete no encontrado';
      } else {
        this.calcularDatosAdicionales();
      }
    } catch (error) {
      console.error('Error cargando paquete:', error);
      this.error = 'Error al cargar el paquete. Por favor, intenta de nuevo.';
    } finally {
      this.cargando = false;
    }
  }

  private calcularDatosAdicionales(): void {
    if (!this.paquete) return;

    this.ahorroTotal = (this.paquete.precio || 0) - (this.paquete.precio_final || this.paquete.precio || 0);

    this.preciosPorSesion = {
      base: (this.paquete.precio || 0) / (this.paquete.cantidad_sesiones || 1),
      final: (this.paquete.precio_final || this.paquete.precio || 0) / (this.paquete.cantidad_sesiones || 1)
    };
  }

  // ================================
  // MÉTODOS DE UTILIDAD CON VERIFICACIONES
  // ================================

  obtenerIconoStatus(status: number | null | undefined): string {
    if (status === null || status === undefined) return '❓';
    return status === 1 ? '✓' : '✗';
  }

  obtenerTextoStatus(status: number | null | undefined): string {
    if (status === null || status === undefined) return 'Desconocido';
    return status === 1 ? 'Activo' : 'Inactivo';
  }

  obtenerClaseStatus(status: number | null | undefined): string {
    if (status === null || status === undefined) {
      return 'bg-gray-100 text-gray-800 border-gray-200';
    }
    return status === 1 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-red-100 text-red-800 border-red-200';
  }

  obtenerIconoTipo(tipo: string | null | undefined): string {
    if (!tipo) return '📋';
    return tipo === 'terapia' ? '🏥' : '💪';
  }

  obtenerClaseTipo(tipo: string | null | undefined): string {
    if (!tipo) return 'bg-gray-100 text-gray-800 border-gray-200';
    return tipo === 'terapia' 
      ? 'bg-blue-100 text-blue-800 border-blue-200' 
      : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }

  formatearPrecio(precio: number | null | undefined): string {
    if (precio === null || precio === undefined) return 'N/A';
    return this.paquetesService.formatearPrecio(precio);
  }

  formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return 'N/A';
    try {
      const date = new Date(fecha);
      return date.toLocaleDateString('es-GT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  }

  // ================================
  // NAVEGACIÓN
  // ================================

  irAEditar(): void {
    if (this.paquete?.id) {
      this.router.navigate(['/paquetes/editar', this.paquete.id]);
    }
  }

  volver(): void {
    this.router.navigate(['/paquetes']);
  }

  irAAsignar(): void {
    if (this.paquete?.id) {
      this.router.navigate(['/paquetes/asignar'], {
        queryParams: { paquete_id: this.paquete.id }
      });
    }
  }

  verAsignaciones(): void {
    if (this.paquete?.id) {
      this.router.navigate(['/paquetes/asignaciones'], {
        queryParams: { paquete_id: this.paquete.id }
      });
    }
  }

  // ================================
  // ACCIONES CON CONFIRMACIÓN
  // ================================

  async toggleStatus(): Promise<void> {
    if (!this.paquete) return;

    if (this.paquete.status === 1) {
      this.mostrarModalEliminar = true;
    } else {
      this.mostrarModalActivar = true;
    }
  }

  async eliminarPaquete(): Promise<void> {
    if (!this.paquete?.id) return;

    this.procesandoAccion = true;
    try {
      const response = await this.paquetesService.desactivarPaquete(this.paquete.id);
      
      if (response.success) {
        this.mostrarMensajeExito('Paquete desactivado exitosamente');
        await this.cargarPaquete();
      } else {
        this.mostrarMensajeError(response.message || 'Error al desactivar');
      }
    } catch (error) {
      console.error('Error desactivando paquete:', error);
      this.mostrarMensajeError('Error al desactivar el paquete');
    } finally {
      this.procesandoAccion = false;
      this.cancelarEliminacion();
    }
  }

  async activarPaquete(): Promise<void> {
    if (!this.paquete?.id) return;

    this.procesandoAccion = true;
    try {
      const response = await this.paquetesService.activarPaquete(this.paquete.id);
      
      if (response.success) {
        this.mostrarMensajeExito('Paquete activado exitosamente');
        await this.cargarPaquete();
      } else {
        this.mostrarMensajeError(response.message || 'Error al activar');
      }
    } catch (error) {
      console.error('Error activando paquete:', error);
      this.mostrarMensajeError('Error al activar el paquete');
    } finally {
      this.procesandoAccion = false;
      this.cancelarActivacion();
    }
  }

  cancelarEliminacion(): void {
    this.mostrarModalEliminar = false;
  }

  cancelarActivacion(): void {
    this.mostrarModalActivar = false;
  }

  // ================================
  // ACCIONES ADICIONALES
  // ================================

  duplicarPaquete(): void {
    if (!this.paquete?.id) return;

    this.router.navigate(['/paquetes/crear'], {
      queryParams: {
        duplicar: this.paquete.id,
        nombre: `Copia de ${this.paquete.nombre || 'Paquete'}`,
        tipo: this.paquete.tipo,
        precio: this.paquete.precio,
        sesiones: this.paquete.cantidad_sesiones,
        descuento: this.paquete.descuento
      }
    });
  }

  exportarPaquete(): void {
    if (!this.paquete) return;

    const datosExport = {
      ...this.paquete,
      precio_por_sesion: this.preciosPorSesion.final,
      ahorro_total: this.ahorroTotal,
      exportado_en: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(datosExport, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `paquete_${this.paquete.id}_${(this.paquete.nombre || 'paquete').replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  imprimirPaquete(): void {
    window.print();
  }

  compartirPaquete(): void {
    if (!this.paquete) return;

    if (navigator.share) {
      navigator.share({
        title: this.paquete.nombre || 'Paquete',
        text: this.paquete.descripcion || `Paquete de ${this.paquete.tipo}`,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        this.mostrarMensajeExito('Enlace copiado al portapapeles');
      });
    }
  }

  // ================================
  // MENSAJES Y NOTIFICACIONES
  // ================================

  private mostrarMensajeExito(mensaje: string): void {
    console.log('Éxito:', mensaje);
    // Aquí puedes integrar notificaciones
  }

  private mostrarMensajeError(mensaje: string): void {
    console.error('Error:', mensaje);
    this.error = mensaje;
  }

  limpiarError(): void {
    this.error = null;
  }
}
