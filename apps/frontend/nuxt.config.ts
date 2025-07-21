// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui-pro',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@compodium/nuxt'
  ],
  css: ['~/assets/css/main.css']
})