export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '接送记录' })
  : { navigationBarTitleText: '接送记录' }
