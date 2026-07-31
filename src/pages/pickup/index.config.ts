export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '接送记录'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '接送记录'
    }
