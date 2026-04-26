import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? "https://awgcdhteareaizvssboe.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3Z2NkaHRlYXJlYWl6dnNzYm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDQ5NTMsImV4cCI6MjA5MjcyMDk1M30.ZyXsBAol9tLMhYkdhl1-S_PTLcD57kYqqVEbKrcmCew";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
