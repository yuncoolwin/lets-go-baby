export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '编辑幼儿'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '编辑幼儿'
    }
