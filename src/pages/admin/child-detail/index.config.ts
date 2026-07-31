export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '幼儿详情'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '幼儿详情'
    }
