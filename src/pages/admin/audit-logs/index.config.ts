export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '操作日志' })
  : { navigationBarTitleText: '操作日志' }