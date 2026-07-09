-- ===============================================================
-- FIX: calcular_descuento_paquete
-- Bug: el WHERE usaba "d.paquete_id = p_paquete_id", y los descuentos
-- generales (aplicables a todos los paquetes) se guardan con
-- paquete_id = NULL, por lo que NUNCA aplicaban.
-- Fix: aceptar también d.paquete_id IS NULL.
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ===============================================================

CREATE OR REPLACE FUNCTION calcular_descuento_paquete(
    p_usuario_id BIGINT,
    p_paquete_id BIGINT
) RETURNS TABLE (
    descuento_id BIGINT,
    descuento_aplicable DECIMAL,
    tipo_descuento VARCHAR,
    nombre_descuento VARCHAR,
    precio_original DECIMAL,
    precio_final DECIMAL
) AS $$
DECLARE
    v_precio_paquete DECIMAL;
    v_perfil_usuario INTEGER;
BEGIN
    -- Obtener precio del paquete
    SELECT precio INTO v_precio_paquete FROM paquetes WHERE id = p_paquete_id AND status = 1;

    IF v_precio_paquete IS NULL THEN
        RETURN;
    END IF;

    -- Obtener perfil del usuario
    SELECT id_perfil INTO v_perfil_usuario FROM profiles WHERE id = p_usuario_id AND status = 1;

    -- Buscar descuentos aplicables (específicos del paquete O generales)
    RETURN QUERY
    SELECT
        d.id,
        d.valor_descuento,
        d.tipo_descuento,
        d.nombre_descuento,
        v_precio_paquete,
        CASE
            WHEN d.tipo_descuento = 'porcentaje' THEN
                ROUND(v_precio_paquete * (1 - d.valor_descuento/100), 2)
            WHEN d.tipo_descuento = 'monto_fijo' THEN
                GREATEST(v_precio_paquete - d.valor_descuento, 0)
            ELSE v_precio_paquete
        END
    FROM descuentos_paquetes d
    WHERE (d.paquete_id = p_paquete_id OR d.paquete_id IS NULL)  -- ← FIX
    AND d.activo = true
    AND d.status = 1
    AND CURRENT_DATE BETWEEN d.fecha_inicio AND d.fecha_fin
    AND (
        d.aplicable_a = 'todos' OR
        (d.aplicable_a = 'perfil_especifico' AND d.perfil_id = v_perfil_usuario) OR
        (d.aplicable_a = 'usuario_especifico' AND d.usuario_id = p_usuario_id)
    )
    AND (d.usos_maximos IS NULL OR d.usos_actuales < d.usos_maximos)
    ORDER BY
        CASE
            WHEN d.tipo_descuento = 'porcentaje' THEN v_precio_paquete * d.valor_descuento/100
            ELSE d.valor_descuento
        END DESC
    LIMIT 1; -- Solo el mejor descuento
END;
$$ LANGUAGE plpgsql;

-- Verificación (ajusta los IDs):
-- SELECT * FROM calcular_descuento_paquete(2, 9);
