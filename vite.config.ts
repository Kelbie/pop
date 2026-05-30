import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `vite preview` serves the production build on Railway. It uses index.html
  // as the SPA fallback, so deep links like /p/:id resolve on refresh.
  preview: {
    host: true, // bind 0.0.0.0 so Railway can route to the container
    port: Number(process.env.PORT) || 4173, // Railway injects PORT at runtime
    allowedHosts: true, // accept the dynamic *.up.railway.app / custom domain host
  },
})
