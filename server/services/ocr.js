// server/services/ocr.js — OCR 身份证识别服务（海南椰嫂综合平台）
// 当前为 mock 实现，后续接入腾讯云/百度 OCR 只需修改此文件

var OCR_CONFIG = {
  provider: process.env.OCR_PROVIDER || 'mock',
  secretId: process.env.OCR_SECRET_ID || '',
  secretKey: process.env.OCR_SECRET_KEY || ''
};

/**
 * 识别身份证图片（正面）
 * @param {string} imageUrl - 身份证图片 URL
 * @returns {Promise<Object>} - { name, idNumber, gender, birthDate, address, confidence }
 */
async function recognizeIdCard(imageUrl) {
  // Mock 模式：返回模拟 OCR 结果
  if (OCR_CONFIG.provider === 'mock') {
    console.log('[OCR Mock] 识别身份证:', imageUrl ? imageUrl.slice(0, 50) : '无图片');
    return {
      name: '',
      idNumber: '',
      gender: '',
      birthDate: '',
      address: '',
      confidence: 0,
      _source: 'mock',
      _message: '当前为模拟模式，请配置 OCR_PROVIDER 启用真实 OCR 服务'
    };
  }

  // 腾讯云 OCR
  if (OCR_CONFIG.provider === 'tencent') {
    try {
      var axios = require('axios');
      // 腾讯云 OCR API 调用逻辑（需要签名，此处简化）
      // 实际接入需安装 tencentcloud-sdk-nodejs
      console.log('[OCR] 腾讯云 OCR 调用...');
      return { error: '请安装 tencentcloud-sdk-nodejs 并完善签名逻辑' };
    } catch (err) {
      return { error: 'OCR 调用失败: ' + err.message };
    }
  }

  // 百度 OCR
  if (OCR_CONFIG.provider === 'baidu') {
    try {
      var axios = require('axios');
      console.log('[OCR] 百度 OCR 调用...');
      return { error: '请配置百度 OCR Access Token' };
    } catch (err) {
      return { error: 'OCR 调用失败: ' + err.message };
    }
  }

  return { error: '未知的 OCR_PROVIDER: ' + OCR_CONFIG.provider };
}

/**
 * 比对 OCR 结果与用户填写信息
 * @param {Object} ocrResult - OCR 识别结果
 * @param {Object} userInput - 用户填写的 { realName, idCard }
 * @returns {Object} - { nameMatch, idMatch, overallMatch, confidence, details }
 */
function compareInfo(ocrResult, userInput) {
  // Mock 模式下无法比对
  if (ocrResult._source === 'mock' || !ocrResult.name || !ocrResult.idNumber) {
    return {
      nameMatch: null,
      idMatch: null,
      overallMatch: null,
      confidence: 0,
      autoApprove: false,
      details: '当前为模拟模式，无法自动比对'
    };
  }

  var nameMatch = ocrResult.name.trim() === (userInput.realName || '').trim();
  var idMatch = ocrResult.idNumber.replace(/\s/g, '') === (userInput.idCard || '').replace(/\s/g, '');
  var confidence = ocrResult.confidence || 0;

  // 高置信度 + 双匹配 → 可自动通过
  var autoApprove = nameMatch && idMatch && confidence >= 0.95;

  var details = [];
  details.push('姓名: ' + (nameMatch ? '✅ 一致' : '❌ 不一致') +
    ' (填写: ' + userInput.realName + ', OCR: ' + ocrResult.name + ')');
  details.push('身份证: ' + (idMatch ? '✅ 一致' : '❌ 不一致'));
  details.push('置信度: ' + Math.round(confidence * 100) + '%');

  return {
    nameMatch: nameMatch,
    idMatch: idMatch,
    overallMatch: nameMatch && idMatch,
    confidence: confidence,
    autoApprove: autoApprove,
    details: details.join('\n'),
    ocrResult: {
      name: ocrResult.name,
      gender: ocrResult.gender,
      birthDate: ocrResult.birthDate,
      address: ocrResult.address
    }
  };
}

module.exports = {
  recognizeIdCard: recognizeIdCard,
  compareInfo: compareInfo,
  OCR_CONFIG: OCR_CONFIG
};
