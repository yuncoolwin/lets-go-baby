export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '今日考勤' })
  : { navigationBarTitleText: '今日考勤' }
