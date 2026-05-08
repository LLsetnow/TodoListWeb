<script setup>
import { ref, onMounted } from 'vue'

const BASE = import.meta.env.VITE_API_BASE || ''

const value = ref('')
const list = ref([])

async function fetchTasks() {
  const res = await fetch(`${BASE}/fetch_tasks`)
  list.value = await res.json()
}

async function add() {
  if (!value.value.trim()) return
  await fetch(`${BASE}/add_task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: value.value, isCompleted: false }),
  })
  value.value = ''
  fetchTasks()
}

async function del(item, index) {
  await fetch(`${BASE}/delete_task?id=${item.id}`, { method: 'POST' })
  fetchTasks()
}

async function toggle(item, checked) {
  await fetch(`${BASE}/toggle_complete?id=${item.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isCompleted: checked }),
  })
  fetchTasks()
}

onMounted(fetchTasks)
</script>
<template>
  <div class="todo-app">
    <div class="title">Todo App</div>

    <div class="todo-form">
      <input
        v-model="value"
        type="text"
        class="todo-input"
        placeholder="Add a todo"
      />
      <div @click="add" class="todo-button">Add Todo</div>
    </div>

    <div
      v-for="(item, index) in list"
      :class="[item.isCompleted ? 'completed' : 'item']"
    >
      <div>
        <input :checked="item.isCompleted" @change="toggle(item, $event.target.checked)" type="checkbox" />
        <span class="name">{{ item.value }}</span>
      </div>

      <div @click="del(item, index)" class="del">del</div>
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

.title {
  text-align: center;
  font-size: 30px;
  font-weight: 700;
}

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
