export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '通知管理', enablePullDownRefresh: true })
  : { navigationBarTitleText: '通知管理', enablePullDownRefresh: true }
