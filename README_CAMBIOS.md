# RehabiMovement — Resumen de cambios y cómo ejecutar

## ▶️ Cómo ejecutar en otra computadora

1. Descomprime el ZIP.
2. Instala dependencias:
   ```bash
   npm install
   ```
3. **Ejecuta los scripts SQL en Supabase** (Dashboard → SQL Editor → New query):
   - `supabase/articulos.sql` — crea la tabla `articulos`.
   - `supabase/rutinas_terapias_campos.sql` — agrega columnas a `rutinas` y `terapias`.
4. Levanta el proyecto:
   ```bash
   ng serve
   ```
   (o `npm start`). Abre http://localhost:4200

> Requisitos: Node 18+ y Angular CLI 19 (`npm install -g @angular/cli`).
> La configuración de Supabase está en `src/environments/environment.ts`.

---

## 📋 Cambios incluidos

### Página principal (landing)
- 3 servicios nuevos: **Fisioterapia neurológica**, **Fisioterapia traumatológica y ortopedia**, **Fisioterapia preventiva**.
- El **hero ahora muestra un video** (`public/video.mp4`) en lugar de la imagen. Se convirtió `video.MOV` → `video.mp4` para que funcione en todos los navegadores. Reproduce en automático, en bucle y sin sonido.

### Artículos (nuevo módulo)
- Sección de **Artículos por mes** en el Dashboard (reemplaza las frases motivacionales).
  - Pacientes: ven solo el mes actual.
  - Administrador: navega cualquier mes (flechas ◄ ►) y tiene botón **"Nuevo artículo"**.
- Pantalla de administración en **`/articulos`** (crear/editar/activar/desactivar), con título, contenido, **mes y año** (o fecha exacta) y **foto de portada opcional** (se guarda en base64).
- Link **"Artículos"** en el menú lateral (solo administradores).
- Requiere la tabla `articulos` (`supabase/articulos.sql`).

### Crear Rutina y Crear Terapia
- Campo nuevo **"Observaciones Generales"** al inicio.
- El campo "Descripción" anterior ahora es **"Descripción General"**.
- Campo nuevo **"Descripción"** (detallada) debajo.
- Requiere columnas nuevas (`supabase/rutinas_terapias_campos.sql`): `observaciones_generales`, `descripcion_detallada`.

### Asignar Rutinas y Terapias
- **Buscador por nombre** en el selector de rutina/terapia.
- Botón **"Editar"** en cada asignación (lista y también en el modal del **calendario**) para corregir:
  - Asignación: fecha de inicio, fecha de fin y notas.
  - Contenido: nombre, observaciones, descripción general y descripción.
- Solo disponible para quien asigna (admin/supervisor).

### Visualización
- Las **Observaciones Generales** y la **Descripción** se muestran en **Mis Rutinas**, **Mis Terapias** y en el detalle/listado del administrador.

### Correcciones
- Acceso a `/articulos` (se ajustaron `AuthGuard` y el servicio de permisos para la ruta nueva).
- El **menú lateral** se contrae al seleccionar una opción y los submenús funcionan tipo acordeón (al abrir uno se cierra el otro).
- El **modal de artículo** se rediseñó con el mismo estilo del de rutinas (header con degradado, cuerpo con scroll y botones fijos).

---

## 🗂️ Archivos principales nuevos/modificados
- `src/app/articulos/articulos/` (pantalla admin de artículos)
- `src/app/articulos-vista/articulos-vista/` (vista por mes en el dashboard)
- `src/app/landing/landing.component.*` (servicios + video)
- `src/app/dashboard/dashboard/dashboard.component.html`
- `src/app/rutinas/…`, `src/app/terapias/…` (campos nuevos)
- `src/app/rutinas-usuario/…`, `src/app/terapias-usuario/…` (buscador + editar)
- `src/app/calendario-asignacion-rutinas/…` (botón Editar en el modal)
- `src/app/mis-rutinas/…`, `src/app/mis-terapias/…` (visualización)
- `src/app/layout/…`, `src/app/guards/auth.guard.ts`, `src/app/services/permissions.service.ts`
- `supabase/articulos.sql`, `supabase/rutinas_terapias_campos.sql`
- `public/video.mp4`
