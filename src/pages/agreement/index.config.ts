export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '用户协议',
      navigationBarBackgroundColor: '#E8651A',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '用户协议',
      navigationBarBackgroundColor: '#E8651A',
      navigationBarTextStyle: 'white',
    }
