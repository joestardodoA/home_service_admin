/**
 * server/utils/fileParser.js — 文件内容解析工具（AI 智能动作系统）
 *
 * 功能:
 *   将上传的文件转换为 AI 可读的文本格式
 *   支持 Excel（.xlsx/.xls）、CSV、纯文本（.txt/.md）
 *
 * 截断策略:
 *   - 最大行数: 50 行（防止 Token 超限）
 *   - 最大字符数: 8000 字符
 *   - 超出部分会被截断，并在末尾附加统计信息
 *
 * 导出函数:
 *   parseFile(filePath, mimetype)       — 自动识别类型并解析
 *   parseExcelToJson(filePath)          — Excel → JSON 数组（全量）
 *   parseExcelToText(filePath, maxRows) — Excel → 文本描述（截断）
 *   parseCsvToJson(filePath)            — CSV → JSON 数组（全量）
 *   parseTextFile(filePath, maxChars)   — 纯文本 → 截断文本
 *   getFileStats(filePath, mimetype)    — 获取文件统计信息
 */
var XLSX = require('xlsx');
var fs = require('fs');
var path = require('path');

// 截断参数
var MAX_ROWS_FOR_AI = 50;      // 发送给 AI 的最大行数
var MAX_CHARS_FOR_AI = 8000;   // 发送给 AI 的最大字符数
var MAX_FULL_ROWS = 50000;     // 全量解析的最大行数（防止内存爆炸）

/**
 * 解析 Excel 文件为 JSON 数组（全量读取）
 * @param {string} filePath - 文件绝对路径
 * @returns {{ headers: string[], rows: object[], totalRows: number, sheetName: string }}
 */
function parseExcelToJson(filePath) {
  var wb = XLSX.readFile(filePath, { type: 'file' });
  var sheetName = wb.SheetNames[0];
  var sheet = wb.Sheets[sheetName];
  var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  // 安全限制：超大文件截断
  var totalRows = json.length;
  if (json.length > MAX_FULL_ROWS) {
    json = json.slice(0, MAX_FULL_ROWS);
  }

  // 提取表头
  var headers = [];
  if (json.length > 0) {
    headers = Object.keys(json[0]);
  }

  return {
    headers: headers,
    rows: json,
    totalRows: totalRows,
    sheetName: sheetName
  };
}

/**
 * 解析 Excel 文件为 AI 可读的文本描述（截断版）
 * @param {string} filePath - 文件绝对路径
 * @param {number} [maxRows] - 最大行数，默认 MAX_ROWS_FOR_AI
 * @returns {{ text: string, totalRows: number, headers: string[], truncated: boolean }}
 */
function parseExcelToText(filePath, maxRows) {
  if (!maxRows) maxRows = MAX_ROWS_FOR_AI;

  var result = parseExcelToJson(filePath);
  var headers = result.headers;
  var rows = result.rows;
  var totalRows = result.totalRows;
  var truncated = totalRows > maxRows;

  // 只取前 maxRows 行
  var sampleRows = rows.slice(0, maxRows);

  // 构造文本描述
  var lines = [];
  lines.push('📊 Excel 文件解析结果');
  lines.push('工作表: ' + result.sheetName);
  lines.push('总行数: ' + totalRows + ' 行');
  lines.push('列名: ' + headers.join(', '));
  lines.push('');
  lines.push('--- 数据预览 (' + (truncated ? '前 ' + maxRows + ' 行' : '全部') + ') ---');

  for (var i = 0; i < sampleRows.length; i++) {
    var row = sampleRows[i];
    var parts = [];
    for (var j = 0; j < headers.length; j++) {
      var val = String(row[headers[j]] || '').trim();
      if (val) parts.push(headers[j] + ': ' + val);
    }
    lines.push('第 ' + (i + 1) + ' 行: ' + parts.join(' | '));
  }

  if (truncated) {
    lines.push('');
    lines.push('... 还有 ' + (totalRows - maxRows) + ' 行未展示');
  }

  var text = lines.join('\n');
  // 字符数截断
  if (text.length > MAX_CHARS_FOR_AI) {
    text = text.slice(0, MAX_CHARS_FOR_AI) + '\n\n[内容过长已截断，共 ' + totalRows + ' 行数据]';
  }

  return {
    text: text,
    totalRows: totalRows,
    headers: headers,
    truncated: truncated
  };
}

/**
 * 解析 CSV 文件为 JSON 数组
 * @param {string} filePath - 文件绝对路径
 * @returns {{ headers: string[], rows: object[], totalRows: number }}
 */
function parseCsvToJson(filePath) {
  // 复用 XLSX 库解析 CSV（兼容各种编码和分隔符）
  var wb = XLSX.readFile(filePath, { type: 'file' });
  var sheetName = wb.SheetNames[0];
  var sheet = wb.Sheets[sheetName];
  var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  var totalRows = json.length;
  if (json.length > MAX_FULL_ROWS) {
    json = json.slice(0, MAX_FULL_ROWS);
  }

  var headers = [];
  if (json.length > 0) {
    headers = Object.keys(json[0]);
  }

  return {
    headers: headers,
    rows: json,
    totalRows: totalRows
  };
}

