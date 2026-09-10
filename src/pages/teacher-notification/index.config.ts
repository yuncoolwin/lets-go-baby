export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '发布通知', enablePullDownRefresh: true })
  : { navigationBarTitleText: '发布通知', enablePullDownRefresh: true }
