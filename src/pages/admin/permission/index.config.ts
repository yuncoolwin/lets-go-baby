export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '权限管理' })
  : { navigationBarTitleText: '权限管理' }