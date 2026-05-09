"""
用户修改密码功能单元测试

使用 FastAPI TestClient 测试 API
运行方式: cd backend && python3 -m pytest tests/test_change_password.py -v
"""
import unittest
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.routers import auth
from app.db.user_dao import create_user, delete_user, hash_password


class TestChangePassword(unittest.TestCase):
    """修改密码 API 单元测试"""

    def setUp(self):
        """测试前准备：创建测试应用和临时用户"""
        self.app = FastAPI()
        self.app.include_router(auth.router, prefix="/api/auth")
        self.client = TestClient(self.app)

        # 创建临时测试用户
        self.test_username = "test_user_for_password"
        self.test_old_password = "oldpass123"
        self.test_user = create_user(self.test_username, self.test_old_password, "user")

    def tearDown(self):
        """测试后清理：删除临时用户"""
        try:
            delete_user(self.test_user.id)
        except:
            pass

    def _login(self, username: str, password: str) -> str:
        """辅助方法：登录获取 token"""
        resp = self.client.post(
            "/api/auth/login",
            json={"username": username, "password": password}
        )
        if resp.status_code == 200:
            return resp.json()["data"]["token"]
        return None

    def test_change_password_success(self):
        """API-01: 正确旧密码 → 修改成功"""
        token = self._login(self.test_username, self.test_old_password)
        self.assertIsNotNone(token)

        resp = self.client.put(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"old_password": self.test_old_password, "new_password": "newpass456"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["code"], 0)
        self.assertEqual(resp.json()["msg"], "密码修改成功")

    def test_change_password_wrong_old(self):
        """API-02: 旧密码错误 → 400"""
        token = self._login(self.test_username, self.test_old_password)
        self.assertIsNotNone(token)

        resp = self.client.put(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"old_password": "wrongpassword", "new_password": "newpass456"}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("旧密码错误", resp.json()["detail"])

    def test_change_password_too_short(self):
        """API-03: 新密码不足6位 → 400"""
        token = self._login(self.test_username, self.test_old_password)
        self.assertIsNotNone(token)

        resp = self.client.put(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"old_password": self.test_old_password, "new_password": "123"}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("新密码长度不能少于6位", resp.json()["detail"])

    def test_change_password_unauthorized(self):
        """API-04: 未登录 → 401"""
        resp = self.client.put(
            "/api/auth/change-password",
            json={"old_password": "any", "new_password": "newpass456"}
        )
        self.assertEqual(resp.status_code, 401)

    def test_login_with_new_password(self):
        """API-05/06: 修改后用新密码登录成功"""
        # 先修改密码
        token = self._login(self.test_username, self.test_old_password)
        self.client.put(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"old_password": self.test_old_password, "new_password": "newpass789"}
        )

        # 用新密码登录
        new_token = self._login(self.test_username, "newpass789")
        self.assertIsNotNone(new_token)

    def test_login_with_old_password_fails(self):
        """API-06: 修改后旧密码登录失败"""
        # 先修改密码
        token = self._login(self.test_username, self.test_old_password)
        self.client.put(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"old_password": self.test_old_password, "new_password": "newpass789"}
        )

        # 用旧密码登录
        old_token = self._login(self.test_username, self.test_old_password)
        self.assertIsNone(old_token)


if __name__ == "__main__":
    unittest.main()