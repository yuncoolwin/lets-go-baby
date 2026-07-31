export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '考勤' })
  : { navigationBarTitleText: '考勤' }
