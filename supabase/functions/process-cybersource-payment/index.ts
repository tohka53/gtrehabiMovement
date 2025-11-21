import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
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
      packageId: requestData.packageId,
      userId: requestData.userId,
      amount: requestData.payment.amount
    })

    if (!requestData.userId) {
      throw new Error('Usuario no especificado')
    }

    if (!requestData.packageId) {
      throw new Error('Paquete no especificado')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: usuario, error: userError } = await supabase
      .from('profiles')
      .select('id, username, full_name, status')
      .eq('id', requestData.userId)
      .eq('status', 1)
      .single()

    if (userError || !usuario) {
      throw new Error('Usuario no encontrado')
    }

    console.log('✅ Usuario validado:', usuario.username)

    const { data: paquete, error: packageError } = await supabase
      .from('paquetes')
      .select('id, nombre, precio, tipo, status')
      .eq('id', requestData.packageId)
      .eq('status', 1)
      .single()

    if (packageError || !paquete) {
      throw new Error('Paquete no encontrado')
    }

    console.log('✅ Paquete validado:', paquete.nombre)

    const tarjetaPrueba = requestData.payment.card.number
    const esAprobada = tarjetaPrueba.startsWith('4111') || tarjetaPrueba.startsWith('5555')
    
    console.log('🧪 Modo prueba - Tarjeta:', tarjetaPrueba.slice(0, 4) + '****')

    if (esAprobada) {
      const transactionId = `TEST-${Date.now()}`
      const authCode = `AUTH-${Math.random().toString(36).substring(7).toUpperCase()}`

      // ✅ CORRECCIÓN: validado_por ahora es NULL o usa el usuario actual
      const { data: compra, error: compraError } = await supabase
        .from('compras_paquetes')
        .insert({
          usuario_id: requestData.userId,
          paquete_id: requestData.packageId,
          precio_paquete: paquete.precio,
          descuento_aplicado: 0,
          precio_final: parseFloat(requestData.payment.amount),
          metodo_pago: 'tarjeta_credito',
          numero_transaccion: transactionId,
          fecha_pago: new Date().toISOString().split('T')[0],
          estado_compra: 'validada',
          validado_por: requestData.userId,  // ✅ CAMBIADO: usa el usuario actual en lugar de 1
          fecha_validacion: new Date().toISOString(),
          asignacion_completada: false,
          notas_admin: `Pago con CyberSource. TxID: ${transactionId}`
        })
        .select()
        .single()

      if (compraError) {
        console.error('❌ Error registrando compra:', compraError)
        throw new Error('Error al registrar: ' + compraError.message)
      }

      console.log('✅ Compra registrada:', compra.id)

      return new Response(
        JSON.stringify({
          success: true,
          transactionId: transactionId,
          authorizationCode: authCode,
          amount: parseFloat(requestData.payment.amount),
          currency: requestData.payment.currency,
          status: 'AUTHORIZED',
          message: 'Pago procesado exitosamente',
          compraId: compra.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )

    } else {
      console.log('❌ Pago rechazado')
      return new Response(
        JSON.stringify({
          success: false,
          status: 'DECLINED',
          message: 'Tarjeta rechazada',
          errorCode: 'CARD_DECLINED'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    return new Response(
      JSON.stringify({
        success: false,
        status: 'ERROR',
        message: error.message || 'Error procesando el pago',
        error: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )
  }
})