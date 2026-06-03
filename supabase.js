const SUPABASE_URL =
    "https://mzupekruklljtzjsuarw.supabase.co";

const SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dXBla3J1a2xsanR6anN1YXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNzEzNzMsImV4cCI6MjA5NTk0NzM3M30.5wcUgi1DR34RUgef28qFp_Sr4p0xtZITRcbrDA26rGo";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// penting: expose ke window supaya bisa diakses file lain
window.db = db;