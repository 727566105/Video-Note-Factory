import * as Icons from '@lobehub/icons'
import CustomLogo from '@/assets/customAI.png'
import NewApiLogo from '@/assets/newapi.svg'

interface AILogoProps {
  name: string
  logoUrl?: string
  type?: string
  style?: 'Color' | 'Text' | 'Outlined' | 'Glyph'
  size?: number
}

const AILogo = ({ name, logoUrl, type, style = 'Color', size = 24 }: AILogoProps) => {
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

  // NewAPI 使用官方 logo（兼容 logo='custom' + type='newapi' 的情况）
  if (name === 'NewAPI' || type === 'newapi') {
    return (
      <img
        src={NewApiLogo}
        alt="NewAPI"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
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
