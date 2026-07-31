export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '发布通知' })
  : { navigationBarTitleText: '发布通知' }
