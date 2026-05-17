"""中文繁简转换工具"""
try:
    from zhconv import convert
    HAS_ZHCONV = True
except ImportError:
    HAS_ZHCONV = False


def to_simplified(text: str) -> str:
    """将繁体中文转换为简体中文
    
    Args:
        text: 待转换的文本
        
    Returns:
        简体中文文本
    """
    if not text or not HAS_ZHCONV:
        return text
    
    # zh-cn 表示转换为简体中文
    return convert(text, 'zh-cn')
