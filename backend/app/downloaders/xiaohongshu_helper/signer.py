"""小红书 API 签名辅助模块 — 基于 xhshow 库"""
from xhshow import Xhshow

_xhs = Xhshow()


def sign_get(uri: str, cookies: str | dict, params: dict = None) -> dict:
    """生成 GET 请求签名头

    :param uri: API 路径（如 /api/sns/web/v1/note）
    :param cookies: Cookie 字符串或字典
    :param params: 查询参数
    :return: 签名头字典 {x-s, x-s-common, x-t, ...}
    """
    return _xhs.sign_headers_get(uri, cookies, params=params)


def sign_post(uri: str, cookies: str | dict, payload: dict = None) -> dict:
    """生成 POST 请求签名头

    :param uri: API 路径
    :param cookies: Cookie 字符串或字典
    :param payload: 请求体
    :return: 签名头字典
    """
    return _xhs.sign_headers_post(uri, cookies, payload=payload)
