// src/app/compra-paquetes/compra-paquetes.component.ts
// VERSIÓN FINAL CORREGIDA - LISTA PARA USAR

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CompraPaquetesService } from '../../services/compra-paquetes.service';
import { AuthService } from '../../services/auth.service';
import { CyberSourcePaymentService, PaymentFormData } from '../../services/cybersource-payment.service';

@Component({
  selector: 'app-compra-paquetes',
  standalone: false,
  templateUrl: './compra-paquetes.component.html',
  styleUrls: ['./compra-paquetes.component.css']
})
export class CompraPaquetesComponent implements OnInit, OnDestroy {

  // Estado
  cargando = false;
  error: string | null = null;
  
  // Paquetes
  paquetesDisponibles: any[] = [];
  paquetesFiltrados: any[] = [];
  
  // Filtros
  filtroTipo = 'todos';
  busqueda = '';
  tiposDisponibles: string[] = [];
  
  // Modales
  mostrarModalCompra = false;
  mostrarModalPagoTarjeta = false;
  pasoActual: 'seleccion' | 'datos-pago' | 'procesando' | 'resultado' = 'seleccion';
  
  paqueteSeleccionado: any = null;
  resumenCompra: any = null;
  
  // Formularios
  formularioCompra!: FormGroup;
  formularioPagoTarjeta!: FormGroup;
  
  enviandoCompra = false;
  procesandoPago = false;
  
  // Device Fingerprint
  deviceFingerprintId: string | null = null;
  
  // Configuración
  metodosPago = [
    { value: 'transferencia', label: 'Transferencia Bancaria', icono: 'fa-university' },
    { value: 'deposito', label: 'Depósito Bancario', icono: 'fa-piggy-bank' },
    { value: 'tarjeta', label: 'Pago con Tarjeta', icono: 'fa-credit-card' }
  ];
  
  bancosDisponibles = ['Banco Industrial', 'G&T Continental', 'BAC', 'Banrural'];
  fechaMaxima = new Date().toISOString().split('T')[0];
  horaActual = new Date().toTimeString().slice(0, 5);
  
  aniosExpiracion: string[] = [];
  mesesExpiracion = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  
  mostrarTarjetasPrueba = true;
  tarjetasPrueba = [
    { numero: '4111111111111111', tipo: 'Visa', cvv: '123', descripcion: 'Aprobada' },
    { numero: '4000300011112220', tipo: 'Visa', cvv: '123', descripcion: 'Rechazada' },
    { numero: '5555555555554444', tipo: 'Mastercard', cvv: '123', descripcion: 'Aprobada' }
  ];
  
  resultadoPago: any = null;
  vistaActual: 'tarjetas' | 'lista' = 'tarjetas';

  constructor(
    private compraPaquetesService: CompraPaquetesService,
    private authService: AuthService,
    private cyberSourceService: CyberSourcePaymentService,
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    this.inicializarFormularios();
    this.generarAniosExpiracion();
  }

  // Validador personalizado para tarjeta
  private validadorTarjeta(control: any): { [key: string]: any } | null {
    if (!control.value) return null;
    
    const numero = control.value.replace(/\s/g, '');
    
    if (!/^\d{13,19}$/.test(numero)) {
      return { 
        pattern: { 
          requiredPattern: '^\\d{13,19}$',
          actualValue: numero,
          message: 'El número debe tener entre 13 y 19 dígitos'
        } 
      };
    }
    
    if (!this.cyberSourceService.validateCardNumber(numero)) {
      return { 
        luhn: { 
          message: 'Número de tarjeta inválido' 
        } 
      };
    }
    
    return null;
  }

  ngOnInit(): void {
    this.cargarPaquetesDisponibles();
  }

  ngOnDestroy(): void {
    this.cyberSourceService.cleanupDeviceFingerprint();
  }

