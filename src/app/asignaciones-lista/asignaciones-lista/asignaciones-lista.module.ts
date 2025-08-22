import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AsignacionesListaRoutingModule } from './asignaciones-lista-routing.module';
import { AsignacionesListaComponent } from './asignaciones-lista/asignaciones-lista.component';


@NgModule({
  declarations: [
    AsignacionesListaComponent
  ],
  imports: [
    CommonModule,
    AsignacionesListaRoutingModule
  ]
})
export class AsignacionesListaModule { }
