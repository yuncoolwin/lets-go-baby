export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '成长记录' })
  : { navigationBarTitleText: '成长记录' }