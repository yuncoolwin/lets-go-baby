export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '消息', enablePullDownRefresh: true })
  : { navigationBarTitleText: '消息', enablePullDownRefresh: true }
