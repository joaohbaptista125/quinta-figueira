'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { BaseDados } from '@/lib/tipos-bd'
import { supabaseChaveAnonima, supabaseUrl } from './configuracao'

/** Cliente Supabase para componentes que correm no browser. */
export function criarClienteBrowser() {
  return createBrowserClient<BaseDados>(supabaseUrl, supabaseChaveAnonima)
}
