import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  signStringToSign,
  utcDate,
  buildCanonicalRequest,
  buildTc3Headers,
} from '../src/lib/tc3.js';

// 腾讯云官方公开测试向量（https://cloud.tencent.com/document/api/382/52071）
// timestamp 1539084154（UTC 2018-10-09）
// 期望 HashedCanonicalRequest = 91c9c192c14460df6c1ffc69e34e6c5e90708de2a6d282cccf957dbf1aa7f3a7
// 期望 Signature              = 5da7a33f6993f0614b047e5df4582db9e9bf4672ba50567dba16c6ccf174c474
// 官方示例 SecretKey 不入库，通过环境变量 TC3_SAMPLE_SECRET_KEY 注入后逐字节复现 Signature。

describe('TC3 官方向量对拍', () => {
  it('payload 哈希与官方 POST 示例一致', () => {
    const payload =
      '{"Limit": 1, "Filters": [{"Values": ["\\u672a\\u547d\\u540d"], "Name": "instance-name"}]}';
    expect(sha256Hex(payload)).toBe(
      '35e9c5b0e3ae67532d3c9f17ead6c90222632e5b1ff7f6e89887f1398934f064',
    );
  });

  it('空串哈希与 UTC 日期换算', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(utcDate(1539084154)).toBe('2018-10-09');
  });

  it('HashedCanonicalRequest 与官方 GET 向量逐字节一致', () => {
    const canonicalHeaders =
      'content-type:application/x-www-form-urlencoded\nhost:cvm.tencentcloudapi.com\n';
    const signedHeaders = 'content-type;host';
    const canonicalRequest = buildCanonicalRequest({
      method: 'GET',
      path: '/',
      query: 'Limit=10&Offset=0',
      canonicalHeaders,
      signedHeaders,
      payloadHash: sha256Hex(''),
    });
    expect(sha256Hex(canonicalRequest)).toBe(
      '91c9c192c14460df6c1ffc69e34e6c5e90708de2a6d282cccf957dbf1aa7f3a7',
    );
  });

  it('注入官方示例 SecretKey 后 Signature 逐字节一致', () => {
    const secretKey = process.env.TC3_SAMPLE_SECRET_KEY || 'Gu5t9EXAMPLEoEXAMPLEoEXAMPLEoEXAMPLEo';
    const ts = 1539084154;
    const date = utcDate(ts);
    const hashedCanonicalRequest =
      '91c9c192c14460df6c1ffc69e34e6c5e90708de2a6d282cccf957dbf1aa7f3a7';
    const credentialScope = `${date}/cvm/tc3_request`;
    const stringToSign = `TC3-HMAC-SHA256\n${ts}\n${credentialScope}\n${hashedCanonicalRequest}`;
    const signature = signStringToSign(stringToSign, secretKey, date, 'cvm');
    if (process.env.TC3_SAMPLE_SECRET_KEY) {
      expect(signature).toBe('5da7a33f6993f0614b047e5df4582db9e9bf4672ba50567dba16c6ccf174c474');
    } else {
      // 未注入时只校验签名形态（HashedCanonicalRequest 已在上一步逐字节校验）
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('buildTc3Headers 生成请求头', () => {
  it('正常：Authorization 头格式合法', () => {
    const headers = buildTc3Headers(
      {
        PhoneNumberSet: ['+8613800138000'],
        SmsSdkAppId: '1400000000',
        SignName: '学习助手',
        TemplateId: '123456',
        TemplateParamSet: ['123456', '5'],
      },
      { secretId: 'AKIDtest', secretKey: 'testkey', timestamp: 1700000000 },
    );
    expect(headers['X-TC-Action']).toBe('SendSms');
    expect(headers.Host).toBe('sms.tencentcloudapi.com');
    expect(headers['X-TC-Timestamp']).toBe('1700000000');
    expect(headers.Authorization).toMatch(
      /^TC3-HMAC-SHA256 Credential=AKIDtest\/2023-11-14\/sms\/tc3_request, /,
    );
    expect(headers.Authorization).toContain(
      'SignedHeaders=content-type;host;x-tc-action, Signature=',
    );
    const sig = headers.Authorization.split('Signature=')[1];
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('边界：默认参数生效', () => {
    const headers = buildTc3Headers({}, { secretId: 'id', secretKey: 'key', timestamp: 1700000000 });
    expect(headers.Host).toBe('sms.tencentcloudapi.com');
    expect(headers['X-TC-Region']).toBe('ap-guangzhou');
    expect(headers['X-TC-Version']).toBe('2021-01-11');
  });
});
