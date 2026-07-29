export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '幼儿管理' })
  : { navigationBarTitleText: '幼儿管理' }
