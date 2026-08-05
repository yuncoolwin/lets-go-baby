export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '法定节假日' })
  : { navigationBarTitleText: '法定节假日' }