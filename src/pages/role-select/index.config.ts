export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '选择角色',
    navigationBarBackgroundColor: '#E8651A',
    navigationBarTextStyle: 'white',
  })
  : {
    navigationBarTitleText: '选择角色',
    navigationBarBackgroundColor: '#E8651A',
    navigationBarTextStyle: 'white',
  }
