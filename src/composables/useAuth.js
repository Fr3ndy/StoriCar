import { ref, readonly } from 'vue'
import { supabase } from '../lib/supabase'

// Stato singleton a livello di modulo
const user      = ref(null)
const authReady = ref(false)
const isGuest   = ref(localStorage.getItem('storicar_guest') === '1')

// Carica sessione esistente all'avvio
supabase.auth.getSession().then(({ data: { session } }) => {
  console.log('[useAuth] getSession -', session ? 'sessione trovata: ' + session.user?.email : 'nessuna sessione')
  user.value      = session?.user ?? null
  authReady.value = true
  // Se c'è una sessione valida, non serve più la modalità ospite
  if (session?.user) {
    isGuest.value = false
    localStorage.removeItem('storicar_guest')
  }
})

// Aggiorna utente ad ogni cambio di stato auth
supabase.auth.onAuthStateChange((_event, session) => {
  console.log('[useAuth] onAuthStateChange - evento:', _event, '| utente:', session?.user?.email ?? 'null')
  user.value      = session?.user ?? null
  authReady.value = true
  if (session?.user) {
    isGuest.value = false
    localStorage.removeItem('storicar_guest')
  }
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
    isGuest.value = false
    localStorage.removeItem('storicar_guest')
  }

  /** Entra nell'app senza account — dati salvati in localStorage */
  function continueAsGuest() {
    isGuest.value   = true
    authReady.value = true
    localStorage.setItem('storicar_guest', '1')
  }

  return {
    user:            readonly(user),
    authReady:       readonly(authReady),
    isGuest:         readonly(isGuest),
    signInWithGoogle,
    signOut,
    continueAsGuest,
  }
}
