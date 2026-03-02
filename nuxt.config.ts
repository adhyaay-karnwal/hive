import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  devtools: { enabled: false },
  css: ["~/assets/css/app.css"],

  compatibilityDate: "latest",
  ssr: false,
  future: { compatibilityVersion: 4 },
  fonts: { experimental: { disableLocalFallbacks: true } },

  nitro: {
    experimental: {
      websocket: true,
    },
  },

  devServer: {
    port: 3200,
  },

  vite: {
    plugins: [tailwindcss()],
    clearScreen: false,
    server: {
      strictPort: true,
    },
  },

  modules: ["@nuxt/icon", "@nuxt/fonts", "@vueuse/nuxt", "motion-v/nuxt"],
});
