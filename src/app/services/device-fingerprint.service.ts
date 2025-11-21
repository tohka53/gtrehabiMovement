// src/app/services/device-fingerprint.service.ts

import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { 
  DeviceFingerprintSession, 
  CYBERSOURCE_CONFIG, 
  DEVICE_FINGERPRINT_URLS 
} from '../interfaces/cybersource-payment.interfaces';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DeviceFingerprintService {
  
  private renderer: Renderer2;
  private currentEnvironment: 'TEST' | 'PRODUCTION' = 'TEST'; // Cambiar a PRODUCTION en producción
  private sessionCache = new Map<string, DeviceFingerprintSession>();
  
  constructor(
    private rendererFactory: RendererFactory2,
    private authService: AuthService
  ) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
  }

  /**
   * Genera un identificador único para la sesión
   */
  private generateUniqueIdentifier(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}${random}`;
  }

  /**
   * Obtiene el Merchant ID según el ambiente
   */
  private getMerchantId(): string {
    const config = this.currentEnvironment === 'TEST' 
      ? CYBERSOURCE_CONFIG.TEST 
      : CYBERSOURCE_CONFIG.PRODUCTION;
    return config.merchantId;
  }

  /**
   * Obtiene el Org ID según el ambiente
   */
  private getOrgId(): string {
    const config = this.currentEnvironment === 'TEST' 
      ? CYBERSOURCE_CONFIG.TEST 
      : CYBERSOURCE_CONFIG.PRODUCTION;
    return config.orgId;
  }

  /**
   * Crea una nueva sesión de Device Fingerprint
   */
  createSession(): DeviceFingerprintSession {
    const uniqueIdentifier = this.generateUniqueIdentifier();
    const merchantId = this.getMerchantId();
    const sessionId = `${merchantId}${uniqueIdentifier}`;
    
    const session: DeviceFingerprintSession = {
      sessionId,
      deviceFingerprintId: uniqueIdentifier,
      timestamp: Date.now()
    };
    
    // Cachear la sesión
    this.sessionCache.set(uniqueIdentifier, session);
    
    return session;
  }

  /**
   * Inyecta los scripts de Device Fingerprint en el DOM
   * IMPORTANTE: Esto debe ejecutarse AL MENOS 20ms antes de realizar el pago
   */
  injectDeviceFingerprintScripts(session: DeviceFingerprintSession): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const orgId = this.getOrgId();
        const urls = this.currentEnvironment === 'TEST' 
          ? DEVICE_FINGERPRINT_URLS.TEST 
          : DEVICE_FINGERPRINT_URLS.PRODUCTION;

        // Limpiar scripts anteriores si existen
        this.removeExistingScripts();

        // 1. Crear script principal (tags.js) - VA EN EL <head>
        const scriptElement = this.renderer.createElement('script');
        this.renderer.setAttribute(scriptElement, 'type', 'text/javascript');
        this.renderer.setAttribute(scriptElement, 'id', 'cybersource-df-script');
        this.renderer.setAttribute(
          scriptElement, 
          'src', 
          `${urls.tagsJs}?org_id=${orgId}&session_id=${session.sessionId}`
        );
        
        scriptElement.onload = () => {
          console.log('✅ Device Fingerprint script cargado correctamente');
          resolve(true);
        };
        
        scriptElement.onerror = () => {
          console.error('❌ Error cargando Device Fingerprint script');
          reject(new Error('Error al cargar script de Device Fingerprint'));
        };

        // Agregar script al head
        this.renderer.appendChild(document.head, scriptElement);

        // 2. Crear noscript con iframe - VA EN EL <body>
        const noscriptElement = this.renderer.createElement('noscript');
        this.renderer.setAttribute(noscriptElement, 'id', 'cybersource-df-noscript');
        
        const iframeElement = this.renderer.createElement('iframe');
        this.renderer.setStyle(iframeElement, 'width', '100px');
        this.renderer.setStyle(iframeElement, 'height', '100px');
        this.renderer.setStyle(iframeElement, 'border', '0');
        this.renderer.setStyle(iframeElement, 'position', 'absolute');
        this.renderer.setStyle(iframeElement, 'top', '-5000px');
        this.renderer.setAttribute(
          iframeElement, 
          'src', 
          `${urls.tagsIframe}?org_id=${orgId}&session_id=${session.sessionId}`
        );
        
        this.renderer.appendChild(noscriptElement, iframeElement);
        this.renderer.appendChild(document.body, noscriptElement);

        console.log('📡 Device Fingerprint inyectado:', {
          orgId,
          sessionId: session.sessionId,
          deviceFingerprintId: session.deviceFingerprintId,
          environment: this.currentEnvironment
        });

      } catch (error) {
        console.error('❌ Error inyectando Device Fingerprint:', error);
        reject(error);
      }
    });
  }

  /**
   * Remueve scripts existentes de Device Fingerprint
   */
  private removeExistingScripts(): void {
    // Remover script
    const existingScript = document.getElementById('cybersource-df-script');
    if (existingScript) {
      this.renderer.removeChild(document.head, existingScript);
    }
    
    // Remover noscript
    const existingNoscript = document.getElementById('cybersource-df-noscript');
    if (existingNoscript) {
      this.renderer.removeChild(document.body, existingNoscript);
    }
  }

  /**
   * Inicializa Device Fingerprint para el flujo de compra
   * Retorna la sesión creada
   */
  async initializeForPurchase(): Promise<DeviceFingerprintSession> {
    const session = this.createSession();
    
    try {
      await this.injectDeviceFingerprintScripts(session);
      
      // Esperar al menos 20ms para que los scripts se ejecuten
      await this.delay(50);
      
      return session;
    } catch (error) {
      console.error('Error inicializando Device Fingerprint:', error);
      throw error;
    }
  }

  /**
   * Obtiene una sesión desde el cache
   */
  getSession(deviceFingerprintId: string): DeviceFingerprintSession | undefined {
    return this.sessionCache.get(deviceFingerprintId);
  }

  /**
   * Limpia sesiones expiradas del cache (más de 48 horas)
   */
  cleanExpiredSessions(): void {
    const now = Date.now();
    const expirationTime = 48 * 60 * 60 * 1000; // 48 horas en milisegundos
    
    this.sessionCache.forEach((session, key) => {
      if (now - session.timestamp > expirationTime) {
        this.sessionCache.delete(key);
      }
    });
  }

  /**
   * Limpia los scripts de Device Fingerprint del DOM
   */
  cleanup(): void {
    this.removeExistingScripts();
  }

  /**
   * Cambia el ambiente (TEST o PRODUCTION)
   */
  setEnvironment(environment: 'TEST' | 'PRODUCTION'): void {
    this.currentEnvironment = environment;
    console.log(`🔧 Ambiente de CyberSource cambiado a: ${environment}`);
  }

  /**
   * Obtiene el ambiente actual
   */
  getCurrentEnvironment(): 'TEST' | 'PRODUCTION' {
    return this.currentEnvironment;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Valida que una sesión sea válida (no expirada)
   */
  isSessionValid(session: DeviceFingerprintSession): boolean {
    const now = Date.now();
    const expirationTime = 48 * 60 * 60 * 1000; // 48 horas
    return (now - session.timestamp) < expirationTime;
  }
}