import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft } from 'lucide-react-taro'

interface BackButtonProps {
  title?: string
  className?: string
}

export default function BackButton({ title, className = 'mb-4' }: BackButtonProps) {
  const handleBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
    } else {
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }

  return (
    <View
      className={`flex items-center gap-2 ${className}`}
      onClick={handleBack}
    >
      <View className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
        <ChevronLeft size={20} color="#E8651A" />
      </View>
      {title && <Text className="text-base font-medium text-foreground">{title}</Text>}
    </View>
  )
}
