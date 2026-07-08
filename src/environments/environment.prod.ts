export const environment = {
  production: true,
  // CyberSource: false = ambiente TEST (apitest/orgId 1snn5n9w). Cambiar a true
  // SOLO cuando Visanet certifique y migre la cuenta a producción
  // (junto con CYBERSOURCE_ENVIRONMENT=PRODUCTION en los secrets de Supabase).
  cybersourceProduction: false,
  supabaseUrl: 'https://shkxmthkdtkyllizapqj.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoa3htdGhrZHRreWxsaXphcHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNzQ1NTMsImV4cCI6MjA2NjY1MDU1M30.XaHIB5eoR9BZJhE3CFPhQkL1S0J9fb_qYF40S9xSqUE',

  // URLs de proveedores sociales (configurar en Supabase Dashboard)
  socialProviders: {
    google: true,
    facebook: true
  }
};
