<script setup>
import { ref, onMounted } from 'vue'

const BASE = import.meta.env.VITE_API_BASE || ''

const authToken = ref(localStorage.getItem('authToken') || '')
const currentUser = ref(JSON.parse(localStorage.getItem('currentUser') || 'null'))
const authMode = ref('login')
const authError = ref('')
const authMessage = ref('')
const email = ref('')
const password = ref('')
const password2 = ref('')
const verifyCode = ref('')
const sending = ref(false)
const countdown = ref(0)

const value = ref('')
const list = ref([])

let countdownTimer = null

async function apiFetch(path, options = {}) {
  const headers = { ...options.headers }
  if (authToken.value) {
    headers['Authorization'] = `Bearer ${authToken.value}`
  }
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  return fetch(`${BASE}${path}`, { ...options, headers })
}

async function sendCode() {
  authError.value = ''
  authMessage.value = ''
  if (!email.value) {
    authError.value = 'Please enter your email first'
    return
  }
  sending.value = true
  const res = await apiFetch('/send-verify-code', {
    method: 'POST',
    body: JSON.stringify({ email: email.value }),
  })
  const data = await res.json()
  sending.value = false
  if (data.code !== 0) {
    authError.value = data.error
    return
  }
  authMessage.value = 'Verification code sent. Check your email.'
  countdown.value = 60
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

async function login() {
  authError.value = ''
  const res = await apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.value, password: password.value }),
  })
  const data = await res.json()
  if (data.code !== 0) {
    authError.value = data.error
    return
  }
  authToken.value = data.data.token
  currentUser.value = { userId: data.data.userId, email: email.value }
  localStorage.setItem('authToken', data.data.token)
  localStorage.setItem('currentUser', JSON.stringify(currentUser.value))
  fetchTasks()
}

async function register() {
  authError.value = ''
  authMessage.value = ''
  if (password.value !== password2.value) {
    authError.value = 'Passwords do not match'
    return
  }
  if (password.value.length < 6) {
    authError.value = 'Password must be at least 6 characters'
    return
  }
  if (!verifyCode.value) {
    authError.value = 'Please enter verification code'
    return
  }
  const res = await apiFetch('/register', {
    method: 'POST',
    body: JSON.stringify({ email: email.value, password: password.value, code: verifyCode.value }),
  })
  const data = await res.json()
  if (data.code !== 0) {
    authError.value = data.error
    return
  }
  authMessage.value = 'Registration successful! You can now login.'
  email.value = ''
  password.value = ''
  password2.value = ''
  verifyCode.value = ''
  authMode.value = 'login'
}

function logout() {
  authToken.value = ''
  currentUser.value = null
  localStorage.removeItem('authToken')
  localStorage.removeItem('currentUser')
  list.value = []
}

async function fetchTasks() {
  const res = await apiFetch('/fetch_tasks')
  const data = await res.json()
  if (data.code !== 0) {
    list.value = []
    return
  }
  list.value = data
}

async function add() {
  if (!value.value.trim()) return
  await apiFetch('/add_task', {
    method: 'POST',
    body: JSON.stringify({ value: value.value, isCompleted: false }),
  })
  value.value = ''
  fetchTasks()
}

async function del(item) {
  await apiFetch(`/delete_task?id=${item.id}`, { method: 'POST' })
  fetchTasks()
}

async function toggle(item, checked) {
  await apiFetch(`/toggle_complete?id=${item.id}`, {
    method: 'POST',
    body: JSON.stringify({ isCompleted: checked }),
  })
  fetchTasks()
}

onMounted(() => {
  if (authToken.value) fetchTasks()
})
</script>

<template>
  <div class="todo-app" :class="{ 'auth-mode': !authToken }">
    <!-- Auth UI -->
    <div v-if="!authToken" class="auth-container">
      <div class="title">Todo App</div>

      <div class="auth-tabs">
        <span
          :class="{ active: authMode === 'login' }"
          @click="authMode = 'login'; authError = ''; authMessage = ''"
        >Login</span>
        <span
          :class="{ active: authMode === 'register' }"
          @click="authMode = 'register'; authError = ''; authMessage = ''"
        >Register</span>
      </div>

      <div v-if="authError" class="auth-error">{{ authError }}</div>
      <div v-if="authMessage" class="auth-message">{{ authMessage }}</div>

      <!-- Email -->
      <input v-model="email" type="email" class="todo-input auth-input" placeholder="Email" />

      <!-- Register mode: code + send button -->
      <div v-if="authMode === 'register'" class="code-row">
        <input v-model="verifyCode" type="text" class="todo-input code-input" placeholder="Verification code" maxlength="6" />
        <div
          @click="sendCode"
          class="send-code-btn"
          :class="{ disabled: sending || countdown > 0 }"
        >
          {{ countdown > 0 ? `${countdown}s` : sending ? '...' : 'Send Code' }}
        </div>
      </div>

      <!-- Password -->
      <input v-model="password" type="password" class="todo-input auth-input" placeholder="Password"
        @keyup.enter="authMode === 'login' ? login() : register()" />

      <!-- Confirm password (register only) -->
      <input v-if="authMode === 'register'" v-model="password2" type="password" class="todo-input auth-input" placeholder="Confirm password"
        @keyup.enter="register()" />

      <!-- Submit button -->
      <div
        @click="authMode === 'login' ? login() : register()"
        class="todo-button auth-button"
      >
        {{ authMode === 'login' ? 'Login' : 'Register' }}
      </div>
    </div>

    <!-- Todo UI -->
    <div v-else>
      <div class="header">
        <span class="user-info">{{ currentUser?.email }}</span>
        <span @click="logout" class="logout-btn">Logout</span>
      </div>

      <div class="todo-form">
        <input
          v-model="value"
          type="text"
          class="todo-input"
          placeholder="Add a todo"
          @keyup.enter="add"
        />
        <div @click="add" class="todo-button">Add Todo</div>
      </div>

      <div
        v-for="item in list"
        :key="item.id"
        :class="[item.isCompleted ? 'completed' : 'item']"
      >
        <div>
          <input :checked="item.isCompleted" @change="toggle(item, $event.target.checked)" type="checkbox" />
          <span class="name">{{ item.value }}</span>
        </div>
        <div @click="del(item)" class="del">del</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  transition: all 0.2s ease;
}

