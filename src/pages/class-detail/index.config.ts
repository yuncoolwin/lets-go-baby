export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '班级详情' })
  : { navigationBarTitleText: '班级详情' }
