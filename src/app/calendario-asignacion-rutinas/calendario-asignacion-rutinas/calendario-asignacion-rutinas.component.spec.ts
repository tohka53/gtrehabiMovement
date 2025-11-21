import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarioAsignacionRutinasComponent } from './calendario-asignacion-rutinas.component';

describe('CalendarioAsignacionRutinasComponent', () => {
  let component: CalendarioAsignacionRutinasComponent;
  let fixture: ComponentFixture<CalendarioAsignacionRutinasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CalendarioAsignacionRutinasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalendarioAsignacionRutinasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
