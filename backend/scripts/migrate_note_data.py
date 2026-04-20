"""
笔记数据迁移脚本

修复旧笔记文件缺失 model_name、style、versions 字段的问题
"""
import os
import json
from datetime import datetime
import uuid

# 获取脚本所在目录，然后定位到 note_results
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
NOTE_OUTPUT_DIR = os.path.join(BACKEND_DIR, "note_results")


def migrate_note_file(filepath):
    """为单个笔记文件补充缺失字段"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 检查是否需要迁移
    if data.get('model_name') and data.get('style') and data.get('versions'):
        return False  # 已有完整数据，跳过

    # 补充缺失字段
    updated = False

    # 补充 model_name
    if not data.get('model_name'):
        data['model_name'] = '未知模型'
        updated = True

    # 补充 style
    if not data.get('style'):
        data['style'] = 'detailed'  # 默认风格
        updated = True

    # 补充 versions（将现有 markdown 封装为第一个版本）
    if not data.get('versions') and data.get('markdown'):
        filename = os.path.basename(filepath)
        task_id = filename.replace('.json', '')
        data['versions'] = [{
            'ver_id': f"{task_id}-{uuid.uuid4()}",
            'content': data['markdown'],
            'style': data['style'],
            'model_name': data['model_name'],
            'created_at': datetime.now().isoformat()
        }]
        updated = True

    if updated:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return updated


def main():
    print(f'笔记目录: {NOTE_OUTPUT_DIR}')
    print(f'开始迁移...\n')

    migrated = 0
    skipped = 0
    errors = 0

    if not os.path.exists(NOTE_OUTPUT_DIR):
        print(f'目录不存在: {NOTE_OUTPUT_DIR}')
        return

    for filename in os.listdir(NOTE_OUTPUT_DIR):
        # 只处理主笔记文件，跳过状态文件和缓存文件
        if (filename.endswith('.json') and
            not filename.endswith('.status.json') and
            not filename.endswith('_audio.json') and
            not filename.endswith('_transcript.json') and
            not filename.endswith('_markdown.json')):

            filepath = os.path.join(NOTE_OUTPUT_DIR, filename)
            try:
                if migrate_note_file(filepath):
                    migrated += 1
                    print(f'✓ 已迁移: {filename}')
                else:
                    skipped += 1
            except Exception as e:
                errors += 1
                print(f'✗ 错误: {filename} - {e}')

    print(f'\n迁移完成:')
    print(f'  - 已修复: {migrated} 个文件')
    print(f'  - 已跳过: {skipped} 个文件（数据完整）')
    print(f'  - 错误: {errors} 个文件')


if __name__ == '__main__':
    main()
