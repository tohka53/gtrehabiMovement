// src/app/articulos/articulos/articulos.component.ts
import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { FileService } from '../../services/file.service';

export interface Articulo {
  id?: number;
  titulo: string;
  contenido?: string;
  imagen_url?: string | null;
  fecha_publicacion?: string;
  mes: number;
  anio: number;
  status: number;
  created_at?: string;
}

@Component({
  selector: 'app-articulos',
  standalone: false,
  templateUrl: './articulos.component.html',
  styleUrls: ['./articulos.component.css']
})
export class ArticulosComponent implements OnInit {
  articulos: Articulo[] = [];
  filteredArticulos: Articulo[] = [];

  loading = false;
  saving = false;
  error = '';
  success = '';

  showModal = false;
  modalMode: 'create' | 'edit' = 'create';
  selectedArticulo: Articulo | null = null;

  meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  anioActual = new Date().getFullYear();
  aniosDisponibles: number[] = [];

  // Filtros
  searchTerm = '';
  statusFilter: 'active' | 'inactive' | 'all' = 'active';
  filterMes: number | 'all' = 'all';

  // Formulario
  form: Articulo = this.emptyForm();
  usarFechaExacta = false;
  fechaExacta = ''; // yyyy-mm-dd
  imagenPreview: string | null = null;
  imagenError = '';

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private fileService: FileService
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.authService.isAdmin()) {
      this.error = 'No tienes permisos para acceder a esta sección.';
      return;
    }
    this.buildAnios();
    await this.loadArticulos();
  }

  private emptyForm(): Articulo {
    const now = new Date();
    return {
      titulo: '',
      contenido: '',
      imagen_url: null,
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
      status: 1
    };
  }

  private buildAnios(): void {
    this.aniosDisponibles = [];
    for (let y = this.anioActual - 2; y <= this.anioActual + 1; y++) {
      this.aniosDisponibles.push(y);
    }
  }

  async loadArticulos(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const data = await this.supabaseService.getData('articulos');
      this.articulos = (data || []) as Articulo[];
      this.applyFilters();
    } catch (e) {
      console.error('Error cargando artículos:', e);
      this.error = 'Error al cargar los artículos. Verifica que la tabla "articulos" exista en Supabase (ejecuta supabase/articulos.sql).';
    } finally {
      this.loading = false;
    }
  }

  applyFilters(): void {
    let list = [...this.articulos];

    if (this.statusFilter === 'active') {
      list = list.filter(a => a.status === 1);
    } else if (this.statusFilter === 'inactive') {
      list = list.filter(a => a.status === 0);
    }

    if (this.filterMes !== 'all') {
      list = list.filter(a => a.mes === this.filterMes);
    }

    if (this.searchTerm.trim()) {
      const t = this.searchTerm.toLowerCase();
      list = list.filter(a =>
        a.titulo.toLowerCase().includes(t) ||
        (a.contenido || '').toLowerCase().includes(t)
      );
    }

    list.sort((a, b) =>
      (b.anio - a.anio) ||
      (b.mes - a.mes) ||
      ((b.fecha_publicacion || '').localeCompare(a.fecha_publicacion || ''))
    );

    this.filteredArticulos = list;
  }

  onSearch(): void { this.applyFilters(); }
  onFilterChange(): void { this.applyFilters(); }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'active';
    this.filterMes = 'all';
    this.applyFilters();
  }

  // ============ Modal ============
  openCreate(): void {
    this.modalMode = 'create';
    this.selectedArticulo = null;
    this.form = this.emptyForm();
    this.usarFechaExacta = false;
    this.fechaExacta = '';
    this.imagenPreview = null;
    this.imagenError = '';
    this.error = '';
    this.showModal = true;
  }

  openEdit(a: Articulo): void {
    this.modalMode = 'edit';
    this.selectedArticulo = a;
    this.form = { ...a };
    this.imagenPreview = a.imagen_url || null;
    this.imagenError = '';
    this.error = '';

    if (a.fecha_publicacion) {
      this.fechaExacta = a.fecha_publicacion.substring(0, 10);
      // Si el día no es 01 asumimos que se usó una fecha exacta
      this.usarFechaExacta = this.fechaExacta.substring(8, 10) !== '01';
    } else {
      this.fechaExacta = '';
      this.usarFechaExacta = false;
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedArticulo = null;
  }

  // ============ Imagen ============
  async onFileSelected(event: Event): Promise<void> {
    this.imagenError = '';
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) { return; }

    const file = input.files[0];
    const validation = this.fileService.validateImageFile(file);
    if (!validation.valid) {
      this.imagenError = validation.error || 'Archivo inválido';
      return;
    }

    try {
      const base64 = await this.fileService.resizeImage(file, 900, 900, 0.7);
      this.form.imagen_url = base64;
      this.imagenPreview = base64;
    } catch (e) {
      console.error('Error procesando imagen:', e);
      this.imagenError = 'No se pudo procesar la imagen.';
    } finally {
      // Permite volver a seleccionar el mismo archivo
      input.value = '';
    }
  }

  removeImage(): void {
    this.form.imagen_url = null;
    this.imagenPreview = null;
  }

  // ============ Guardar ============
  isFormValid(): boolean {
    return !!(this.form.titulo?.trim() && this.form.mes && this.form.anio);
  }

  private computeFecha(): string {
    if (this.usarFechaExacta && this.fechaExacta) {
      return this.fechaExacta;
    }
    const mm = String(this.form.mes).padStart(2, '0');
    return `${this.form.anio}-${mm}-01`;
  }

  async save(): Promise<void> {
    this.error = '';

    if (!this.form.titulo?.trim()) {
      this.error = 'El título es requerido.';
      return;
    }
    if (!this.form.mes || !this.form.anio) {
      this.error = 'Debes seleccionar el mes y el año de publicación.';
      return;
    }

    // Si se usa fecha exacta, derivar mes/año de la fecha
    if (this.usarFechaExacta && this.fechaExacta) {
      const parts = this.fechaExacta.split('-').map(n => parseInt(n, 10));
      if (parts[0] && parts[1]) {
        this.form.anio = parts[0];
        this.form.mes = parts[1];
      }
    }

    const payload: Articulo = {
      titulo: this.form.titulo.trim(),
      contenido: (this.form.contenido || '').trim(),
      imagen_url: this.form.imagen_url || null,
      mes: this.form.mes,
      anio: this.form.anio,
      fecha_publicacion: this.computeFecha(),
      status: this.form.status ?? 1
    };

    this.saving = true;
    try {
      if (this.modalMode === 'create') {
        await this.supabaseService.insertData('articulos', payload);
        this.success = 'Artículo creado correctamente.';
      } else {
        await this.supabaseService.updateData('articulos', this.selectedArticulo!.id!.toString(), payload);
        this.success = 'Artículo actualizado correctamente.';
      }
      await this.loadArticulos();
      this.closeModal();
      setTimeout(() => (this.success = ''), 4000);
    } catch (e) {
      console.error('Error guardando artículo:', e);
      this.error = 'Error al guardar el artículo. Intenta nuevamente.';
    } finally {
      this.saving = false;
    }
  }

  async deactivate(a: Articulo): Promise<void> {
    if (!confirm(`¿Desactivar el artículo "${a.titulo}"? Dejará de mostrarse en el dashboard.`)) { return; }
    try {
      await this.supabaseService.updateData('articulos', a.id!.toString(), { status: 0 });
      await this.loadArticulos();
    } catch (e) {
      console.error('Error desactivando artículo:', e);
      this.error = 'Error al desactivar el artículo.';
      setTimeout(() => (this.error = ''), 4000);
    }
  }

  async reactivate(a: Articulo): Promise<void> {
    try {
      await this.supabaseService.updateData('articulos', a.id!.toString(), { status: 1 });
      await this.loadArticulos();
    } catch (e) {
      console.error('Error reactivando artículo:', e);
      this.error = 'Error al reactivar el artículo.';
      setTimeout(() => (this.error = ''), 4000);
    }
  }

  // ============ Utilidades ============
  nombreMes(mes: number): string {
    return this.meses[mes - 1] || '';
  }

  formatFecha(f?: string): string {
    if (!f) { return ''; }
    const iso = f.length === 10 ? f + 'T00:00:00' : f;
    const d = new Date(iso);
    if (isNaN(d.getTime())) { return f; }
    return d.toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  trackById(index: number, a: Articulo): any {
    return a.id || index;
  }
}
