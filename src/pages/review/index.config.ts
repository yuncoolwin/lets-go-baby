export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '审核管理' })
  : { navigationBarTitleText: '审核管理' }
