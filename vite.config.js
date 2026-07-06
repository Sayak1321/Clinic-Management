import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const brainDir = 'C:\\Users\\sayak\\.gemini\\antigravity-ide\\brain\\38207f3a-d3d3-4034-af5d-0b48186d09b1';
const publicDir = path.resolve(__dirname, './public');

try {
  if (fs.existsSync(brainDir) && fs.existsSync(publicDir)) {
    const files = fs.readdirSync(brainDir);
    const receptionistDark = files.find(f => f.startsWith('receptionist_dashboard_dark') && f.endsWith('.png'));
    const receptionistLight = files.find(f => f.startsWith('receptionist_dashboard_light') && f.endsWith('.png'));
    const doctorDark = files.find(f => f.startsWith('doctor_dashboard_dark') && f.endsWith('.png'));
    const doctorLight = files.find(f => f.startsWith('doctor_dashboard_light_mode') && f.endsWith('.png'));

    if (receptionistDark) {
      fs.copyFileSync(path.join(brainDir, receptionistDark), path.join(publicDir, 'receptionist_dashboard_dark.png'));
    }
    if (receptionistLight) {
      fs.copyFileSync(path.join(brainDir, receptionistLight), path.join(publicDir, 'receptionist_dashboard_light.png'));
    }
    if (doctorDark) {
      fs.copyFileSync(path.join(brainDir, doctorDark), path.join(publicDir, 'doctor_dashboard_dark.png'));
    }
    if (doctorLight) {
      fs.copyFileSync(path.join(brainDir, doctorLight), path.join(publicDir, 'doctor_dashboard_light.png'));
    }
  }
} catch (err) {
  console.error('Failed to copy screenshots:', err);
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          pdf: ['jspdf'],
        },
      },
    },
  },
  envPrefix: 'VITE_',
});
