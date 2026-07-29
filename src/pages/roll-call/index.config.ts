export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '点名' })
  : { navigationBarTitleText: '点名' }
