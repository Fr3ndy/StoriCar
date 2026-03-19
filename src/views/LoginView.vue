<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { signInWithGoogle, continueAsGuest } = useAuth()
const loading = ref(false)
const error   = ref('')

async function login() {
  loading.value = true
  error.value   = ''
  try {
    await signInWithGoogle()
  } catch {
    error.value   = 'Errore durante il login. Riprova.'
    loading.value = false
  }
}

function enterAsGuest() {
  continueAsGuest()
  router.push('/')
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">

      <!-- Logo -->
      <div class="login-logo">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      </div>

      <h1 class="login-title">Storicar</h1>
      <p class="login-sub">Il diario di bordo dei tuoi consumi</p>

      <p v-if="error" class="login-error">{{ error }}</p>

      <!-- Google login -->
      <button class="btn-google" @click="login" :disabled="loading">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;flex-shrink:0">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {{ loading ? 'Reindirizzamento…' : 'Accedi con Google' }}
      </button>

      <!-- Divider -->
      <div class="login-divider">
        <span>oppure</span>
      </div>

      <!-- Guest -->
      <button class="btn-guest" @click="enterAsGuest" :disabled="loading">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:18px;height:18px;flex-shrink:0">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        Continua come ospite
      </button>

      <p class="login-note">
        Da ospite i dati rimangono solo su questo dispositivo.<br/>
        Accedi con Google per sincronizzarli ovunque.
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg-primary);
}

.login-card {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.login-logo {
  width: 68px;
  height: 68px;
  background: var(--primary);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.login-logo svg { width: 34px; height: 34px; color: white; }

.login-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.5px;
  margin-bottom: 6px;
  text-align: center;
}

.login-sub {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 32px;
  text-align: center;
  line-height: 1.4;
}

.login-error {
  width: 100%;
  font-size: 13px;
  color: var(--danger);
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
  text-align: center;
}

.btn-google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s;
}
.btn-google:hover:not(:disabled) {
  border-color: #2563eb;
  box-shadow: 0 2px 12px rgba(37,99,235,0.15);
}
.btn-google:disabled { opacity: 0.6; cursor: not-allowed; }

.login-divider {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0;
  color: var(--text-secondary);
  font-size: 12px;
}
.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.btn-guest {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--r-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
}
.btn-guest:hover:not(:disabled) {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.btn-guest:disabled { opacity: 0.6; cursor: not-allowed; }

.login-note {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 20px;
  line-height: 1.6;
}
</style>
