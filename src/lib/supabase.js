import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cgqwkopvoegpkxixwwtk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNncXdrb3B2b2VncGt4aXh3d3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjYxNzUsImV4cCI6MjA5NTcwMjE3NX0.90NOiaxDjwD8i5haUwQl7xRC8mRiWM2fyDqcOuXbKCk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)