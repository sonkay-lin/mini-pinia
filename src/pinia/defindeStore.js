import { computed, effectScope, getCurrentInstance, inject, reactive, toRefs, isRef, watch } from "vue"
import { addSubscription, tiggerSubscription } from "./pubsub"
import { activePinia, PiniaSymbol, setActivePinia } from "./rootStore"

function isObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

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

function createSetupStore(id, setup, pinia) {
  let scope
  //将store放到pinia._e中，使其可以停止所有store
  const setupStore = pinia._e.run(() => {
    //每个store单独生成effectScope可以停止store中所有effect数据
    scope = effectScope()
    return scope.run(() => setup())
  })

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

  function $patch(partialStateOrMutator) {
    if (typeof partialStateOrMutator === 'function') {
      //如果传的是函数直接调用并传入当前store
      partialStateOrMutator(store)
    } else {
      //如果传的是对象递归合并属性
      mergeReactiveObject(store, partialStateOrMutator)
    }
  }

  function $subscribe(callback, options) {
    scope.run(() => watch(pinia.state.value[id], (state) => {
      callback({ type: 'dirct' }, state)
    }, options))
  }

  function $dispose() {
    scope.stop()
    actionSubscriptions.length = 0
    pinia._s.delete(id)
  }

  //保存actions中监听的回调
  const actionSubscriptions = []
  const partialStore = {
    $patch,
    $subscribe,
    //bind 参数为null时不改变this指向
    $onAction: addSubscription.bind(null, actionSubscriptions),
    $dispose
  }
  const store = reactive(partialStore)

  Object.defineProperty(store, '$state', {
    get: () => pinia.state.value[id],
    set: (newState) => $patch(($state) => Object.assign($state, newState))
  })

  //store为响应式数据，合并后的属性也都是响应式的
  Object.assign(store, setupStore)

  //每个store都会使用plugin
  pinia._p.forEach(plugin => Object.assign(store, plugin({ store, pinia, app: pinia._a })))
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

  store.$reset = function() {
    //保存初始化状态的数据
    const initState = state ? state() : {}
    //通过$patch更新批量数据
    this.$patch(($state) => {
      Object.assign($state, initState)
    })
  }

  return store
}