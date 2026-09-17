import { Injectable } from '@nestjs/common';

interface TokenCache {
  token: string | null;
  expiresAt: number;
}

/** access_token 有效期 2 小时；提前 5 分钟过期换新 */
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const TOKEN_MARGIN_MS = 5 * 60 * 1000;

@Injectable()
export class WechatService {
  private tokenCache: TokenCache = { token: null, expiresAt: 0 };

  private get appid() {
    return process.env.WX_APPID || '';
  }

  private get secret() {
    return process.env.WX_APPSECRET || '';
  }

  private get configured() {
    return !!(this.appid && this.secret);
  }

  // 登录 code 换 openid
  async getOpenidByCode(code: string): Promise<string> {
    if (!this.appid || !this.secret) {
      // 仅在显式开启 Mock 模式时返回 mock 值，否则视为未配置并拒绝登录
      if (process.env.MOCK_WECHAT === 'true') {
        return `mock_openid_${code}`;
      }
      throw new Error('微信登录未配置，请联系管理员');
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${this.appid}&secret=${this.secret}&js_code=${code}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data = await res.json();
    return data.openid;
  }

  // 手机号授权 code 换手机号
  async getPhoneByCode(phoneCode: string): Promise<string> {
    if (!this.appid || !this.secret) {
      // 仅在显式开启 Mock 模式时返回 mock 值，否则视为未配置并拒绝登录
      if (process.env.MOCK_WECHAT === 'true') {
        return `mock_${phoneCode}`;
      }
      throw new Error('微信登录未配置，请联系管理员');
    }
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appid}&secret=${this.secret}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const phoneUrl = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
    const phoneRes = await fetch(phoneUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: phoneCode }),
    });
    const phoneData = await phoneRes.json();
    return phoneData.phone_info.purePhoneNumber;
  }

  /**
   * 获取微信 access_token（带缓存，有效期约 2 小时，提前 5 分钟刷新）
   * 内容安全相关接口统一通过此方法取 token，避免重复请求。
   * 未配置 appid/secret 返回 null。
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.configured) return null;
    if (this.tokenCache.token && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appid}&secret=${this.secret}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!data?.access_token || data.errcode) {
        console.warn('[Wechat] getAccessToken 失败:', data);
        return null;
      }
      const expiresInMs = (data.expires_in || 7200) * 1000;
      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + expiresInMs - TOKEN_MARGIN_MS,
      };
      return data.access_token;
    } catch (e) {
      console.warn('[Wechat] getAccessToken 异常:', (e as Error)?.message);
      return null;
    }
  }

  /**
   * 文本内容安全：msg_sec_check（v2）
   * 命中违规（risky / errcode 87014）返回 false，其余（含未配置、连接异常）保守放行 true。
   */
  async checkText(content: string): Promise<boolean> {
    const text = (content || '').trim();
    if (!text) return true;
    if (!this.configured) return true; // 开发/未配置环境跳过
    const token = await this.getAccessToken();
    if (!token) return true; // 拿不到 access_token 时保守放行（连接层失败，不阻塞业务）
    try {
      const res = await fetch(`https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 2,
          openid: process.env.WX_OPERATOR_OPENID || '',
          scene: 1,
          content: text,
        }),
      });
      const data = await res.json();
      const suggest = data?.result?.suggest;
      if (data?.errcode === 87014 || suggest === 'risky') return false;
      // review（需人工复审）/pass（安全）/其他未明确风险 → 放行
      return true;
    } catch (e) {
      console.warn('[Wechat] checkText 异常:', (e as Error)?.message);
      return true;
    }
  }

  /**
   * 图片内容安全：img_sec_check（同步，media 表单）
   * 命中违规（errcode 87014）返回 false，其余保守放行 true。
   */
  async checkImage(buffer: Buffer): Promise<boolean> {
    if (!buffer || buffer.length === 0) return true;
    if (!this.configured) return true;
    const token = await this.getAccessToken();
    if (!token) return true;
    try {
      const form = new FormData();
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      form.append('media', new Blob([ab], { type: 'image/webp' }), `check_${Date.now()}.jpg`);
      const res = await fetch(`https://api.weixin.qq.com/wxa/img_sec_check?access_token=${token}`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (data?.errcode === 87014) return false;
      return true;
    } catch (e) {
      console.warn('[Wechat] checkImage 异常:', (e as Error)?.message);
      return true;
    }
  }
}