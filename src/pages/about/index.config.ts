export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '关于力高稚家',
      navigationBarBackgroundColor: '#E8651A',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '关于力高稚家',
      navigationBarBackgroundColor: '#E8651A',
      navigationBarTextStyle: 'white',
    }