export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '假期管理' })
  : { navigationBarTitleText: '假期管理' }