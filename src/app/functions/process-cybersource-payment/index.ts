// supabase/functions/process-cybersource-payment/index.ts
// VERSIÓN SIMPLIFICADA - Solo registra el pago, no asigna automáticamente

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Configuración de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Manejo de CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Método no permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }

  try {
    console.log('📥 [Edge Function] Recibiendo petición de pago...')

    const requestData = await req.json()
    
    console.log('📋 [Edge Function] Datos recibidos:', {
      merchantId: requestData.merchantId,
      deviceFingerprintId: requestData.deviceFingerprintId,
      packageId: requestData.packageId,
      userId: requestData.userId,
      amount: requestData.payment.amount,
      currency: requestData.payment.currency
    })

    // Validaciones
    if (!requestData.userId) {
      throw new Error('Usuario no especificado')
    }

    if (!requestData.packageId) {
      throw new Error('Paquete no especificado')
    }

    if (!requestData.payment?.amount || parseFloat(requestData.payment.amount) <= 0) {
      throw new Error('Monto inválido')
    }

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validar usuario
    const { data: usuario, error: userError } = await supabase
      .from('profiles')
      .select('id, username, full_name, status')
      .eq('id', requestData.userId)
      .eq('status', 1)
      .single()

    if (userError || !usuario) {
      throw new Error('Usuario no encontrado o inactivo')
    }

    console.log('✅ [Edge Function] Usuario validado:', usuario.username)

    // Validar paquete
    const { data: paquete, error: packageError } = await supabase
      .from('paquetes')
      .select('id, nombre, precio, tipo, status')
      .eq('id', requestData.packageId)
      .eq('status', 1)
      .single()

    if (packageError || !paquete) {
      throw new Error('Paquete no encontrado o inactivo')
    }

    console.log('✅ [Edge Function] Paquete validado:', paquete.nombre)

    // Validar monto
    const montoSolicitado = parseFloat(requestData.payment.amount)
    const montoPaquete = parseFloat(paquete.precio)
    
    if (Math.abs(montoSolicitado - montoPaquete) > 0.01) {
      console.warn('⚠️ [Edge Function] Monto no coincide:', {
        solicitado: montoSolicitado,
        esperado: montoPaquete
      })
    }

    // ============================================
    // SIMULACIÓN DE PAGO (MODO DESARROLLO)
    // ============================================
    const tarjetaPrueba = requestData.payment.card.number
    const esAprobada = tarjetaPrueba.startsWith('4111') || tarjetaPrueba.startsWith('5555')
    
    console.log('🧪 [Edge Function] Modo de prueba activado')
    console.log('💳 [Edge Function] Tarjeta:', tarjetaPrueba.slice(0, 4) + '****')
    console.log('✅ [Edge Function] Resultado simulado:', esAprobada ? 'APROBADA' : 'RECHAZADA')

    if (esAprobada) {
      // PAGO APROBADO
      const transactionId = `TEST-${Date.now()}`
      const authorizationCode = `AUTH-${Math.random().toString(36).substring(7).toUpperCase()}`

      // Registrar la compra
      const { data: compra, error: compraError } = await supabase
        .from('compras_paquetes')
        .insert({
          usuario_id: requestData.userId,
          paquete_id: requestData.packageId,
          precio_paquete: paquete.precio,
          descuento_aplicado: 0,
          precio_final: montoSolicitado,
          metodo_pago: 'tarjeta_credito',
          numero_transaccion: transactionId,
          fecha_pago: new Date().toISOString().split('T')[0],
          estado_compra: 'validada',
          validado_por: 1,
          fecha_validacion: new Date().toISOString(),
          asignacion_completada: false,
          notas_admin: `Pago procesado automáticamente con CyberSource. Transaction ID: ${transactionId}. Paquete pendiente de asignación manual por administrador.`
        })
        .select()
        .single()

      if (compraError) {
        console.error('❌ [Edge Function] Error registrando compra:', compraError)
        throw new Error('Error al registrar la compra: ' + compraError.message)
      }

      console.log('✅ [Edge Function] Compra registrada:', compra.id)
      console.log('ℹ️ [Edge Function] Paquete pendiente de asignación manual')

      // Retornar respuesta exitosa
      return new Response(
        JSON.stringify({
          success: true,
          transactionId: transactionId,
          authorizationCode: authorizationCode,
          amount: montoSolicitado,
          currency: requestData.payment.currency,
          status: 'AUTHORIZED',
          message: 'Pago procesado exitosamente. El paquete será asignado por un administrador.',
          compraId: compra.id
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )

    } else {
      // PAGO RECHAZADO
      console.log('❌ [Edge Function] Pago rechazado')

      return new Response(
        JSON.stringify({
          success: false,
          status: 'DECLINED',
          message: 'Tarjeta rechazada por el banco emisor',
          errorCode: 'CARD_DECLINED'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

  } catch (error: any) {
    console.error('❌ [Edge Function] Error:', error.message)
    console.error('❌ [Edge Function] Stack:', error.stack)

    return new Response(
      JSON.stringify({
        success: false,
        status: 'ERROR',
        message: error.message || 'Error procesando el pago',
        error: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})