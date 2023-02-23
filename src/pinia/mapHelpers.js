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