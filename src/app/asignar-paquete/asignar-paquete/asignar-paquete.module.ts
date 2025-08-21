import { NgModule } from '@angular/core';
import { CommonModule, TitleCasePipe, SlicePipe, DatePipe, CurrencyPipe } from '@angular/common';

import { AsignarPaqueteRoutingModule } from './asignar-paquete-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    AsignarPaqueteRoutingModule,
     ReactiveFormsModule,  // Para formularios reactivos
    FormsModule,          // Para ngModel - CRÍTICO
    RouterModule
  ]
})
export class AsignarPaqueteModule { }
