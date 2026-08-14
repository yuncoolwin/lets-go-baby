export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '日常记录' })
  : { navigationBarTitleText: '日常记录' }
