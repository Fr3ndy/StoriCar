<script setup>
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

defineProps({
  /** Icona SVG path (stroke) da mostrare nell'illustrazione */
  icon: { type: String, default: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  title:       { type: String, default: 'Accesso richiesto' },
  description: { type: String, default: 'Questa sezione è disponibile solo con un account.' },
  featureName: { type: String, default: 'questa funzionalità' },
})

const router = useRouter()
const { signInWithGoogle } = useAuth()

async function login() {
  await signInWithGoogle()
}
</script>

<template>
  <div class="auth-wall">
    <div class="auth-wall-inner">
      <div class="auth-wall-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="icon"/>
        </svg>
      </div>

      <h2 class="auth-wall-title">{{ title }}</h2>
      <p class="auth-wall-desc">{{ description }}</p>

      <div class="auth-wall-benefits">
        <div class="benefit">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Sblocca {{ featureName }}
        </div>
        <div class="benefit">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Sincronizza i dati su tutti i dispositivi
        </div>
        <div class="benefit">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          I tuoi dati da ospite verranno migrati automaticamente
        </div>
      </div>

      <button class="btn-google" @click="login">
        <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Accedi con Google — è gratis
      </button>

      <button class="btn-back" @click="router.back()">Torna indietro</button>
    </div>
  </div>
</template>

<style scoped>
.auth-wall {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  min-height: 60vh;
}

.auth-wall-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 320px;
  width: 100%;
}

.auth-wall-icon {
  width: 80px;
  height: 80px;
  border-radius: 24px;
  background: var(--primary-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.auth-wall-icon svg {
  width: 40px;
  height: 40px;
  color: var(--primary);
}

.auth-wall-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.auth-wall-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 24px;
  line-height: 1.5;
}

.auth-wall-benefits {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
  text-align: left;
}

.benefit {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-primary);
}
.benefit svg {
  width: 18px;
  height: 18px;
  color: var(--success);
  flex-shrink: 0;
}

.btn-google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 16px;
  border: none;
  border-radius: 14px;
  background: var(--primary);
  color: white;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
  margin-bottom: 12px;
}
.btn-google:hover {
  background: var(--primary-dark, #1d4ed8);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
}
.google-icon { width: 20px; height: 20px; flex-shrink: 0; }

.btn-back {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: 8px;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.btn-back:hover { color: var(--text-primary); }
</style>
