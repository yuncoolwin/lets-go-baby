export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '班级管理' })
  : { navigationBarTitleText: '班级管理' }
