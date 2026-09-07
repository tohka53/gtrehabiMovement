-- =============================================================
-- RehabiMovement · cierre del fix de Terapias
-- Supabase → SQL Editor. Corré cada bloque por separado
-- (seleccionalo y ⌘↵): el editor solo muestra el resultado
-- del último statement.
-- Todo es idempotente y no borra datos.
-- =============================================================


-- ── BLOQUE 1 · columnas que el formulario necesita ───────────
-- El form de terapias edita estos dos campos. Si no existen,
-- PostgREST responde PGRST204 y el guardado los descarta.
alter table terapias add column if not exists observaciones_generales text;
alter table terapias add column if not exists descripcion_detallada   text;

-- Refrescar el cache de esquema de PostgREST (obligatorio tras
-- cualquier cambio de columnas, incluido el rename de ayer).
notify pgrst, 'reload schema';


-- ── BLOQUE 2 · verificación del esquema ──────────────────────
-- Esperado:  true | false | true | true
select
  bool_or(column_name = 'estimulo')                as tiene_estimulo,
  bool_or(column_name = 'nivel')                   as tiene_nivel_viejo,
  bool_or(column_name = 'observaciones_generales') as tiene_observaciones,
  bool_or(column_name = 'descripcion_detallada')   as tiene_desc_detallada
from information_schema.columns
where table_schema = 'public' and table_name = 'terapias';


-- ── BLOQUE 3 · prueba de humo del INSERT real ────────────────
-- Reproduce exactamente el payload que manda toRow() del front.
-- Va dentro de begin/rollback: NO deja ninguna fila.
begin;

insert into terapias (
  nombre, descripcion, observaciones_generales, descripcion_detallada,
  tipo, area_especializacion, estimulo, duracion_estimada,
  objetivo_principal, contraindicaciones, criterios_progresion,
  tags, ejercicios, status
) values (
  '__prueba_borrar__', 'prueba', null, null,
  'fisica', 'hombro', 'Principiante', 60,
  null, null, null,
  null, '{}'::jsonb, 1
)
returning id, nombre, estimulo;

rollback;
-- Si devolvió una fila: el front ya puede crear terapias.
-- Si dio 42703 / PGRST204: copiame el nombre de columna del error.


-- ── BLOQUE 4 · la vista de asignaciones sigue viva ───────────
-- El rename reescribió la vista sola; el alias terapia_nivel se mantiene.
select terapia_nivel, terapia_nombre
from v_terapias_asignadas_usuarios
limit 3;


-- ── BLOQUE 5 · estado general (opcional) ─────────────────────
select
  (select count(*) from terapias where status = 1)                     as terapias_activas,
  (select count(*) from profiles where status = 1)                     as usuarios_activos,
  (select count(*) from terapia_asignaciones_masivas where status = 1) as asignaciones_activas,
  (select count(*) from terapia_seguimiento_individual)                as seguimientos;
