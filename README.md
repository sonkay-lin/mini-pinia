# 实现mini pinia

## pinia 和 vuex
#### vuex的缺点：
1. ts兼容性不好
2. 命名空间缺陷
#### pinia的优点：
1. ts兼容性好
2. 不需要命名空间(可以创建多个store)
3. mutation删掉了

## pinia的基本使用
1. id以defindeStore的参数传入或者以对象中的属性id传入
```js
//useCountStore.js
import { defineStore } from "pinia";

export const useCountStore = defineStore('count', {
  state: () => ({ count: 0 }),
  getters: {
    doubleCount: (store) => store.count * 2
  }
})
```
```vue
<script setup>
import { useCountStore } from '@/store/useCountStore'
const store = useCountStore()
const handleClick = () => {
  store.count++
}
</script>

<template>
  <div>count: {{ store.count }}</div>
  <div>doubleCount: {{ store.doubleCount }}</div>
  <button @click="handleClick">增加</button>
</template>
```
action中可以直接使用同步和异步
```js {14-18}
//useCountStore.js
import { defineStore } from "pinia";
//也可以使用一个参数的形式但要传入id
// export const useCountStore = defineStore({
//   id: 'count',
//   state: () => ({ count: 0 }),
//   getters: {}
// })
export const useCountStore = defineStore('count', {
  state: () => ({ count: 0 }),
  getters: {
    doubleCount: (store) => store.count * 2
  },
  actions: { //同步异步都在action
    increment() {
      this.count++
    }
  }
})
```
```vue {12}
<script setup>
import { useCountStore } from '@/store/useCountStore'
const store = useCountStore()
const handleClick = () => {
  store.count++
}
</script>

<template>
  <div>count: {{ store.count }}</div>
  <div>doubleCount: {{ store.doubleCount }}</div>
  <button @click="store.increment">增加</button>
</template>
```
2. 使用setup形式的语法
```js
//useCountStore.js
import { defineStore } from "pinia";
import { computed, reactive, toRefs } from "vue";

export const useCountStore = defineStore('count', () => {
  const state = reactive({ count: 0 })
  const doubleCount = computed(() => state.count * 2)
  const increment = () => state.count++

  return {
    ...toRefs(state),
    doubleCount,
    increment
  }
})
```

<!-- <Image :src="src" :preview-src-list="previewSrcList"></Image> -->

## 实现 createPinia 
createPinia方法中做了以下几件事
1. 创建一个state用来存放所有的store属性，state放在全局独立作用域effectScope中，在使用scope.stop()时，可以停止所有的store下的effect(getters)
2. 创建一个pinia设置成非响应式的，防止别人使用时用reactive(pinia)，直接对pinia添加属性
3. 创建install方法，在使用app.use时，会自动调用该方法，并把创建好的app传进来
  > 1. install方法中将当前pinia挂载到vue全局上，可以通过this.$pinia获取到
  > 2. 在app上使用了provide，使pinia在组件中使用时通过inject注入到页面中
  > 3. 将app挂载到pinia上

```js
//rootStore.js
export const PiniaSymbol = Symbol()
```

```js
//createPinia.js
import { effectScope, markRaw, ref } from "vue";
import { PiniaSymbol } from './rootStore'

export function createPinia() {
  /**
   * effectScope: 相当于effect只是在该作用域中使用stop可以停止所有的effect
   * scope: 创建一个effect的独立作用域，可以使用scope.stop()将作用域中所有的副作用停止掉
  */
  const scope = effectScope(true)
  //state存放所有的store属性
  const state = scope.run(() => ref({}))
  //使用markRaw是因为，防止别人使用时用reactive(pinia)将pinia设置成响应式
  const pinia = markRaw({
    install(app) {
      //将pinia挂载app上，所有的组件可以通过inject获取
      app.provide(PiniaSymbol, pinia)
      //在vue上挂载pinia可以在this中直接获取pinia
      app.config.globalProperties.$pinia = pinia
      //在pinia上挂载vue创建的app
      pinia._a = app
    },
    //createApp创建的vue实例
    _a: null,
    //store所有的属性
    state,
    //副作用函数，可以停止所有effect
    _e: scope,
    //以id为key,state为value的映射表
    _s: new Map()
  })

  return pinia
}
```

