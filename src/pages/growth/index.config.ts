export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '成长档案', enablePullDownRefresh: true })
  : { navigationBarTitleText: '成长档案', enablePullDownRefresh: true }
