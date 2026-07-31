export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '幼儿信息设置' })
  : { navigationBarTitleText: '幼儿信息设置' }
