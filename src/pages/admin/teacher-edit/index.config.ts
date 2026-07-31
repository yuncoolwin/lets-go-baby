export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '编辑教师'
    })
  : {
      navigationStyle: 'custom',
      navigationBarTitleText: '编辑教师'
    }
