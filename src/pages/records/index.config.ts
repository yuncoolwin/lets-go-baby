export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '记录' })
  : { navigationBarTitleText: '记录' }
