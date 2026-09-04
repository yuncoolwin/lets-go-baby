export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '隐私政策',
      navigationBarBackgroundColor: '#E8651A',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '隐私政策',
      navigationBarBackgroundColor: '#E8651A',
      navigationBarTextStyle: 'white',
    }
