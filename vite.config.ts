import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || "https://ysufsxcwfumqqssjljmt.supabase.co"),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzdWZzeGN3ZnVtcXFzc2psam10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTExMTgsImV4cCI6MjA4NzE4NzExOH0.HXDQuKd3Kk0GvW-3bovR4o-17khZGlSXpB0Py0NXx20"),
    'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(process.env.VITE_SUPABASE_PROJECT_ID || "ysufsxcwfumqqssjljmt"),
  },
}));
