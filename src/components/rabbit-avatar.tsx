import { Image } from '@tarojs/components'
import rabbitLogo from '@/assets/rabbit-logo.png'

interface RabbitAvatarProps {
  size?: number
  className?: string
}

export default function RabbitAvatar({ size = 24, className = '' }: RabbitAvatarProps) {
  return (
    <Image
      src={rabbitLogo}
      className={`rounded-full ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      mode="aspectFit"
    />
  )
}
