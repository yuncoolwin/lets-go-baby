import { useShareAppMessage } from '@tarojs/taro'

/**
 * 全局分享默认配置
 * 默认转发：标题为应用名，落地路径为首页（游客态首页，未登录也能进入渗流演示内容）。
 * imageUrl 使用本地默认分享图（小程序包内路径），若不可用微信会自动使用当前页截图。
 */
export const SHARE_DEFAULT = {
  title: '力高稚家托育',
  path: '/pages/index/index',
  imageUrl: '/assets/logo.png',
}

export interface ShareOptions {
  title?: string
  path?: string
  imageUrl?: string
}

/**
 * 为页面启用"转发给朋友"能力。
 * 传入空参数时使用默认分享内容；可传入 title/path/imageUrl 覆盖。
 * 未登录用户通过转发链接进入时，会直接落到游客首页（现有游客兜底逻辑），不做登录拦截。
 */
export function useShareMessage(opts: ShareOptions = {}) {
  const title = opts.title || SHARE_DEFAULT.title
  const path = opts.path || SHARE_DEFAULT.path
  const imageUrl = opts.imageUrl || SHARE_DEFAULT.imageUrl

  useShareAppMessage(() => {
    return {
      title,
      path,
      imageUrl,
    }
  })
}