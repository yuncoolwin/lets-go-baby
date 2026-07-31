export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '成长档案' })
  : { navigationBarTitleText: '成长档案' }
