import { effectScope, markRaw, ref } from "vue";
import { PiniaSymbol, setActivePinia } from './rootStore'

export function createPinia() {
  console.log('createPinia')
  /**
   * effectScope: 相当于effect只是在该作用域中使用stop可以停止所有的effect
   * scope: 创建一个effect的独立作用域，可以使用scope.stop()将作用域中所有的副作用停止掉
  */
  const scope = effectScope(true)
  //state存放所有的store属性
  const state = scope.run(() => ref({}))
  //存放所有插件
  const _p = []
  //使用markRaw是因为，防止别人使用时用reactive(pinia)将pinia设置成响应式
  const pinia = markRaw({
    install(app) {
      // 设置当前使用的 pinia 在使用option api时才能获取到
      setActivePinia(pinia)
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

  return pinia
}