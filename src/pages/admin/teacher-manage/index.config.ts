export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '教师管理' })
  : { navigationBarTitleText: '教师管理' }
