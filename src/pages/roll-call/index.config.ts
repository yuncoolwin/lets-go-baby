export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '考勤'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '考勤'
    }
