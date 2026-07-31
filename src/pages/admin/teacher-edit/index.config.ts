export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '编辑教师' })
  : { navigationBarTitleText: '编辑教师' }
