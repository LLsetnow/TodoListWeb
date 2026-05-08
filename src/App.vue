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
.todo-app {
  box-sizing: border-box;
  margin-top: 40px;
  margin-left: 1%;
  padding: 30px 0 30px 0;
  width: 98%;
  min-height: 500px;
  background: #ffffff;
  color: #333;
  border-radius: 5px;
}

.todo-app.auth-mode {
  margin: 0;
  width: 100%;
  min-height: 100vh;
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
}

.title {
  text-align: center;
  font-size: 30px;
  font-weight: 700;
  margin-bottom: 20px;
}

/* Header */
.header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  padding: 0 30px 20px 30px;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
}

.user-info {
  color: #666;
  font-size: 14px;
}

.logout-btn {
  color: rgb(113, 65, 168);
  cursor: pointer;
  font-size: 14px;
  user-select: none;
}

.logout-btn:hover {
  text-decoration: underline;
}

/* Auth */
.auth-container {
  width: 400px;
  padding: 40px 36px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1);
}

.auth-tabs {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 20px;
}

.auth-tabs span {
  cursor: pointer;
  font-size: 16px;
  color: #999;
  padding-bottom: 4px;
  user-select: none;
}

.auth-tabs span.active {
  color: rgb(113, 65, 168);
  border-bottom: 2px solid rgb(113, 65, 168);
}

.auth-error {
  color: #e74c3c;
  text-align: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.auth-message {
  color: #27ae60;
  text-align: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.auth-input {
  width: 100%;
  border-radius: 20px;
  margin-bottom: 12px;
}

.code-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.code-input {
  flex: 1;
  border-radius: 20px;
  min-width: 0;
}

.send-code-btn {
  flex-shrink: 0;
  height: 50px;
  line-height: 50px;
  padding: 0 16px;
  border-radius: 20px;
  background: linear-gradient(to right, rgb(113, 65, 168), rgba(44, 114, 251, 1));
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  user-select: none;
  white-space: nowrap;
}

.send-code-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-button {
  width: 100%;
  border-radius: 20px;
  margin-top: 8px;
}

/* Todo */
.todo-form {
  display: flex;
  justify-content: center;
  margin: 20px 0 30px 0;
}

.todo-button {
  width: 100px;
  height: 52px;
  border-radius: 0 20px 20px 0;
  text-align: center;
  background: linear-gradient(
    to right,
    rgb(113, 65, 168),
    rgba(44, 114, 251, 1)
  );
  color: #fff;
  line-height: 52px;
  cursor: pointer;
  font-size: 14px;
  user-select: none;
}

.todo-input {
  padding: 0px 15px 0px 15px;
  border-radius: 20px 0 0 20px;
  border: 1px solid #dfe1e5;
  outline: none;
  width: 60%;
  height: 50px;
  box-sizing: border-box;
}

.item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 80%;
  height: 50px;
  margin: 8px auto;
  padding: 16px;
  border-radius: 20px;
  box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 20px;
}

.del {
  color: red;
  cursor: pointer;
  user-select: none;
}

.completed {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 80%;
  height: 50px;
  margin: 8px auto;
  padding: 16px;
  border-radius: 20px;
  box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 20px;
  text-decoration: line-through;
  opacity: 0.4;
}
</style>
