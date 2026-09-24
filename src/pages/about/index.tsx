import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useShareMessage } from '@/hooks/useShare'
import rabbitLogo from '@/assets/rabbit-logo.png'

/**
 * 关于力高稚家：机构简介落地页（滚动阅读）
 * 排版沿用 privacy 页：顶部 logo + 机构名 → 分节（标题加粗 + 正文），底部显示微信运行时版本号
 */
const SECTIONS = [
  {
    heading: '一、园区概况',
    paragraphs: [
      '力高稚家，主体东莞市力高托育有限公司，坐落于东莞长安镇上沙中山北路36号宏晟会馆，是经东莞市卫健局正规备案、消防验收、妇幼卫生达标认证的专业蒙特梭利社区托育机构，专注1.5～3.5岁婴幼儿托育+早教一体化的国际蒙氏托育园。园区秉承"Follow The Child 丨手牵手，从心爱护"办园理念，深耕长安本地托育服务，为双职工家庭提供就近高品质婴幼儿托管解决方案。',
    ],
  },
  {
    heading: '二、园区资质',
    paragraphs: [
      '园区全资质合规运营，完成东莞官方托育备案，保健管理制度通过长安妇幼专项验收；片区卫生保健先进托育机构、本地母婴行业家长口碑优选园，为长安上沙片区蒙氏特色标杆小型托育。目前园区属于中小型（400平）社区民办托育（20人以内办学规模）。',
    ],
  },
  {
    heading: '三、教学特色（蒙氏体系）',
    paragraphs: [
      '1:4~1:5 师生配比，全园落地正统蒙特梭利教学体系，日常依托蒙氏教具开展认知能力、语言能力（中英双语）、大运动能力（感统课、户外）、精细动作能力、社交能力、自理能力、数理逻辑、艺术能力（美育、奥尔夫音乐）八大课程，遵循幼儿自然成长规律。',
    ],
  },
]

export default function About() {
  useShareMessage()
  // 读取微信运行时版本：正式版显示实际上传版本；开发版/体验版为空时降级显示
  const appVersion = (() => {
    try {
      return Taro.getAccountInfoSync()?.miniProgram?.version || ''
    } catch {
      return ''
    }
  })()

  return (
    <View className="bg-white" style={{ height: '100vh' }}>
      <ScrollView scrollY style={{ height: '100%' }}>
        <View className="px-5 pt-8 pb-10 flex flex-col items-center">
          <Image src={rabbitLogo} className="w-20 h-20 rounded-full" mode="aspectFit" />
          <Text className="block text-center text-xl font-bold text-foreground mt-3">力高稚家</Text>
        </View>

        <View className="px-5">
          {SECTIONS.map((sec) => (
            <View key={sec.heading} className="mt-7">
              <Text className="block text-base font-bold text-foreground">{sec.heading}</Text>
              <View className="mt-1">
                {sec.paragraphs.map((p, i) => (
                  <Text key={`${i}-${p.slice(0, 10)}`} className="block text-sm leading-relaxed text-[#333333] mt-2">
                    {p}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View className="px-5 pb-8 pt-8">
          <Text className="block text-center text-xs text-gray-400">
            {appVersion ? `版本 ${appVersion}` : '开发版/体验版'}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}