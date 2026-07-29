export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '班级信息' })
  : { navigationBarTitleText: '班级信息' }
