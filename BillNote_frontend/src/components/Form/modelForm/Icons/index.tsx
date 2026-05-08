import * as Icons from '@lobehub/icons'
import CustomLogo from '@/assets/customAI.png'

interface AILogoProps {
  name: string
  logoUrl?: string
  style?: 'Color' | 'Text' | 'Outlined' | 'Glyph'
  size?: number
}

const AILogo = ({ name, logoUrl, style = 'Color', size = 24 }: AILogoProps) => {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="logo"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
        }}
      />
    )
  }

  const Icon = Icons[name as keyof typeof Icons]
  if (!Icon) {
    return (
      <span style={{ fontSize: size }}>
        <img src={CustomLogo} alt="CustomLogo" style={{ width: size, height: size }} />
      </span>
    )
  }

  const Variant = Icon[style as keyof typeof Icon]
  if (!Variant) {
    return <Icon size={size} />
  }

  return <Variant size={size} />
}

export default AILogo
