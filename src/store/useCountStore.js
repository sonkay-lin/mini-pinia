import { defineStore } from "@/pinia";
import { computed, reactive, toRefs } from "vue";

export const useCountStore = defineStore('count', {
  state: () => ({ 
    count: 0,
    list: ['张三', '李四']
  }),
  getters: {
    doubleCount: (store) => store.count * 2
  },
  actions: { //同步异步都在action
    increment() {
      this.count++
    },
    asyncIncrement() {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.count++
          resolve('异步actions成功了')
        }, 1000)
      })
    },
    asyncError() {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          reject('error')
        }, 1000)
      })
    }
  }
})

// export const useCountStore = defineStore('count', () => {
//   const state = reactive({ count: 0 })
//   const doubleCount = computed(() => state.count * 2)
//   const increment = () => state.count++

//   return {
//     ...toRefs(state),
//     doubleCount,
//     increment
//   }
// })