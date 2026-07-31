export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '发布通知'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '发布通知'
    }
