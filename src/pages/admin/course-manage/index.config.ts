export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '课程管理' })
  : { navigationBarTitleText: '课程管理' }