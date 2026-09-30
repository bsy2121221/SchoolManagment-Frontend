import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // import.meta.dirname, not __dirname: Vite 8's native config loader does not
    // provide the CJS globals, and it becomes the default in a future major.
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // The API calls UseHttpsRedirection(), so the http://localhost:5124 profile
      // answers with a 307 to https. Target the https profile directly and accept
      // the ASP.NET dev certificate (`dotnet dev-certs https --trust`).
      //
      // Proxying under a same-origin /api path also means no CORS preflight in dev.
      '/api': {
        target: 'https://localhost:7180',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
