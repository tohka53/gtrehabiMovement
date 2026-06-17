// src/app/articulos-vista/articulos-vista/articulos-vista.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

interface Articulo {
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
  selector: 'app-articulos-vista',
  standalone: false,
  templateUrl: './articulos-vista.component.html',
  styleUrls: ['./articulos-vista.component.css']
})
export class ArticulosVistaComponent implements OnInit {
  meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  articulos: Articulo[] = [];
  loading = true;
  error = '';

  selectedAnio = new Date().getFullYear();
  selectedMes = new Date().getMonth() + 1;

  selectedArticulo: Articulo | null = null; // para el modal de lectura

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private router: Router
  ) {}

  get esAdmin(): boolean {
    return this.authService.isAdmin();
  }

  irAAdministrar(): void {
    this.router.navigate(['/articulos']);
  }

  // Navegación de meses (solo para el creador/admin en el dashboard)
  mesAnterior(): void {
    if (this.selectedMes === 1) {
      this.selectedMes = 12;
      this.selectedAnio--;
    } else {
      this.selectedMes--;
    }
  }

  mesSiguiente(): void {
    if (this.selectedMes === 12) {
      this.selectedMes = 1;
      this.selectedAnio++;
    } else {
      this.selectedMes++;
    }
  }

  irMesActual(): void {
    const ahora = new Date();
    this.selectedMes = ahora.getMonth() + 1;
    this.selectedAnio = ahora.getFullYear();
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    // Mostrar siempre el mes y año actuales
    const ahora = new Date();
    this.selectedMes = ahora.getMonth() + 1;
    this.selectedAnio = ahora.getFullYear();
    try {
      const data = await this.supabaseService.getDataWithFilters('articulos', '*', { status: 1 });
      this.articulos = (data || []) as Articulo[];
    } catch (e) {
      console.error('Error cargando artículos:', e);
      this.error = 'No se pudieron cargar los artículos.';
    } finally {
      this.loading = false;
    }
  }

  get articulosVisibles(): Articulo[] {
    return this.articulos
      .filter(a => a.anio === this.selectedAnio && a.mes === this.selectedMes)
      .sort((a, b) => (b.fecha_publicacion || '').localeCompare(a.fecha_publicacion || ''));
  }

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

  resumen(contenido?: string): string {
    if (!contenido) { return ''; }
    const txt = contenido.trim();
    return txt.length > 160 ? txt.substring(0, 160) + '…' : txt;
  }

  abrir(a: Articulo): void {
    this.selectedArticulo = a;
  }

  cerrar(): void {
    this.selectedArticulo = null;
  }

  trackById(index: number, a: Articulo): any {
    return a.id || index;
  }
}
