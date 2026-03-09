import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hkcbqrcgcsxpcuowkeyv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrY2JxcmNnY3N4cGN1b3drZXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2Mzc5MzUsImV4cCI6MjA3MDIxMzkzNX0.-oyQFnAzI5_LAjCt3V1Hc3IY3cy4SFvKGmly2ldkxTA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
