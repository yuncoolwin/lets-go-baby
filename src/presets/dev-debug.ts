import Taro from '@tarojs/taro';

/**
 * 小程序调试工具
 * 在开发版/体验版自动开启调试模式
 * 支持微信小程序
 */
export function devDebug() {
  const env = Taro.getEnv();
  if (env === Taro.ENV_TYPE.WEAPP) {
    try {
      const accountInfo = Taro.getAccountInfoSync();
      const envVersion = accountInfo.miniProgram.envVersion;
      console.log('[Debug] envVersion:', envVersion);

      if (envVersion !== 'release') {
        Taro.setEnableDebug({ enableDebug: true });
      } else {
        // 正式版裁剪 console.log 日志，避免污染线上控制台；保留 console.error / console.warn 便于线上查错
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
          console.log = () => {};
        }
      }
    } catch (error) {
      console.error('[Debug] 开启调试模式失败:', error);
    }
  }
}
