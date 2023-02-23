import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
// import { createPinia } from 'pinia'
import { createPinia } from '@/pinia'

const pinia = createPinia()

pinia.use(({ store }) => {
  const state = localStorage.getItem('piniaState')
  if (state) {
    store.$state = JSON.parse(state)
  }
  store.$subscribe((mutation, state) => {
    localStorage.setItem('piniaState', JSON.stringify(state))
  })
})

createApp(App).use(pinia).mount('#app')
