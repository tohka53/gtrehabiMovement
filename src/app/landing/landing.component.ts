// src/app/landing/landing.component.ts
import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: false,
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit, AfterViewInit {
  @ViewChild('heroVideo') heroVideo?: ElementRef<HTMLVideoElement>;
  
  // Datos para la sección de servicios
  services = [
    {
      icon: 'fas fa-walking',
      title: 'Evaluación fisioterapéutica personalizada',
      description: 'Realizamos una valoración integral mediante test ortopédicos, análisis de rangos de movimiento, patrones de marcha y pruebas funcionales. Nuestro objetivo es identificar tu condición actual, emitir un diagnóstico fisioterapéutico preciso y establecer el mejor plan de tratamiento basado en tus necesidades.',
      features: ['Terapia manual', 'Ejercicios terapéuticos', 'Reeducación postural']
    },
    {
      icon: 'fas fa-heartbeat',
      title: 'Fisioterapia Deportiva',
      description: 'Tratamiento especializado para la prevención, recuperación y readaptación de lesiones deportivas. Nos enfocamos en restaurar el movimiento funcional, reducir el dolor y optimizar el rendimiento físico mediante ejercicio terapéutico, técnicas manuales y programación específica según tu disciplina deportiva.',
      features: ['Prevención de lesiones', 'Recuperación deportiva', 'Acondicionamiento físico']
    },
    {
      icon: 'fas fa-user-md',
      title: 'Fisioterapia geriátrica',
      description: 'Diseñamos programas de ejercicio seguros y eficaces para personas mayores, basados en herramientas de evaluación clínica y funcional. Nuestro enfoque está en mejorar fuerza, equilibrio, resistencia y capacidad aeróbica, promoviendo una vejez activa, autónoma y con propósito desde etapas tempranas.',
      features: ['Evaluación completa', 'Seguimiento continuo', 'Planes personalizados']
    },
    {
      icon: 'fas fa-spa',
      title: 'Programación de movilidad',
      description: 'A través de ejercicios de movilidad articular, control motor y fuerza, buscamos aumentar tu rango de movimiento y mejorar la calidad del mismo. Ideal para personas con rigidez, dolor, sobrecargas o para quienes desean moverse mejor en su día a día o actividad física.',
      features: ['Masoterapia', 'Electroterapia', 'Termoterapia']
    }
    ,
    {
      icon: 'fas fa-spa',
      title: 'Programación de ejercicios funcionales',
      description: 'Creamos un plan de entrenamiento adaptado a tus objetivos individuales: ya sea ganar fuerza, mejorar la postura, prevenir lesiones o aumentar tu rendimiento. Utilizamos movimientos funcionales y progresiones terapéuticas para que alcances tus metas de forma segura, eficiente y sostenible.',
      features: ['Masoterapia', 'Electroterapia', 'Termoterapia']
    },
    {
      icon: 'fas fa-brain',
      title: 'Fisioterapia neurológica',
      description: 'Tratamiento dirigido a personas con afecciones del sistema nervioso central o periférico, como secuelas de ACV, lesiones medulares, Parkinson o neuropatías. Trabajamos la reeducación del movimiento, el equilibrio, la coordinación y la funcionalidad para favorecer la mayor independencia posible en las actividades de la vida diaria.',
      features: ['Reeducación del movimiento', 'Entrenamiento de equilibrio', 'Recuperación funcional']
    },
    {
      icon: 'fas fa-bone',
      title: 'Fisioterapia traumatológica y ortopedia',
      description: 'Rehabilitación de lesiones del sistema musculoesquelético: fracturas, esguinces, posoperatorios, tendinopatías y problemas articulares. Combinamos terapia manual, ejercicio terapéutico y técnicas de recuperación para reducir el dolor, restaurar la movilidad y devolverte a tus actividades con seguridad.',
      features: ['Rehabilitación posoperatoria', 'Terapia manual', 'Recuperación de lesiones']
    },
    {
      icon: 'fas fa-shield-alt',
      title: 'Fisioterapia preventiva',
      description: 'Enfocada en evitar lesiones antes de que aparezcan. Mediante valoración postural, análisis de movimiento y programas de fortalecimiento, identificamos factores de riesgo y diseñamos estrategias para cuidar tu cuerpo en el trabajo, el deporte y el día a día.',
      features: ['Valoración postural', 'Prevención de lesiones', 'Educación y hábitos saludables']
    }
  ];

  // Datos para la sección de precios
  pricingPlans = [
    {
      name: 'Básico',
      price: 'Q275',
      period: 'por sesión',
      features: [
        'Guía de ejercicios',
        'Sesión de 45 a 60 minutos',
        'Seguimiento personalizado'
      ],
      popular: false,
      buttonText: 'Reservar Cita'
    },
    {
      name: 'Profesional',
      price: 'Q1,125',
      period: 'paquete 5 sesiones',
      features: [
        'Guía de ejercicios',
        'Sesiones de 45 a 60 minutos',
        'Seguimiento personalizado',
        
      ],
      popular: true,
      buttonText: 'Más Popular'
    },
    {
      name: 'Premium',
      price: 'Q2,250',
      period: 'paquete 10 sesiones',
      features: [
        'Guía de ejercicios',
        'Sesiones de 45 a 60 minutos',
        'Seguimiento personalizado',
      ],
      popular: false,
      buttonText: 'Mejor Valor'
    }
  ];

  // Datos del equipo - Solo un fisioterapeuta
  team = [
  {
    name: 'Lic. Estuardo Ponciano',
    role: 'Fisioterapeuta Principal',
    specialization: 'Licenciado en fisioterapia',
   image: '/lucciuki.png', // Opción 3
    experience: '5 años de experiencia'
  }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Inicialización del componente
  }

  ngAfterViewInit(): void {
    // Asegurar autoplay del video del hero (el navegador exige muted)
    const video = this.heroVideo?.nativeElement;
    if (video) {
      video.muted = true;
      const intento = video.play();
      if (intento && typeof intento.catch === 'function') {
        intento.catch(() => { /* autoplay bloqueado: el video queda listo para reproducir */ });
      }
    }
  }

  // Navegación suave a secciones
  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Navegar al login
  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  // Método para contacto
  contactUs(): void {
    this.scrollToSection('contacto');
  }

  // Método para reservar cita
  bookAppointment(): void {
    // Aquí podrías abrir un modal o navegar a una página de reservas
    alert('¡Pronto podrás reservar tu cita online! Por ahora contáctanos directamente.');
  }

  // Método para mostrar más información
  showMoreInfo(service: any): void {
    alert(`Más información sobre: ${service.title}\n\n${service.description}`);
  }

  // Método para obtener las clases CSS dinámicas del grid del equipo
  getTeamGridClasses(): string {
    const teamCount = this.team.length;
    
    if (teamCount === 1) {
      return 'grid grid-cols-1 justify-items-center';
    } else if (teamCount === 2) {
      return 'grid grid-cols-1 md:grid-cols-2 justify-items-center';
    } else {
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 justify-items-center';
    }
  }
}