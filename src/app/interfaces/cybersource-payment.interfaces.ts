// src/app/interfaces/cybersource-payment.interfaces.ts

/**
 * Configuración de CyberSource
 */
export interface CyberSourceConfig {
  merchantId: string;
  orgId: string; // 1snn5n9w para TEST, k8vif92e para PRODUCCIÓN
  apiEndpoint: string;
  environment: 'TEST' | 'PRODUCTION';
}

/**
 * Device Fingerprint Session
 */
export interface DeviceFingerprintSession {
  sessionId: string; // merchantId + uniqueIdentifier
  deviceFingerprintId: string; // Solo el uniqueIdentifier
  timestamp: number;
}

/**
 * Datos de tarjeta para el pago
 */
export interface CardPaymentData {
  cardNumber: string;
  cardType: string; // '001' Visa, '002' Mastercard
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
  cardholderName: string;
}

/**
 * Información de billing
 */
export interface BillingInfo {
  firstName: string;
  lastName: string;
  address1: string;
  locality: string; // Ciudad
  administrativeArea: string; // Estado/Departamento
  postalCode: string;
  country: string; // Código ISO de 2 letras (GT para Guatemala)
  email: string;
  phoneNumber: string;
}

/**
 * Request para CyberSource Payment
 */
export interface CyberSourcePaymentRequest {
  // Información del cliente
  clientReferenceInformation: {
    code: string; // ID único de la transacción
  };
  
  // Información de procesamiento
  processingInformation: {
    commerceIndicator: string; // 'internet' para e-commerce
    capture?: boolean; // true para captura inmediata
  };
  
  // Información del pedido
  orderInformation: {
    amountDetails: {
      totalAmount: string;
      currency: string; // 'GTQ' para Quetzales, 'USD' para Dólares
    };
    billTo: {
      firstName: string;
      lastName: string;
      address1: string;
      locality: string;
      administrativeArea: string;
      postalCode: string;
      country: string;
      email: string;
      phoneNumber: string;
    };
  };
  
  // Información de la tarjeta
  paymentInformation: {
    card: {
      number: string;
      expirationMonth: string;
      expirationYear: string;
      securityCode: string;
      type?: string;
    };
  };
  
  // Device Fingerprint
  deviceInformation?: {
    fingerprintSessionId: string;
  };
  
  // Información adicional del merchant
  merchantDefinedInformation?: Array<{
    key: string;
    value: string;
  }>;
}

/**
 * Response de CyberSource
 */
export interface CyberSourcePaymentResponse {
  id: string;
  submitTimeUtc: string;
  status: string; // 'AUTHORIZED', 'DECLINED', 'AUTHORIZED_PENDING_REVIEW'
  reconciliationId?: string;
  
  clientReferenceInformation: {
    code: string;
  };
  
  processorInformation?: {
    approvalCode?: string;
    responseCode?: string;
    responseDetails?: string;
    networkTransactionId?: string;
    transactionId?: string;
  };
  
  orderInformation?: {
    amountDetails: {
      authorizedAmount?: string;
      currency?: string;
    };
  };
  
  paymentInformation?: {
    card?: {
      type?: string;
      suffix?: string;
    };
  };
  
  riskInformation?: {
    score?: {
      result?: string;
    };
    casePriority?: number;
  };
  
  errorInformation?: {
    reason?: string;
    message?: string;
  };
}

/**
 * Resultado del procesamiento de pago
 */
export interface PaymentProcessingResult {
  success: boolean;
  transactionId?: string;
  authorizationCode?: string;
  status: string;
  amount?: number;
  currency?: string;
  timestamp: string;
  message: string;
  errorDetails?: string;
  rawResponse?: CyberSourcePaymentResponse;
}

/**
 * Configuración de ambiente
 */
export const CYBERSOURCE_CONFIG = {
  TEST: {
    merchantId: 'rehabiMovement_test', // CAMBIAR por tu Merchant ID de TEST
    orgId: '1snn5n9w',
    apiEndpoint: 'https://apitest.cybersource.com',
    environment: 'TEST' as const
  },
  PRODUCTION: {
    merchantId: 'rehabiMovement', // CAMBIAR por tu Merchant ID de PRODUCCIÓN
    orgId: 'k8vif92e',
    apiEndpoint: 'https://api.cybersource.com',
    environment: 'PRODUCTION' as const
  }
};

/**
 * URLs de Device Fingerprint
 */
export const DEVICE_FINGERPRINT_URLS = {
  TEST: {
    tagsJs: 'https://h.online-metrix.net/fp/tags.js',
    tagsIframe: 'https://h.online-metrix.net/fp/tags'
  },
  PRODUCTION: {
    tagsJs: 'https://h.online-metrix.net/fp/tags.js',
    tagsIframe: 'https://h.online-metrix.net/fp/tags'
  }
};

/**
 * Tarjetas de prueba para ambiente TEST
 * Fuente: https://developer.cybersource.com/hello-world/testing-guide-v1.html
 */
export const TEST_CARDS = {
  VISA_APPROVED: {
    number: '4111111111111111',
    type: '001',
    cvv: '123',
    expirationMonth: '12',
    expirationYear: '2025',
    cardholderName: 'John Doe',
    expectedResult: 'AUTHORIZED'
  },
  VISA_DECLINED: {
    number: '4000300011112220',
    type: '001',
    cvv: '123',
    expirationMonth: '12',
    expirationYear: '2025',
    cardholderName: 'Jane Doe',
    expectedResult: 'DECLINED'
  },
  MASTERCARD_APPROVED: {
    number: '5555555555554444',
    type: '002',
    cvv: '123',
    expirationMonth: '12',
    expirationYear: '2025',
    cardholderName: 'Test User',
    expectedResult: 'AUTHORIZED'
  },
  AMEX_APPROVED: {
    number: '378282246310005',
    type: '003',
    cvv: '1234',
    expirationMonth: '12',
    expirationYear: '2025',
    cardholderName: 'Test User',
    expectedResult: 'AUTHORIZED'
  }
};

/**
 * Códigos de respuesta de CyberSource
 */
export const CYBERSOURCE_RESPONSE_CODES = {
  '100': 'Transacción exitosa',
  '101': 'Solicitud faltante de uno o más campos requeridos',
  '102': 'Uno o más campos contienen datos inválidos',
  '110': 'Solo parcial aprobado',
  '150': 'Error general del sistema',
  '151': 'Timeout esperando respuesta',
  '152': 'Servicio de procesamiento no disponible',
  '200': 'Procesador bancario fue autorizado suave declinado',
  '201': 'Transacción declinada por el emisor',
  '202': 'Tarjeta expirada',
  '203': 'Tarjeta rechazada de forma general',
  '204': 'Fondos insuficientes',
  '205': 'Tarjeta robada o perdida',
  '207': 'Emisor no disponible',
  '208': 'Tarjeta inactiva o no autorizada',
  '210': 'Límite de crédito excedido',
  '211': 'CVV inválido',
  '221': 'Cliente solicito cancelación de pago recurrente',
  '222': 'Cuenta no se puede procesar',
  '231': 'Número de tarjeta inválido',
  '232': 'Tipo de tarjeta no es aceptado por el comercio',
  '233': 'Procesador rechazó por información general',
  '234': 'Hay un problema con la configuración del comercio',
  '236': 'Error general del procesador',
  '240': 'La información de la tarjeta es inválida',
  '250': 'Error - solicitud fue recibida pero hubo timeout',
  '520': 'Procesador no pudo validar CVV'
};