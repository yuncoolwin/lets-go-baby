export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '登录',
    navigationBarBackgroundColor: '#E8651A',
    navigationBarTextStyle: 'white',
  })
  : {
    navigationBarTitleText: '登录',
    navigationBarBackgroundColor: '#E8651A',
    navigationBarTextStyle: 'white',
  }
