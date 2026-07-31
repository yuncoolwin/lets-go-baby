export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '幼儿信息设置'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '幼儿信息设置'
    }
