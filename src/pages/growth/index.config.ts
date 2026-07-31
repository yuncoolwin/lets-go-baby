export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '成长档案'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '成长档案'
    }
