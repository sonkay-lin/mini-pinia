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