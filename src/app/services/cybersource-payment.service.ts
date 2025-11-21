// src/app/services/cybersource-payment.service.ts
// VERSIÓN CORREGIDA - Obtiene usuario correctamente desde AuthService

import { Injectable, Inject, forwardRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface PaymentFormData {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  packageId: number;
  amount: number;
  currency: string;
  deviceFingerprintId?: string;
  acceptTerms: boolean;
}

export interface PaymentProcessingResult {
  success: boolean;
  transactionId?: string;
  authorizationCode?: string;
  amount?: number;
  currency?: string;
  status: string;
  message: string;
  errorDetails?: any;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class CyberSourcePaymentService {

  private config = {
    environment: 'TEST' as 'TEST' | 'PRODUCTION',
    merchantId: 'rehabimovement_test',
    orgId: '1snn5n9w', // TEST - Cambiar a 'k8vif92e' en producción
    deviceFingerprintUrl: 'https://h.online-metrix.net'
  };

  private deviceFingerprintSessionId: string | null = null;

  constructor(
    private http: HttpClient,
    private supabaseService: SupabaseService,
    @Inject(forwardRef(() => AuthService)) private authService: AuthService
  ) {}

  initializeDeviceFingerprint(): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const deviceFingerprintId = `${timestamp}${randomId}`;
    
    this.deviceFingerprintSessionId = `${this.config.merchantId}${deviceFingerprintId}`;
    this.injectDeviceFingerprintScripts(deviceFingerprintId);
    
    console.log('[CyberSource] Device Fingerprint inicializado:', deviceFingerprintId);
    console.log('[CyberSource] Session ID:', this.deviceFingerprintSessionId);
    
    return deviceFingerprintId;
  }

  private injectDeviceFingerprintScripts(deviceFingerprintId: string): void {
    const sessionId = `${this.config.merchantId}${deviceFingerprintId}`;
    const orgId = this.config.orgId;
    const baseUrl = this.config.deviceFingerprintUrl;

    this.cleanupDeviceFingerprint();

    console.log('[CyberSource] Inyectando scripts de Device Fingerprint:', {
      sessionId,
      orgId,
      baseUrl
    });

    const scriptElement = document.createElement('script');
    scriptElement.id = 'cybersource-df-script';
    scriptElement.type = 'text/javascript';
    scriptElement.src = `${baseUrl}/fp/tags.js?org_id=${orgId}&session_id=${sessionId}`;
    
    scriptElement.onload = () => {
      console.log('[CyberSource] ✅ Script principal cargado');
    };
    
    scriptElement.onerror = () => {
      console.error('[CyberSource] ❌ Error cargando script');
    };
    
    document.head.appendChild(scriptElement);

    const noscriptElement = document.createElement('noscript');
    noscriptElement.id = 'cybersource-df-noscript';
    const iframeElement = document.createElement('iframe');
    iframeElement.style.cssText = 'width:100px;height:100px;border:0;position:absolute;top:-5000px';
    iframeElement.src = `${baseUrl}/fp/tags?org_id=${orgId}&session_id=${sessionId}`;
    noscriptElement.appendChild(iframeElement);
    document.body.appendChild(noscriptElement);
  }

  async processPayment(paymentData: PaymentFormData): Promise<PaymentProcessingResult> {
    try {
      console.log('[CyberSource] Iniciando proceso de pago...');
      console.log('[CyberSource] Device Fingerprint en parámetro:', paymentData.deviceFingerprintId);
      console.log('[CyberSource] Device Fingerprint interno:', this.deviceFingerprintSessionId);
      
      const deviceFingerprintId = paymentData.deviceFingerprintId || 
                                   (this.deviceFingerprintSessionId ? 
                                    this.deviceFingerprintSessionId.replace(this.config.merchantId, '') : 
                                    null);
      
      if (!deviceFingerprintId) {
        console.error('[CyberSource] ❌ Device Fingerprint no disponible');
        throw new Error('Device Fingerprint no inicializado. Por favor, recarga la página e intenta nuevamente.');
      }
      
      console.log('[CyberSource] ✅ Usando Device Fingerprint:', deviceFingerprintId);

      // ===================================================================
      // OBTENER USUARIO AUTENTICADO - VERSIÓN CORREGIDA
      // ===================================================================
      console.log('[CyberSource] Obteniendo usuario autenticado...');
      
      // Usar AuthService que tiene el método getCurrentUser() correcto
      const usuario = this.authService.getCurrentUser();
      
      if (!usuario || !usuario.id) {
        console.error('[CyberSource] ❌ Usuario no autenticado o sin ID');
        console.log('[CyberSource] Usuario obtenido:', usuario);
        throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.');
      }
      
      console.log('[CyberSource] ✅ Usuario autenticado:', {
        id: usuario.id,
        username: usuario.username,
        full_name: usuario.full_name
      });
      // ===================================================================

      const request = {
        merchantId: this.config.merchantId,
        deviceFingerprintId: deviceFingerprintId,
        payment: {
          card: {
            number: paymentData.cardNumber.replace(/\s/g, ''),
            expirationMonth: paymentData.expirationMonth.padStart(2, '0'),
            expirationYear: paymentData.expirationYear,
            cvv: paymentData.cvv,
            holderName: paymentData.cardholderName
          },
          amount: paymentData.amount.toFixed(2),
          currency: paymentData.currency || 'GTQ',
          billTo: {
            firstName: paymentData.firstName,
            lastName: paymentData.lastName,
            email: paymentData.email,
            phoneNumber: paymentData.phoneNumber,
            address: paymentData.address,
            city: paymentData.city,
            state: paymentData.state,
            postalCode: paymentData.postalCode,
            country: paymentData.country || 'GT'
          }
        },
        packageId: paymentData.packageId,
        userId: usuario.id
      };

      console.log('[CyberSource] Procesando pago con datos:', {
        ...request,
        payment: {
          ...request.payment,
          card: {
            ...request.payment.card,
            number: '****' + request.payment.card.number.slice(-4),
            cvv: '***'
          }
        }
      });

      const supabaseUrl = environment.supabaseUrl;
      const supabaseKey = environment.supabaseKey;

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}` // ← AGREGADO: Header de autorización
      });

      const response = await this.http.post<any>(
        `${supabaseUrl}/functions/v1/process-cybersource-payment`,
        request,
        { headers }
      ).toPromise();

      if (!response) {
        throw new Error('Sin respuesta del servidor');
      }

      console.log('[CyberSource] Respuesta recibida:', response);

      return {
        success: response.success || false,
        transactionId: response.transactionId,
        authorizationCode: response.authorizationCode,
        amount: response.amount,
        currency: response.currency,
        status: response.status || 'ERROR',
        message: response.message || 'Error desconocido',
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('[CyberSource] Error procesando pago:', error);
      return {
        success: false,
        status: 'ERROR',
        message: error.message || 'Error al procesar el pago',
        errorDetails: error,
        timestamp: new Date().toISOString()
      };
    }
  }

  validateCardNumber(cardNumber: string): boolean {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    if (!/^\d+$/.test(cleanNumber)) return false;

    let sum = 0;
    let isEven = false;

    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber[i], 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  detectCardType(cardNumber: string): string | null {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const patterns: { [key: string]: RegExp } = {
      'Visa': /^4/,
      'Mastercard': /^5[1-5]/,
      'American Express': /^3[47]/,
      'Discover': /^6(?:011|5)/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(cleanNumber)) return type;
    }
    return null;
  }

  formatCardNumber(cardNumber: string): string {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const groups = cleanNumber.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleanNumber;
  }

  cleanupDeviceFingerprint(): void {
    const script = document.getElementById('cybersource-df-script');
    const noscript = document.getElementById('cybersource-df-noscript');
    
    if (script) {
      console.log('[CyberSource] Limpiando script');
      script.remove();
    }
    if (noscript) {
      console.log('[CyberSource] Limpiando noscript');
      noscript.remove();
    }
    
    this.deviceFingerprintSessionId = null;
  }
}