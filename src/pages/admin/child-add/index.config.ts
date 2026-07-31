export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '新增幼儿'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '新增幼儿'
    }