/* ===== Layout ===== */
.todo-app {
  box-sizing: border-box;
  padding: 30px 0;
  width: 100%;
  min-height: 100vh;
  color: #333;
}

.todo-app.auth-mode {
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* ===== Title ===== */
.title {
  text-align: center;
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 8px;
  background: linear-gradient(135deg, rgb(113, 65, 168), rgba(44, 114, 251, 1));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ===== Auth Card ===== */
.auth-container {
  width: 420px;
  padding: 44px 40px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(113, 65, 168, 0.15), 0 4px 20px rgba(0, 0, 0, 0.08);
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.auth-tabs {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 28px;
}

.auth-tabs span {
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  color: #aaa;
  padding-bottom: 6px;
  user-select: none;
  border-bottom: 2px solid transparent;
}

.auth-tabs span.active {
  color: rgb(113, 65, 168);
  border-bottom-color: rgb(113, 65, 168);
  font-weight: 600;
}

.auth-error {
  background: #fef2f2;
  color: #dc2626;
  text-align: center;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 500;
}

.auth-message {
  background: #f0fdf4;
  color: #16a34a;
  text-align: center;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 500;
}

/* ===== Inputs ===== */
.auth-input,
.code-input {
  width: 100%;
  border-radius: 12px;
  margin-bottom: 14px;
  border: 1.5px solid #e5e7eb;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.auth-input:focus,
.code-input:focus {
  border-color: rgb(113, 65, 168);
  box-shadow: 0 0 0 3px rgba(113, 65, 168, 0.1);
  outline: none;
}

.code-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.code-input {
  flex: 1;
  border-radius: 12px;
  min-width: 0;
}

.send-code-btn {
  flex-shrink: 0;
  height: 50px;
  line-height: 50px;
  padding: 0 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgb(113, 65, 168), rgba(44, 114, 251, 1));
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  user-select: none;
  white-space: nowrap;
}

.send-code-btn:hover:not(.disabled) {
  transform: scale(1.03);
  box-shadow: 0 4px 16px rgba(113, 65, 168, 0.3);
}

.send-code-btn.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.auth-button {
  width: 100%;
  border-radius: 12px;
  margin-top: 6px;
  font-weight: 600;
  font-size: 15px;
}

.auth-button:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 24px rgba(113, 65, 168, 0.35);
}

/* ===== Todo Mode ===== */
.header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  padding: 0 30px 16px 30px;
  border-bottom: 1px solid #eee;
  margin-bottom: 24px;
}

.user-info {
  color: #999;
  font-size: 13px;
}

.logout-btn {
  color: rgb(113, 65, 168);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  user-select: none;
  padding: 4px 12px;
  border-radius: 8px;
}

.logout-btn:hover {
  background: rgba(113, 65, 168, 0.08);
}

/* ===== Todo Form ===== */
.todo-form {
  display: flex;
  justify-content: center;
  margin: 24px 0 28px 0;
}

.todo-input {
  padding: 0 16px;
  border-radius: 12px 0 0 12px;
  border: 1.5px solid #e5e7eb;
  outline: none;
  width: 55%;
  height: 50px;
  box-sizing: border-box;
  font-size: 15px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.todo-input:focus {
  border-color: rgb(113, 65, 168);
  box-shadow: 0 0 0 3px rgba(113, 65, 168, 0.1);
}

.todo-button {
  width: 110px;
  height: 50px;
  border-radius: 0 12px 12px 0;
  text-align: center;
  background: linear-gradient(135deg, rgb(113, 65, 168), rgba(44, 114, 251, 1));
  color: #fff;
  line-height: 50px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  user-select: none;
}

.todo-button:hover {
  box-shadow: 0 4px 16px rgba(113, 65, 168, 0.3);
}

/* ===== Todo Items ===== */
.item,
.completed {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 70%;
  height: 52px;
  margin: 10px auto;
  padding: 0 20px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s, box-shadow 0.15s;
}

.item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.completed {
  opacity: 0.45;
  text-decoration: line-through;
}

.item input[type="checkbox"],
.completed input[type="checkbox"] {
  accent-color: rgb(113, 65, 168);
  width: 18px;
  height: 18px;
  margin-right: 12px;
  cursor: pointer;
}

.name {
  font-size: 15px;
}

.del {
  color: #ef4444;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 8px;
}

.del:hover {
  background: #fef2f2;
}
</style>
