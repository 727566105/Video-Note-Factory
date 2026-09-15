"""快手用户作品列表 API（用于订阅功能）"""
import requests
from app.utils.logger import get_logger
from app.services.cookie_manager import CookieConfigManager

logger = get_logger(__name__)

KUAISHOU_API_BASE = 'https://www.kuaishou.com/graphql'
KUAISHOU_URL = "https://www.kuaishou.com/"

_HEADERS = {
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Origin': 'https://www.kuaishou.com',
    'Pragma': 'no-cache',
    'Referer': 'https://www.kuaishou.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'accept': '*/*',
    'content-type': 'application/json',
}

cfm = CookieConfigManager()


def _get_cookie() -> str:
    """获取快手 cookie"""
    cookie = cfm.get('kuaishou')
    if cookie:
        return cookie.strip()
    # 匿名 cookie
    try:
        res = requests.get(KUAISHOU_URL, headers=_HEADERS, allow_redirects=True, timeout=15)
        cookie_string = '; '.join([f"{k}={v}" for k, v in res.cookies.get_dict().items()])
        return cookie_string
    except Exception as e:
        logger.warning(f"获取快手匿名 cookie 失败: {e}")
        return ""


def fetch_kuaishou_user_videos(user_id: str, limit: int = 30) -> list[dict]:
    """获取快手用户作品列表

    Args:
        user_id: 快手用户 ID（profile URL 里的 ID）
        limit: 获取数量

    Returns:
        FeedItem 格式的列表
    """
    cookie = _get_cookie()
    headers = _HEADERS.copy()
    if cookie:
        headers['Cookie'] = cookie

    items = []
    cursor = ""
    count = min(limit, 30)

    while len(items) < limit:
        query = """
        query visionProfilePhotoList($pcursor: String, $userId: String, $page: String, $webPageArea: String) {
          visionProfilePhotoList(pcursor: $pcursor, userId: $userId, page: $page, webPageArea: $webPageArea) {
            livePhotoType
            photoType
            pcursor
            feeds {
              photo {
                id
                duration
                caption
                coverUrl
                photoUrl
                timestamp
                viewCount
                likeCount
                photoType
              }
              author {
                id
                name
                headerUrl
              }
            }
          }
        }
        """
        json_data = {
            'operationName': 'visionProfilePhotoList',
            'variables': {
                'pcursor': cursor,
                'userId': user_id,
                'page': 'profile',
                'webPageArea': '',
            },
            'query': query,
        }

        try:
            resp = requests.post(KUAISHOU_API_BASE, headers=headers, json=json_data, timeout=15)
            if resp.status_code != 200:
                logger.error(f"快手作品列表 API 失败: {resp.status_code}")
                break

            data = resp.json()
            photo_list = data.get('data', {}).get('visionProfilePhotoList', {})
            feeds = photo_list.get('feeds', [])

            if not feeds:
                break

            for feed in feeds:
                photo = feed.get('photo', {})
                author = feed.get('author', {})
                if not photo.get('id'):
                    continue

                photo_type = photo.get('photoType', 'video')
                is_atlas = photo_type == 'atlas'

                item = {
                    'content_id': photo.get('id', ''),
                    'content_url': f"https://www.kuaishou.com/short-video/{photo.get('id', '')}",
                    'title': (photo.get('caption') or '').strip().replace('\n', '')[:100],
                    'cover_url': photo.get('coverUrl', ''),
                    'duration': photo.get('duration', 0) or 0,
                    'author': author.get('name', ''),
                    'description': photo.get('caption', ''),
                    'content_type': 'article' if is_atlas else 'video',
                    'published_at': photo.get('timestamp'),
                    'raw_info': {
                        'photoType': photo_type,
                        'viewCount': photo.get('viewCount', 0),
                        'likeCount': photo.get('likeCount', 0),
                    },
                }
                items.append(item)

                if len(items) >= limit:
                    break

            cursor = photo_list.get('pcursor', '')
            if not cursor or cursor == 'no_more':
                break

        except Exception as e:
            logger.error(f"快手作品列表获取异常: {e}")
            break

    return items


def fetch_kuaishou_user_info(user_id: str) -> dict | None:
    """获取快手用户信息（昵称、头像）"""
    cookie = _get_cookie()
    headers = _HEADERS.copy()
    if cookie:
        headers['Cookie'] = cookie

    query = """
    query visionProfile($userId: String) {
      visionProfile(userId: $userId) {
        result
        hostName
        userProfile {
          ownerCount {
            fan
          }
          profile {
            gender
            user_name
            user_id
            headurl
            user_text
          }
        }
      }
    }
    """
    json_data = {
        'operationName': 'visionProfile',
        'variables': {'userId': user_id},
        'query': query,
    }

    try:
        resp = requests.post(KUAISHOU_API_BASE, headers=headers, json=json_data, timeout=15)
        if resp.status_code != 200:
            return None
        data = resp.json()
        profile = data.get('data', {}).get('visionProfile', {}).get('userProfile', {}).get('profile', {})
        return {
            'name': profile.get('user_name', ''),
            'avatar': profile.get('headurl', ''),
            'user_id': profile.get('user_id', user_id),
        }
    except Exception as e:
        logger.error(f"快手用户信息获取失败: {e}")
        return None