/**
 * 解析纯文本文件（.txt / .md 等）
 * @param {string} filePath - 文件绝对路径
 * @param {number} [maxChars] - 最大字符数，默认 MAX_CHARS_FOR_AI
 * @returns {{ text: string, totalChars: number, truncated: boolean }}
 */
function parseTextFile(filePath, maxChars) {
  if (!maxChars) maxChars = MAX_CHARS_FOR_AI;

  var content = fs.readFileSync(filePath, 'utf-8');
  var totalChars = content.length;
  var truncated = totalChars > maxChars;

  if (truncated) {
    content = content.slice(0, maxChars) + '\n\n[文件内容过长已截断，原文共 ' + totalChars + ' 字符]';
  }

  return {
    text: content,
    totalChars: totalChars,
    truncated: truncated
  };
}

/**
 * 获取文件统计信息（不读取完整内容）
 * @param {string} filePath - 文件绝对路径
 * @param {string} mimetype - MIME 类型
 * @returns {{ type: string, size: number, extension: string }}
 */
function getFileStats(filePath, mimetype) {
  var stat = fs.statSync(filePath);
  var ext = path.extname(filePath).toLowerCase();

  var type = 'unknown';
  if (mimetype && mimetype.indexOf('spreadsheet') !== -1 || mimetype === 'application/vnd.ms-excel') {
    type = 'excel';
  } else if (mimetype === 'text/csv') {
    type = 'csv';
  } else if (mimetype === 'text/plain') {
    type = 'text';
  } else if (mimetype === 'application/pdf') {
    type = 'pdf';
  } else if (mimetype && mimetype.indexOf('word') !== -1) {
    type = 'word';
  } else if (mimetype && mimetype.indexOf('image') !== -1) {
    type = 'image';
  }

  return {
    type: type,
    size: stat.size,
    extension: ext
  };
}

/**
 * 自动识别文件类型并解析为 AI 可读文本
 * @param {string} filePath - 文件绝对路径
 * @param {string} mimetype - MIME 类型
 * @returns {{ text: string, fileType: string, stats: object }}
 */
function parseFile(filePath, mimetype) {
  var stats = getFileStats(filePath, mimetype);

  switch (stats.type) {
    case 'excel': {
      var excelResult = parseExcelToText(filePath);
      return {
        text: excelResult.text,
        fileType: 'excel',
        stats: {
          totalRows: excelResult.totalRows,
          headers: excelResult.headers,
          truncated: excelResult.truncated
        }
      };
    }
    case 'csv': {
      // CSV 复用 Excel 解析逻辑
      var csvResult = parseExcelToText(filePath);
      return {
        text: csvResult.text.replace('Excel 文件', 'CSV 文件'),
        fileType: 'csv',
        stats: {
          totalRows: csvResult.totalRows,
          headers: csvResult.headers,
          truncated: csvResult.truncated
        }
      };
    }
    case 'text': {
      var textResult = parseTextFile(filePath);
      return {
        text: textResult.text,
        fileType: 'text',
        stats: {
          totalChars: textResult.totalChars,
          truncated: textResult.truncated
        }
      };
    }
    case 'pdf': {
      // PDF 暂不解析内容，返回提示信息
      return {
        text: '[PDF 文件] 文件大小: ' + Math.round(stats.size / 1024) + 'KB。当前版本暂不支持 PDF 内容提取，请将内容转为 Excel 或 TXT 后重新上传。',
        fileType: 'pdf',
        stats: { size: stats.size }
      };
    }
    case 'word': {
      // Word 暂不解析内容，返回提示信息
      return {
        text: '[Word 文件] 文件大小: ' + Math.round(stats.size / 1024) + 'KB。当前版本暂不支持 Word 内容提取，请将内容转为 Excel 或 TXT 后重新上传。',
        fileType: 'word',
        stats: { size: stats.size }
      };
    }
    case 'image': {
      return {
        text: '[图片文件] 文件大小: ' + Math.round(stats.size / 1024) + 'KB。请描述你希望 AI 如何分析这张图片。',
        fileType: 'image',
        stats: { size: stats.size }
      };
    }
    default: {
      return {
        text: '[未知文件类型: ' + mimetype + '] 无法解析内容。',
        fileType: 'unknown',
        stats: { size: stats.size }
      };
    }
  }
}

module.exports = {
  parseFile: parseFile,
  parseExcelToJson: parseExcelToJson,
  parseExcelToText: parseExcelToText,
  parseCsvToJson: parseCsvToJson,
  parseTextFile: parseTextFile,
  getFileStats: getFileStats
};
