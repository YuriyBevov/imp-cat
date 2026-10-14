const PRIVACY_TOKEN_INSTRUCTION = 'Обозначения ICATPII_<8 HEX>_<TYPE>_<4 DIGITS> заменяют скрытые локально данные. Сохраняйте каждое обозначение посимвольно, включая регистр, подчёркивания и число повторений. Не переводите, не исправляйте, не разбивайте и не пытайтесь восстановить скрытое значение.'

function assertPrivacyTokens(source, result) {
  const tokens = text => [...String(text || '').matchAll(/ICATPII_[A-F0-9]{8}_[A-Z]+_[0-9]{4}/g)].map(match => match[0]).sort()
  if (JSON.stringify(tokens(source)) !== JSON.stringify(tokens(result))) {
    throw new Error('ИИ изменил или потерял обозначения скрытых данных. Перевод не применён; повторите запрос или исправьте его локально.')
  }
}

module.exports = { PRIVACY_TOKEN_INSTRUCTION, assertPrivacyTokens }
