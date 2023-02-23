<script setup>
import { useCountStore } from '@/store/useCountStore'
const store = useCountStore()
const handleClick = () => {
  // store.count++
  const { increment } = store
  increment()
}

const patch = () => {
  //传入对象
  // store.$patch({
  //   count: ++store.count,
  //   list: [...store.list, '王五']
  // })

  //传入函数
  store.$patch((s) => {
    s.count++
    s.list = [...s.list, '王五']
  })
}

const reset = () => {
  store.$reset()
}

const state = () => {
  store.$state = {
    count: 10
  }
}

store.$subscribe((mutation, state) => {
  console.log('数据变化了', mutation, state)
})

store.$onAction(({ after, onError, store, name, args }) => {
  console.log(name, '执行了', args)
  after((value) => {
    console.log('after', value)
  })
  onError((error) => {
    console.log('onError', error)
  })
})
</script>

<template>
  <div>count: {{ store.count }}</div>
  <div>doubleCount: {{ store.doubleCount }}</div>
  <div v-for="item in store.list" :key="item">{{ item }}</div>
  <button @click="handleClick">增加</button>
  <button @click="patch">$patch</button>
  <button @click="reset">$reset</button>
  <button @click="store.asyncIncrement('模拟传参')">监听异步actions</button>
  <button @click="store.asyncError()">监听异步actions失败</button>
  <button @click="store.$dispose()">$dispose</button>
  <button @click="state">$state</button>
</template>

<!-- options api 用法 mapState、mapActions、mapWritableState 方法测试 -->

<!-- <script>
import { useCountStore } from './store/useCountStore';
import { mapState, mapActions, mapWritableState } from '@/pinia'

export default {
  computed: {
    //可以直接写成 ...mapState(useCountStore, ['count', 'doubleCount', 'list']), 只是为了演示不同用法
    // ...mapState(useCountStore, ['count']),
    ...mapWritableState(useCountStore, ['count']),
    //mapState也可以获取getters中的属性
    ...mapState(useCountStore, ['doubleCount']),
    //对象的写法
    ...mapState(useCountStore, { l: 'list' })
  },
  methods: {
    ...mapActions(useCountStore, ['increment'])
  }
}
</script>

<template>
  <div>count: {{ count }}</div>
  <div>doubleCount: {{ doubleCount }}</div>
  <div v-for="item in l" :key="item">{{ item }}</div>
  <button @click="increment()">增加</button>
  <button @click="count++">mapWritableState增加</button>
</template> -->