## 实现 defindeStore 
1. 处理用户的不同写法，并返回useStore方法
2. 在用户引入页面中后，获取当前实例，将pinia注入到当前页面中，如果store没有创建，判断用户是传setup函数还是options对象，再进行store创建
> #### store 的创建过程
> 1. 创建一个响应式对象store
> 2. 在全局作用域中pinia._e为store单独生成effectScope，可以停止对应store中所有effect；运行store将state、getters、actions转化为响应式
> 3. warpAction方法利用aop思想对函数做处理(后续$onActions需要需要添加新操作)，防止解构后this指向改变
3. 将创建好的store返回

```js
//defindeStore.js
import { computed, effectScope, getCurrentInstance, inject, reactive, toRefs } from "vue"
import { PiniaSymbol } from "./rootStore"

export function defineStore(idOptions, setup) {
  let id 
  let options
  //处理用户的不同写法
  if (typeof idOptions === 'string') {
    id = idOptions
    options = setup
  } else {
    id = idOptions.id
    options = idOptions
  }
  //判断用户传的是对象还是setup函数
  const isSetupStore = typeof setup === 'function'

  return function useStore () {
    //获取当前组件实例
    const currentInstance = getCurrentInstance()
    //将store注入至当前组件
    const pinia = currentInstance && inject(PiniaSymbol)
    //如果store已经创建过了直接返回，否则就创建
    if (!pinia._s.has(id)) {
      //对用户的传参进行判断走对应的逻辑
      if (isSetupStore) {
        createSetupStore(id, setup, pinia)
      } else {
        createOptionsStore(id, options, pinia)
      }
    }
    return pinia._s.get(id)
  }
}

function createSetupStore(id, setup, pinia) {
  const store = reactive({})
  let scope
  //将store放到pinia._e中，使其可以停止所有store
  const setupStore = pinia._e.run(() => {
    //每个store单独生成effectScope可以停止store中所有effect数据
    scope = effectScope()
    return scope.run(() => setup())
  })

  function warpAction(name, actions) {
    return function() {
      const result = actions.call(store, ...arguments)
      return result
    }
  }

  /**
   * 解构过程中可能使函数this改变，所以对函数的this做处理，保证this指向store
   * 例： store = useCountStore()
   * const { increment } = store
   * increment()
  */
  for(let key in setupStore) {
    const prop = setupStore[key]
    if (typeof prop === 'function') {
      //利用aop思想对函数做处理
      setupStore[key] = warpAction(key, prop)
    }
  }
  //store为响应式数据，合并后的属性也都是响应式的
  Object.assign(store, setupStore)
  pinia._s.set(id, store)
  return store
}

function createOptionsStore(id, options, pinia) {
  const { state, getters, actions } = options
  function setup() {
    pinia.state.value[id] = state ? state() : {}
    //将所有的属性转成响应式、toRefs可以保证对象展开的每个属性都是响应式的
    const localState = toRefs(pinia.state.value[id])
    //将state、getters、actions数据进行响应式处理，并合并在一个reactive对象中
    return Object.assign(
      localState, 
      actions, 
      //对getters数据进行处理使其变为computed数据
      Object.keys(getters || {}).reduce((computedGetter, name) => {
        //使用reduce默认先生成一个对象，再依次往对象中添加getter属性，再转化为computed数据
        computedGetter[name] = computed(() => getters[name].call(store, store))
        return computedGetter
      }, {})
    )
  }
  const store = createSetupStore(id, setup, pinia)
  return store
}
```

## 实现 $patch
 $patch是pinia中实现批量修改的方法，接受一个对象或函数
```js
//递归合并对象
function mergeReactiveObject(target, partialState) {
  for(const key in partialState) {
    //不考虑原型上的属性
    if (!partialState.hasOwnProperty(key)) continue
    const oldValue = target[key]
    const newValue = partialState[key]
    //如果都是对象或者新值是ref继续递归
    if (isObject(oldValue) && isObject(newValue) && isRef(newValue)) {
      target[key] = mergeReactiveObject(oldValue, newValue)
    } else {
      target[key] = newValue
    }
  }
  return target
}

function $patch(partialStateOrMutator) {
  if (typeof partialStateOrMutator === 'function') {
    //如果传的是函数直接调用并传入当前store
    partialStateOrMutator(store)
  } else {
    //如果传的是对象递归合并属性
    mergeReactiveObject(store, partialStateOrMutator)
  }
}
```

## 实现 $reset
 $reset是pinia中重置数据的方法，该方法无法重置defindeStore传入setup函数的写法