  private inicializarFormularios(): void {
    this.formularioCompra = this.formBuilder.group({
      metodo_pago: ['', Validators.required],
      numero_transaccion: [''],
      banco: [''],
      fecha_pago: [this.fechaMaxima, Validators.required],
      hora_pago: [this.horaActual, Validators.required],
      comprobante: [null],
      notas_usuario: [''],
      acepta_terminos: [false, Validators.requiredTrue]
    });

    this.formularioPagoTarjeta = this.formBuilder.group({
      numeroTarjeta: ['', [Validators.required, this.validadorTarjeta.bind(this)]],
      nombreTarjeta: ['', [Validators.required, Validators.minLength(3)]],
      mesExpiracion: ['', Validators.required],
      anioExpiracion: ['', Validators.required],
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
      primerNombre: ['', Validators.required],
      apellido: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{8,15}$/)]],
      direccion: ['', Validators.required],
      ciudad: ['', Validators.required],
      departamento: ['', Validators.required],
      codigoPostal: ['', Validators.required],
      pais: ['GT', Validators.required],
      aceptaTerminos: [false, Validators.requiredTrue]
    });

    this.formularioCompra.get('metodo_pago')?.valueChanges.subscribe(metodo => {
      if (metodo === 'tarjeta') {
        this.abrirModalPagoTarjeta();
      } else {
        this.actualizarValidadoresSegunMetodo(metodo);
      }
    });
  }

  private actualizarValidadoresSegunMetodo(metodo: string): void {
    const numeroTransaccionControl = this.formularioCompra.get('numero_transaccion');
    const bancoControl = this.formularioCompra.get('banco');
    const comprobanteControl = this.formularioCompra.get('comprobante');
    const horaPagoControl = this.formularioCompra.get('hora_pago');

    numeroTransaccionControl?.clearValidators();
    bancoControl?.clearValidators();
    comprobanteControl?.clearValidators();
    horaPagoControl?.clearValidators();

    if (metodo === 'transferencia' || metodo === 'deposito') {
      numeroTransaccionControl?.setValidators([Validators.required]);
      bancoControl?.setValidators([Validators.required]);
      comprobanteControl?.setValidators([Validators.required]);
      horaPagoControl?.setValidators([Validators.required]);
    } else {
      horaPagoControl?.setValidators([Validators.required]);
    }

    numeroTransaccionControl?.updateValueAndValidity();
    bancoControl?.updateValueAndValidity();
    comprobanteControl?.updateValueAndValidity();
    horaPagoControl?.updateValueAndValidity();
  }

  private generarAniosExpiracion(): void {
    const anioActual = new Date().getFullYear();
    for (let i = 0; i < 15; i++) {
      this.aniosExpiracion.push((anioActual + i).toString());
    }
  }

  async cargarPaquetesDisponibles(): Promise<void> {
    this.cargando = true;
    this.error = null;

    try {
      this.paquetesDisponibles = await this.compraPaquetesService.obtenerPaquetesParaCompra();
      this.extraerTiposDisponibles();
      this.aplicarFiltros();
    } catch (error) {
      console.error('Error cargando paquetes:', error);
      this.error = 'Error al cargar los paquetes disponibles.';
    } finally {
      this.cargando = false;
    }
  }

  private extraerTiposDisponibles(): void {
    const tipos = [...new Set(this.paquetesDisponibles.map(p => p.tipo))];
    this.tiposDisponibles = tipos.sort();
  }

  aplicarFiltros(): void {
    let paquetesFiltrados = [...this.paquetesDisponibles];

    if (this.filtroTipo !== 'todos') {
      paquetesFiltrados = paquetesFiltrados.filter(p => p.tipo === this.filtroTipo);
    }

    if (this.busqueda.trim()) {
      const termino = this.busqueda.toLowerCase().trim();
      paquetesFiltrados = paquetesFiltrados.filter(p =>
        p.nombre.toLowerCase().includes(termino) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(termino))
      );
    }

    this.paquetesFiltrados = paquetesFiltrados;
  }

  onFiltroTipoChange(): void {
    this.aplicarFiltros();
  }

  onBusquedaChange(): void {
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.filtroTipo = 'todos';
    this.busqueda = '';
    this.aplicarFiltros();
  }

  abrirModalCompra(paquete: any): void {
    this.paqueteSeleccionado = paquete;
    this.resumenCompra = this.compraPaquetesService.calcularResumenCompra(paquete);
    this.resetearFormularios();
    this.mostrarModalCompra = true;
    this.pasoActual = 'seleccion';
  }

  cerrarModalCompra(): void {
    this.mostrarModalCompra = false;
    this.mostrarModalPagoTarjeta = false;
    this.paqueteSeleccionado = null;
    this.resumenCompra = null;
    this.resultadoPago = null;
    this.pasoActual = 'seleccion';
    this.resetearFormularios();
  }

  async abrirModalPagoTarjeta(): Promise<void> {
    console.log('💳 Abriendo modal de pago con tarjeta...');
    
    this.mostrarModalCompra = false;
    this.mostrarModalPagoTarjeta = true;
    this.pasoActual = 'datos-pago';
    
    this.deviceFingerprintId = this.cyberSourceService.initializeDeviceFingerprint();
    console.log('🔐 Device Fingerprint inicializado:', this.deviceFingerprintId);
    
    if (!this.deviceFingerprintId) {
      console.error('❌ Error: No se pudo inicializar Device Fingerprint');
      this.error = 'Error al inicializar el sistema de seguridad. Por favor, recarga la página.';
      return;
    }
    
    this.precargarDatosUsuario();
    
    console.log('⏳ Esperando carga completa de Device Fingerprint...');
    await this.delay(100);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  volverASeleccion(): void {
    this.mostrarModalPagoTarjeta = false;
    this.mostrarModalCompra = true;
    this.pasoActual = 'seleccion';
    this.formularioCompra.patchValue({ metodo_pago: '' });
    
    this.cyberSourceService.cleanupDeviceFingerprint();
    this.deviceFingerprintId = null;
  }

  private precargarDatosUsuario(): void {
    const usuario = this.authService.getCurrentUser();
    if (usuario) {
      const nombres = usuario.full_name?.split(' ') || ['', ''];
      
      this.formularioPagoTarjeta.patchValue({
        primerNombre: nombres[0],
        apellido: nombres.slice(1).join(' ') || nombres[0],
        email: usuario.username
      });
    }
  }

  private resetearFormularios(): void {
    this.formularioCompra.reset({
      fecha_pago: this.fechaMaxima,
      hora_pago: this.horaActual,
      acepta_terminos: false
    });
    
    this.formularioPagoTarjeta.reset({
      pais: 'GT',
      aceptaTerminos: false
    });
    
    this.error = null;
  }

  async procesarPagoTarjeta(): Promise<void> {
    console.log('💳 Iniciando procesamiento de pago con tarjeta...');

    if (!this.formularioPagoTarjeta.valid) {
      this.marcarErroresFormulario(this.formularioPagoTarjeta);
      this.error = 'Por favor completa todos los campos requeridos';
      return;
    }

    if (!this.paqueteSeleccionado || !this.resumenCompra) {
      this.error = 'No hay paquete seleccionado';
      return;
    }
    
    if (!this.deviceFingerprintId) {
      console.error('❌ Device Fingerprint no disponible, reinicializando...');
      this.deviceFingerprintId = this.cyberSourceService.initializeDeviceFingerprint();
      
      if (!this.deviceFingerprintId) {
        this.error = 'Error de seguridad: No se pudo inicializar el sistema de protección. Por favor, recarga la página e intenta nuevamente.';
        return;
      }
      
      console.log('⏳ Esperando inicialización completa de Device Fingerprint...');
      await this.delay(200);
    }
    
    console.log('🔐 Device Fingerprint confirmado:', this.deviceFingerprintId);

    this.procesandoPago = true;
    this.pasoActual = 'procesando';
    this.error = null;

    try {
      const formValues = this.formularioPagoTarjeta.value;
      
      const paymentData: PaymentFormData = {
        cardNumber: formValues.numeroTarjeta.replace(/\s/g, ''),
        cardholderName: formValues.nombreTarjeta,
        expirationMonth: formValues.mesExpiracion,
        expirationYear: formValues.anioExpiracion,
        cvv: formValues.cvv,
        firstName: formValues.primerNombre,
        lastName: formValues.apellido,
        email: formValues.email,
        phoneNumber: formValues.telefono,
        address: formValues.direccion,
        city: formValues.ciudad,
        state: formValues.departamento,
        postalCode: formValues.codigoPostal,
        country: formValues.pais,
        packageId: this.paqueteSeleccionado.id,
        amount: this.resumenCompra.precio_final,
        currency: 'GTQ',
        deviceFingerprintId: this.deviceFingerprintId,
        acceptTerms: formValues.aceptaTerminos
      };

      const resultado = await this.cyberSourceService.processPayment(paymentData);

      this.resultadoPago = resultado;
      this.pasoActual = 'resultado';

      if (resultado.success) {
        console.log('✅ Pago exitoso:', resultado.transactionId);
      } else {
        console.error('❌ Pago rechazado:', resultado.message);
        this.error = resultado.message;
      }

    } catch (error: any) {
      console.error('❌ Error procesando pago:', error);
      this.error = error.message || 'Error al procesar el pago con tarjeta';
      this.pasoActual = 'datos-pago';
    } finally {
      this.procesandoPago = false;
    }
  }

  async realizarCompra(): Promise<void> {
    if (!this.formularioCompra.valid || !this.paqueteSeleccionado) {
      this.marcarErroresFormulario(this.formularioCompra);
      this.error = 'Por favor completa todos los campos requeridos';
      return;
    }

    this.enviandoCompra = true;
    this.error = null;

    try {
      const formValues = this.formularioCompra.value;
      
      const formularioCompra: any = {
        paquete_id: this.paqueteSeleccionado.id,
        metodo_pago: formValues.metodo_pago,
        numero_transaccion: formValues.numero_transaccion,
        banco: formValues.banco,
        fecha_pago: formValues.fecha_pago,
        hora_pago: formValues.hora_pago,
        comprobante: formValues.comprobante,
        notas_usuario: formValues.notas_usuario,
        acepta_terminos: formValues.acepta_terminos
      };

      const resultado = await this.compraPaquetesService.realizarCompraPaquete(formularioCompra);
      
      alert(resultado.mensaje);
      this.cerrarModalCompra();

      setTimeout(() => {
        this.router.navigate(['/mis-paquetes']);
      }, 2000);

    } catch (error: any) {
      console.error('❌ Error realizando compra:', error);
      this.error = error.message || 'Error al procesar la compra.';
    } finally {
      this.enviandoCompra = false;
    }
  }

  onNumeroTarjetaInput(event: any): void {
    let valor = event.target.value.replace(/\s/g, '');
    valor = valor.replace(/[^0-9]/g, '');
    
    if (valor.length > 19) {
      valor = valor.substring(0, 19);
    }
    
    const formatted = this.cyberSourceService.formatCardNumber(valor);
    this.formularioPagoTarjeta.patchValue({ numeroTarjeta: formatted }, { emitEvent: false });
  }

  get numeroTarjetaValido(): boolean {
    const numero = this.formularioPagoTarjeta.get('numeroTarjeta')?.value || '';
    return this.cyberSourceService.validateCardNumber(numero);
  }

  get tipoTarjeta(): string | null {
    const numero = this.formularioPagoTarjeta.get('numeroTarjeta')?.value || '';
    return this.cyberSourceService.detectCardType(numero);
  }

  usarTarjetaPrueba(tarjeta: any): void {
    this.formularioPagoTarjeta.patchValue({
      numeroTarjeta: this.cyberSourceService.formatCardNumber(tarjeta.numero),
      nombreTarjeta: 'USUARIO PRUEBA',
      mesExpiracion: '12',
      anioExpiracion: '2025',
      cvv: tarjeta.cvv
    });
  }

  onArchivoSeleccionado(event: any): void {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const validacion = this.compraPaquetesService.validarFormatoComprobante(archivo);
    if (!validacion.valido) {
      this.error = validacion.error || 'Archivo no válido';
      event.target.value = '';
      this.formularioCompra.patchValue({ comprobante: null });
      return;
    }

    this.formularioCompra.patchValue({ comprobante: archivo });
    this.error = null;
  }

  obtenerNombreArchivo(): string {
    const archivo = this.formularioCompra.get('comprobante')?.value;
    return archivo ? archivo.name : '';
  }

  eliminarArchivo(): void {
    this.formularioCompra.patchValue({ comprobante: null });
    const inputFile = document.getElementById('comprobante') as HTMLInputElement;
    if (inputFile) {
      inputFile.value = '';
    }
  }

  private marcarErroresFormulario(formulario: FormGroup): void {
    Object.keys(formulario.controls).forEach(key => {
      const control = formulario.get(key);
      if (control && control.invalid) {
        control.markAsTouched();
      }
    });
  }

  private obtenerErroresFormulario(formulario: FormGroup): { [key: string]: any } {
    const errores: { [key: string]: any } = {};
    
    Object.keys(formulario.controls).forEach(key => {
      const control = formulario.get(key);
      if (control && control.invalid) {
        errores[key] = control.errors;
      }
    });
    
    return errores;
  }

  formatearPrecio(precio: number): string {
    return this.compraPaquetesService.formatearPrecio(precio);
  }

  calcularPorcentajeDescuento(paquete: any): number {
    if (!paquete.mejor_descuento) return 0;
    return Math.round(((paquete.precio - paquete.mejor_descuento.precio_final) / paquete.precio) * 100);
  }

  cambiarVista(vista: 'tarjetas' | 'lista'): void {
    this.vistaActual = vista;
  }

  get metodoPagoSeleccionado(): string {
    return this.formularioCompra.get('metodo_pago')?.value || '';
  }

  get requiereNumeroTransaccion(): boolean {
    const metodo = this.metodoPagoSeleccionado;
    return ['transferencia', 'deposito'].includes(metodo);
  }

  get requiereBanco(): boolean {
    const metodo = this.metodoPagoSeleccionado;
    return ['transferencia', 'deposito'].includes(metodo);
  }

  get requiereComprobante(): boolean {
    const metodo = this.metodoPagoSeleccionado;
    return ['transferencia', 'deposito'].includes(metodo);
  }

  get pagoExitoso(): boolean {
    return this.resultadoPago?.success === true;
  }

  get pagoRechazado(): boolean {
    return this.resultadoPago?.success === false;
  }

  finalizarPago(): void {
    if (this.pagoExitoso) {
      this.cerrarModalCompra();
      this.router.navigate(['/mis-paquetes']);
    } else {
      this.pasoActual = 'datos-pago';
      this.resultadoPago = null;
    }
  }

  verEstadoFormulario(): void {
    const form = this.formularioPagoTarjeta;
    console.log('====================================');
    console.log('📋 ESTADO DEL FORMULARIO DE PAGO CON TARJETA');
    console.log('====================================');
    console.log('✅ Formulario válido:', form.valid);
    console.log('📝 Formulario dirty:', form.dirty);
    console.log('👆 Formulario touched:', form.touched);
    console.log('\n📊 ESTADO DE CAMPOS:');
    
    Object.keys(form.controls).forEach(key => {
      const control = form.get(key);
      if (control?.invalid) {
        console.log(`❌ ${key}:`, {
          valor: control.value,
          valido: control.valid,
          errores: control.errors,
          touched: control.touched,
          dirty: control.dirty
        });
      } else {
        console.log(`✅ ${key}:`, control?.value);
      }
    });
    
    console.log('\n🔍 RESUMEN:');
    console.log('- Campos inválidos:', Object.keys(this.obtenerErroresFormulario(form)).length);
    console.log('- Errores:', this.obtenerErroresFormulario(form));
    console.log('====================================');
  }
}