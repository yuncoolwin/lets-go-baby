export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '绑定申请' })
  : { navigationBarTitleText: '绑定申请' }
