-- =====================================================================
-- Columnas nuevas para RUTINAS y TERAPIAS
--   - observaciones_generales : texto que se coloca al inicio
--   - descripcion_detallada   : segundo campo "Descripción" (debajo de la general)
-- Ejecuta en: Supabase Dashboard -> SQL Editor -> New query
-- =====================================================================

alter table public.rutinas
  add column if not exists observaciones_generales text,
  add column if not exists descripcion_detallada  text;

alter table public.terapias
  add column if not exists observaciones_generales text,
  add column if not exists descripcion_detallada  text;

-- Nota: la columna existente "descripcion" se mantiene; en la interfaz
-- ahora se muestra con la etiqueta "Descripción General".
