export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '素材箱' })
  : { navigationBarTitleText: '素材箱' }