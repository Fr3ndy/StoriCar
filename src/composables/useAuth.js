import { ref, readonly } from 'vue'
import { supabase } from '../lib/supabase'

// Stato singleton a livello di modulo
const user = ref(null)
const authReady = ref(false)

// Carica sessione esistente all'avvio
supabase.auth.getSession().then(({ data: { session } }) => {
  console.log('[useAuth] getSession -', session ? 'sessione trovata: ' + session.user?.email : 'nessuna sessione')
  user.value = session?.user ?? null
  authReady.value = true
})

// Aggiorna utente ad ogni cambio di stato auth
supabase.auth.onAuthStateChange((_event, session) => {
  console.log('[useAuth] onAuthStateChange - evento:', _event, '| utente:', session?.user?.email ?? 'null')
  user.value = session?.user ?? null
  authReady.value = true
})

export function useAuth() {
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + (import.meta.env.BASE_URL || '/')
      }
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return {
    user: readonly(user),
    authReady: readonly(authReady),
    signInWithGoogle,
    signOut
  }
}
