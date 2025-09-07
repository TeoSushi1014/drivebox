
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url'; // Added import

// Define __filename and __dirname for ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // loadEnv removed because env wasn't used; re-add if needed in future
    return {
      plugins: [react()],
      base: '/drivebox/',
  define: {
        // Ensure API_KEY is available if you plan to use it client-side,
        // but prefer server-side usage for security.
        // 'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY), 
        // 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
  },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'), // __dirname is now defined
        }
      },
      server: {
        headers: {
          // This is crucial for FedCM (Google Sign-In) to work in development
          "Permissions-Policy": "identity-credentials-get=*",
          // Added based on user's advice for http/localhost testing
          "Referrer-Policy": "no-referrer-when-downgrade"
        }
      },
      build: {
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true, // Remove console.log statements in production build
          },
        },
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', 'jwt-decode'], // Group common vendor libraries
              styled: ['styled-components'], // If styled-components is large enough
              // You can add more chunks as needed, e.g., for charting libraries
            }
          }
        }
      }
    };
});