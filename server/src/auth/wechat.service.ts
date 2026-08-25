import { Injectable } from '@nestjs/common';

@Injectable()
export class WechatService {
  private get appid() {
    return process.env.WX_APPID || '';
  }

  private get secret() {
    return process.env.WX_APPSECRET || '';
  }

  // 登录 code 换 openid
  async getOpenidByCode(code: string): Promise<string> {
    if (!this.appid || !this.secret) {
      return `mock_openid_${code}`;
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${this.appid}&secret=${this.secret}&js_code=${code}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data = await res.json();
    return data.openid;
  }

  // 手机号授权 code 换手机号
  async getPhoneByCode(phoneCode: string): Promise<string> {
    if (!this.appid || !this.secret) {
      return `mock_${phoneCode}`;
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
}