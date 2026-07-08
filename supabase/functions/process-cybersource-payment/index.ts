// supabase/functions/process-cybersource-payment/index.ts
// Integración REAL con CyberSource REST API (Visa Platform Connect / VisaNet GT)
// Autenticación: HTTP Signature (keyId + shared secret desde secrets de Supabase)
//
// Secrets requeridos (supabase secrets set ...):
//   CYBERSOURCE_ENVIRONMENT   -> 'TEST' | 'PRODUCTION'
//   CYBERSOURCE_MERCHANT_ID   -> visanetgt_rehabimovement
//   CYBERSOURCE_KEY_ID        -> Key ID generado en EBC (Key Management > REST - Shared Secret)
//   CYBERSOURCE_SHARED_SECRET -> Shared secret (base64) generado junto al Key ID

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ===================================================================
// CyberSource: firma HTTP Signature
// ===================================================================

interface CyberSourceConfig {
  environment: 'TEST' | 'PRODUCTION'
  host: string
  merchantId: string
  keyId: string
  sharedSecret: string // base64
}

function getCyberSourceConfig(): CyberSourceConfig {
  const environment = (Deno.env.get('CYBERSOURCE_ENVIRONMENT') ?? 'TEST') as 'TEST' | 'PRODUCTION'
  const merchantId = Deno.env.get('CYBERSOURCE_MERCHANT_ID')
  const keyId = Deno.env.get('CYBERSOURCE_KEY_ID')
  const sharedSecret = Deno.env.get('CYBERSOURCE_SHARED_SECRET')

  if (!merchantId || !keyId || !sharedSecret) {
    throw new Error('Faltan secrets de CyberSource (CYBERSOURCE_MERCHANT_ID / CYBERSOURCE_KEY_ID / CYBERSOURCE_SHARED_SECRET)')
  }

  return {
    environment,
    host: environment === 'PRODUCTION' ? 'api.cybersource.com' : 'apitest.cybersource.com',
    merchantId,
    keyId,
    sharedSecret,
  }
}

async function sha256Digest(body: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
  return `SHA-256=${btoa(String.fromCharCode(...new Uint8Array(hash)))}`
}

