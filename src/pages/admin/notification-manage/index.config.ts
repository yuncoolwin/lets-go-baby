export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '通知管理' })
  : { navigationBarTitleText: '通知管理' }