```js
store.$reset = function() {
  //保存初始化状态的数据
  const initState = state ? state() : {}
  //通过$patch更新批量数据
  this.$patch(($state) => {
    Object.assign($state, initState)
  })
}
```

## 实现 $subscribe
 $subscribe本质上就是一个运行在effectScope中的watch，可以监听到数据的变化

```js
function $subscribe(callback, options) {
  scope.run(() => watch(pinia.state.value[id], (state) => {
    callback({ type: 'dirct' }, state)
  }, options))
}
```

## 实现 $onActions
 $subscribe可以监听到数据的变化，但无法监听到actions中方法的调用，$onActions就是用来监听actions中方法的调用<br>
在不改变用户的actions情况下(函数AOP)，利用发布订阅监听actions，同步触发一次tiggerSubscription，异步状态完成后触发一次tiggerSubscription

```js
// pubsub.js
export function addSubscription(subscriptions, cb) {
  subscriptions.push(cb)
  return function removeSubscription() {
    const index = subscriptions.indexOf(cb)
    if (index > -1) {
      subscriptions.splice(index)
    }
  }
}

export function tiggerSubscription(subscriptions, ...args) {
  subscriptions.forEach(cb => cb(...args))
}
```
```js
//defindeStore.js
  function warpAction(name, actions) {
    return function() {
      // 获取当前action的参数
      const args = Array.from(arguments)
      const afterCallbackList = []
      const onErrorCallbackList = []
      function after(callback) {
        afterCallbackList.push(callback)
      }
      function onError(callback) {
        onErrorCallbackList.push(callback)
      }
      tiggerSubscription(actionSubscriptions, { after, onError, store, name, args })

      let ret

      try {
        ret = actions.apply(store, arguments)
      } catch (error) {
        tiggerSubscription(onErrorCallbackList, error)
        throw error        
      }
      //若ret的返回值为promise则根据promise进行事件发布订阅
      if (ret instanceof Promise) {
        return ret.then(value => {
          tiggerSubscription(afterCallbackList, value)
        }).catch(error => {
          tiggerSubscription(onErrorCallbackList, error)
          return Promise.reject(error)
        })
      }

      return ret
    }
  }
```

## 实现 $dispose
 $dispose 用来停止pinia中的scope(也就是说依赖的值改变了，不会在调用对应的方法，state中的属性还是能改变，watch和computed是基于effect实现的)

```js
function $dispose() {
  scope.stop()
  actionSubscriptions.length = 0
  pinia._s.delete(id)
}
```

## 实现 $state
 $state访问时会返回state中的数据，修改时会使用$patch找到对应的数据进行更新
```js
Object.defineProperty(store, '$state', {
  get: () => pinia.state.value[id],
  set: (newState) => $patch(($state) => Object.assign($state, newState))
})
```

## 实现 use
use方法是pinia中使用插件的一个方法
```js {13-17}
//createPinia
  const _p = []
  //使用markRaw是因为，防止别人使用时用reactive(pinia)将pinia设置成响应式
  const pinia = markRaw({
    install(app) {
      //将pinia挂载app上，所有的组件可以通过inject获取
      app.provide(PiniaSymbol, pinia)
      //在vue上挂载pinia可以在this中直接获取pinia
      app.config.globalProperties.$pinia = pinia
      //在pinia上挂载vue创建的app
      pinia._a = app
    },
    use(plugin) {
      _p.push(plugin)
      //返回this，可以链式调用
      return this
    },
    //createApp创建的vue实例
    _a: null,
    //store所有的属性
    state,
    //副作用函数，可以停止所有effect
    _e: scope,
    //以id为key,state为value的映射表
    _s: new Map(),
    //存放所有插件
    _p
  })
```
```js
//function createSetupStore

//每个store都会使用plugin
  pinia._p.forEach(plugin => Object.assign(store, plugin({ store, pinia, app: pinia._a })))
```

## 实现一个持久化插件
```js
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
```


## 对options api 用法做处理
在实现mapState之前先对option API的问题做处理

