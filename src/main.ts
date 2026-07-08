import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// En producción se silencian los logs de debug (console.error/warn se mantienen)
if (environment.production) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

platformBrowserDynamic().bootstrapModule(AppModule, {
  ngZoneEventCoalescing: true,
})
  .catch(err => console.error(err));
