import { View, Text, ScrollView } from '@tarojs/components'
import { AGREEMENT_CONTENT } from './content'

/**
 * 用户协议页：长文滚动阅读
 * 排版：大标题居中加粗 → 更新/生效日期 → 前言 → 各节（一级标题加粗放大、正文 14px、子列表缩进）
 */
export default function Agreement() {
  const doc = AGREEMENT_CONTENT
  return (
    <View className="bg-white" style={{ height: '100vh' }}>
      <ScrollView scrollY style={{ height: '100%' }}>
        <View className="px-5 pt-6 pb-10">
          <Text className="block text-center text-xl font-bold text-foreground">{doc.title}</Text>
          <View className="mt-3 text-center">
            <Text className="block text-xs text-gray-500">更新日期：{doc.updatedDate}</Text>
            <Text className="block text-xs text-gray-500 mt-1">生效日期：{doc.effectiveDate}</Text>
          </View>
          {doc.intro.map((p, i) => (
            <Text key={`intro-${i}`} className="block text-sm leading-relaxed text-[#333333] mt-4">
              {p.text}
            </Text>
          ))}
          {doc.sections.map((sec) => (
            <View key={sec.heading} className="mt-7">
              <Text className="block text-base font-bold text-foreground">{sec.heading}</Text>
              <View className="mt-1">
                {sec.paragraphs.map((p, i) => (
                  <Text
                    key={`${i}-${p.text.slice(0, 10)}`}
                    className={`block text-sm leading-relaxed text-[#333333] mt-2 ${p.indent ? 'pl-5' : ''}`}
                  >
                    {p.text}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