async function hmacSha256Base64(secretBase64: string, data: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(secretBase64), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function cyberSourcePost(config: CyberSourceConfig, resource: string, payload: unknown): Promise<{ status: number; body: any }> {
  const body = JSON.stringify(payload)
  const date = new Date().toUTCString()
  const digest = await sha256Digest(body)

  const signedHeaders = 'host date request-target digest v-c-merchant-id'
  const signingString = [
    `host: ${config.host}`,
    `date: ${date}`,
    `request-target: post ${resource}`,
    `digest: ${digest}`,
    `v-c-merchant-id: ${config.merchantId}`,
  ].join('\n')

  const signature = await hmacSha256Base64(config.sharedSecret, signingString)
  const signatureHeader =
    `keyid="${config.keyId}", algorithm="HmacSHA256", headers="${signedHeaders}", signature="${signature}"`

  const response = await fetch(`https://${config.host}${resource}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'v-c-merchant-id': config.merchantId,
      'Date': date,
      'Host': config.host,
      'Digest': digest,
      'Signature': signatureHeader,
    },
    body,
  })

  const responseBody = await response.json().catch(() => ({}))
  return { status: response.status, body: responseBody }
}

// ===================================================================
// Helpers
// ===================================================================

function detectCardType(cardNumber: string): string | undefined {
  if (/^4/.test(cardNumber)) return '001' // Visa
  if (/^(5[1-5]|2[2-7])/.test(cardNumber)) return '002' // Mastercard
  if (/^3[47]/.test(cardNumber)) return '003' // Amex
  return undefined
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ===================================================================
// Edge function
// ===================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Método no permitido' }, 405)
  }

  try {
    const requestData = await req.json()

    console.log('📥 [Edge Function] Petición de pago:', {
      packageId: requestData.packageId,
      userId: requestData.userId,
    })

    if (!requestData.userId) throw new Error('Usuario no especificado')
    if (!requestData.packageId) throw new Error('Paquete no especificado')
    if (!requestData.payment?.card?.number) throw new Error('Datos de tarjeta incompletos')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // -----------------------------------------------------------------
    // 1. Validar usuario y paquete
    // -----------------------------------------------------------------
    const { data: usuario, error: userError } = await supabase
      .from('profiles')
      .select('id, username, full_name, status')
      .eq('id', requestData.userId)
      .eq('status', 1)
      .single()

    if (userError || !usuario) throw new Error('Usuario no encontrado')

    const { data: paquete, error: packageError } = await supabase
      .from('paquetes')
      .select('id, nombre, precio, tipo, status')
      .eq('id', requestData.packageId)
      .eq('status', 1)
      .single()

    if (packageError || !paquete) throw new Error('Paquete no encontrado')

    // -----------------------------------------------------------------
    // 2. Calcular monto en el servidor (nunca confiar en el cliente)
    // -----------------------------------------------------------------
    let precioEsperado = Number(paquete.precio)
    let descuentoAplicado = 0

    const { data: descuento } = await supabase
      .rpc('calcular_descuento_paquete', {
        p_usuario_id: requestData.userId,
        p_paquete_id: requestData.packageId,
      })
      .maybeSingle()

    if (descuento && descuento.precio_final != null) {
      precioEsperado = Number(descuento.precio_final)
      descuentoAplicado = Number(paquete.precio) - precioEsperado
    }

    const montoCliente = Number(requestData.payment.amount)
    if (Math.abs(montoCliente - precioEsperado) > 0.01) {
      throw new Error(`Monto inválido: se esperaba ${precioEsperado.toFixed(2)}`)
    }

    // -----------------------------------------------------------------
    // 3. Llamada real a CyberSource: POST /pts/v2/payments (venta = auth + captura)
    // -----------------------------------------------------------------
    const config = getCyberSourceConfig()
    const card = requestData.payment.card
    const billTo = requestData.payment.billTo ?? {}
    const referenceCode = `RM-${Date.now()}-U${requestData.userId}-P${requestData.packageId}`

    const paymentRequest: Record<string, unknown> = {
      clientReferenceInformation: { code: referenceCode },
      processingInformation: {
        capture: true, // venta: autorización + captura en un solo paso
        commerceIndicator: 'internet',
      },
      paymentInformation: {
        card: {
          number: String(card.number).replace(/\s/g, ''),
          expirationMonth: String(card.expirationMonth).padStart(2, '0'),
          expirationYear: String(card.expirationYear),
          securityCode: String(card.cvv),
          ...(detectCardType(String(card.number)) ? { type: detectCardType(String(card.number)) } : {}),
        },
      },
      orderInformation: {
        amountDetails: {
          totalAmount: precioEsperado.toFixed(2),
          currency: requestData.payment.currency || 'GTQ',
        },
        billTo: {
          firstName: billTo.firstName || usuario.full_name?.split(' ')[0] || 'Cliente',
          lastName: billTo.lastName || usuario.full_name?.split(' ').slice(1).join(' ') || 'RehabiMovement',
          address1: billTo.address || 'Ciudad de Guatemala',
          locality: billTo.city || 'Guatemala',
          administrativeArea: billTo.state || 'GT',
          postalCode: billTo.postalCode || '01001',
          country: billTo.country || 'GT',
          email: billTo.email,
          phoneNumber: billTo.phoneNumber,
        },
      },
    }

    // Device Fingerprint (requisito de VisaNet para pasar a producción):
    // el front publica los tags con session_id = merchantId + deviceFingerprintId
    // y aquí se envía el mismo deviceFingerprintId.
    if (requestData.deviceFingerprintId) {
      paymentRequest.deviceInformation = {
        fingerprintSessionId: String(requestData.deviceFingerprintId),
      }
    }

    console.log(`💳 [CyberSource:${config.environment}] Enviando pago`, {
      reference: referenceCode,
      amount: precioEsperado.toFixed(2),
      card: '****' + String(card.number).slice(-4),
    })

    const { status: httpStatus, body: csResponse } = await cyberSourcePost(config, '/pts/v2/payments', paymentRequest)

    console.log(`📩 [CyberSource] HTTP ${httpStatus} | status: ${csResponse?.status} | id: ${csResponse?.id}`)

    const csStatus: string = csResponse?.status ?? 'ERROR'

    // -----------------------------------------------------------------
    // 4. Resultado
    // -----------------------------------------------------------------
    if (httpStatus === 201 && csStatus === 'AUTHORIZED') {
      const transactionId: string = csResponse.id
      const authCode: string = csResponse.processorInformation?.approvalCode ?? ''

      const { data: compra, error: compraError } = await supabase
        .from('compras_paquetes')
        .insert({
          usuario_id: requestData.userId,
          paquete_id: requestData.packageId,
          precio_paquete: paquete.precio,
          descuento_aplicado: descuentoAplicado,
          precio_final: precioEsperado,
          metodo_pago: 'tarjeta_credito',
          numero_transaccion: transactionId,
          fecha_pago: new Date().toISOString().split('T')[0],
          estado_compra: 'validada',
          validado_por: requestData.userId,
          fecha_validacion: new Date().toISOString(),
          asignacion_completada: false,
          notas_admin: `Pago CyberSource ${config.environment}. TxID: ${transactionId}. Auth: ${authCode}. Ref: ${referenceCode}`,
        })
        .select()
        .single()

      if (compraError) {
        // El cobro YA se hizo: no perder el rastro
        console.error('⚠️ Pago APROBADO pero falló el registro de la compra:', compraError.message, 'TxID:', transactionId)
        throw new Error(`Pago aprobado (TxID ${transactionId}) pero falló el registro. Contacta a soporte.`)
      }

      return jsonResponse({
        success: true,
        transactionId,
        authorizationCode: authCode,
        amount: precioEsperado,
        currency: requestData.payment.currency || 'GTQ',
        status: 'AUTHORIZED',
        message: 'Pago procesado exitosamente',
        compraId: compra.id,
      })
    }

    // Rechazado o error de CyberSource
    const declineReason = csResponse?.errorInformation?.message
      ?? csResponse?.message
      ?? 'Transacción rechazada por el emisor'

    console.log('❌ Pago no aprobado:', csStatus, declineReason)

    return jsonResponse({
      success: false,
      status: csStatus === 'DECLINED' ? 'DECLINED' : 'ERROR',
      message: declineReason,
      errorCode: csResponse?.errorInformation?.reason ?? csStatus,
      transactionId: csResponse?.id,
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    return jsonResponse({
      success: false,
      status: 'ERROR',
      message: error.message || 'Error procesando el pago',
    }, 500)
  }
})