```js
//rootStore.js
export const PiniaSymbol = Symbol()
export let activePinia
export const setActivePinia = (pinia) => activePinia = pinia
```
install的时候设置下pinia
```js
//createPinia.js
const pinia = markRaw({
  install(app) {
    // 设置当前使用的 pinia 在使用option api时才能获取到
    setActivePinia(pinia)
    // ...省略部分代码
  }
  // ...省略部分代码
}
```
defindeStore中对pinia做处理
```js {9-11}
//defindeStore.js
export function defineStore(idOptions, setup) {
  //...省略部分代码
  return function useStore () {
    //获取当前组件实例
    const currentInstance = getCurrentInstance()
    //将store注入至当前组件
    let pinia = currentInstance && inject(PiniaSymbol)
    if (pinia) setActivePinia(pinia)
    //pinia如果没值就拿install时的pinia
    pinia = activePinia
    //如果store已经创建过了直接返回，否则就创建
    if (!pinia._s.has(id)) {
      //对用户的传参进行判断走对应的逻辑
      if (isSetupStore) {
        createSetupStore(id, setup, pinia)
      } else {
        createOptionsStore(id, options, pinia)
      }
    }
    return pinia._s.get(id)
  }
}
```

## 实现 mapState
mapState是在option API中使用的辅助函数，它的第一个参数为useStore，第二个为数组或者对象；mapState也可以获取getters中的属性<br>
基本用法

```vue
<script>
import { useCountStore } from './store/useCountStore';
import { mapState, mapActions } from '@/pinia'

export default {
  computed: {
    //可以直接写成 ...mapState(useCountStore, ['count', 'doubleCount', 'list']), 只是为了演示不同用法
    ...mapState(useCountStore, ['count']),
    //mapState也可以获取getters中的属性
    ...mapState(useCountStore, ['doubleCount']),
    //对象的写法
    ...mapState(useCountStore, { l: 'list' })
  }
}
</script>

<template>
  <div>count: {{ count }}</div>
  <div>doubleCount: {{ doubleCount }}</div>
  <div v-for="item in l" :key="item">{{ item }}</div>
</template>
```
实现
```js
export function mapState(useStore, keysOrMapper) {
  return Array.isArray(keysOrMapper) ? 
    //使用reduce可以默认生成一个对象然后在对象中添加属性
    keysOrMapper.reduce((reduced, key) => {
      reduced[key] = function() {
        return useStore()[key]
      }
      return reduced
    }, {}) : 
    //用户传对象时key值为用户使用的属性value值为store的属性
    Object.keys(keysOrMapper).reduce((reduced, key) => {
      //reduced[key]为用户要在页面中使用的属性
      reduced[key] = function() {
        const store = useStore()
        //keysOrMapper[key]为用户传入的对象的value，也就是store的属性
        const storeKey = keysOrMapper[key]
        return store[storeKey]
      }
      return reduced
    }, {})
} 
```

## 实现 mapActions
mapActions和mapState的实现类似，只是多了些传参
```js
export function mapActions(useStore, keysOrMapper) {
  return Array.isArray(keysOrMapper) ? 
    keysOrMapper.reduce((reduced, key) => {
      reduced[key] = function(...args) {
        return useStore()[key](...args)
      }
      return reduced
    }, {}) : 
    //用户传对象时key值为用户使用的属性value值为store的属性
    Object.keys(keysOrMapper).reduce((reduced, key) => {
      //reduced[key]为用户要在页面中使用的属性
      reduced[key] = function() {
        const store = useStore()
        //keysOrMapper[key]为用户传入的对象的value，也就是store的属性
        const storeKey = keysOrMapper[key]
        return store[storeKey](...args)
      }
      return reduced
    }, {})
}
```

## 实现 mapWritableState
mapWritableState方法可以直接在页面中对state数据进行修改，就不需要走actions了
```js
export function mapWritableState(useStore, keysOrMapper) {
  return Array.isArray(keysOrMapper) ? 
    //使用reduce可以默认生成一个对象然后在对象中添加属性
    keysOrMapper.reduce((reduced, key) => {
      reduced[key] = {
        get() {
          return useStore()[key]
        },
        set(value) {
          useStore()[key] = value
        }
      }
      return reduced
    }, {}) : 
    //用户传对象时key值为用户使用的属性value值为store的属性
    Object.keys(keysOrMapper).reduce((reduced, key) => {
      //reduced[key]为用户要在页面中使用的属性
      reduced[key] = {
        get() {
          const store = useStore()
          //keysOrMapper[key]为用户传入的对象的value，也就是store的属性
          const storeKey = keysOrMapper[key]
          return store[storeKey]
        },
        set(value) {
          const store = useStore()
          const storeKey = keysOrMapper[key]
          store[storeKey] = value
        }
      }
      return reduced
    }, {})
}
```
