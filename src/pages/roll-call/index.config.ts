export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '今日考勤'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '今日考勤'
    }
