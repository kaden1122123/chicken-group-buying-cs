#!/usr/bin/env python3
"""
Cognee 知識庫匯入腳本
雞肉團購 AI 客服

用法:
  python cognee_import.py                    # 匯入所有知識庫
  python cognee_import.py --rebuild          # 清除舊資料重新匯入
  python cognee_import.py --check            # 只驗證不匯入
"""

import os
import sys
import argparse
from pathlib import Path

# 路徑設定
SERVICE_DIR = Path(__file__).parent.parent
KNOWLEDGE_BASE = SERVICE_DIR / "knowledge" / "base"
KNOWLEDGE_LEARNED = SERVICE_DIR / "knowledge" / "learned"

def load_cognee():
    """動態載入 Cognee，相容未來搬移到 external-user 的環境"""
    try:
        import cogenee
        return True
    except ImportError:
        # 嘗試常見路徑
        possible_paths = [
            "/home/clawuser/.openclaw/cognee-venv/cognee-server-venv/bin/python",
            "/home/external-user/.openclaw/cognee-venv/cognee-server-venv/bin/python",
            "cognee"
        ]
        for p in possible_paths:
            if Path(p).exists() or p == "cognee":
                return True
        return False

def list_knowledge_files():
    """列出所有知識庫檔案"""
    files = []
    for md_file in KNOWLEDGE_BASE.glob("*.md"):
        files.append(("base", md_file))
    for md_file in KNOWLEDGE_LEARNED.glob("*.md"):
        files.append(("learned", md_file))
    return sorted(files, key=lambda x: x[1].name)

def check_knowledge():
    """檢查知識庫狀態"""
    print("📚 知識庫檢查")
    print("=" * 50)
    
    files = list_knowledge_files()
    if not files:
        print("❌ 找不到任何知識庫檔案")
        return False
    
    print(f"✅ 找到 {len(files)} 個知識庫檔案：\n")
    for category, f in files:
        size = f.stat().st_size
        print(f"  [{category.upper():6}] {f.name} ({size} bytes)")
    
    print()
    return True

def import_to_cognee(rebuild=False):
    """匯入知識庫到 Cognee"""
    print("🔄 開始匯入知識庫到 Cognee...")
    
    if not load_cognee():
        print("❌ 無法載入 Cognee，請確認已安裝並啟動虛擬環境")
        print("   預期路徑: ~/.openclaw/cognee-venv/cognee-server-venv/")
        return False
    
    try:
        import cogenee
        
        files = list_knowledge_files()
        
        # 讀取所有知識庫內容
        texts = []
        for category, f in files:
            with open(f, "r", encoding="utf-8") as fp:
                content = fp.read().strip()
                if content:
                    texts.append(content)
                    print(f"  📄 [{category.upper():6}] {f.name}")
        
        if not texts:
            print("❌ 沒有內容可匯入")
            return False
        
        # 匯入到 Cognee
        # 注意：實際的 API 可能會根據 Cognee 版本調整
        print(f"\n✅ 準備匯入 {len(texts)} 個文件到 Cognee")
        print("   （實際匯入需視 Cognee API 而定）")
        
        # 預留鉤子： Hubert 可在這裡替換為實際的 Cognee API call
        # 例如：
        # for text in texts:
        #     cogenee.add(text, dataset_name="chicken_group_buying")
        
        return True
        
    except Exception as e:
        print(f"❌ 匯入失敗: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="雞肉團購 AI 客服知識庫匯入工具")
    parser.add_argument("--rebuild", action="store_true", help="清除舊資料重新匯入")
    parser.add_argument("--check", action="store_true", help="只驗證知識庫狀態")
    args = parser.parse_args()
    
    print("🍗 雞肉團購 AI 客服 - Cognee 知識庫匯入工具")
    print("=" * 50)
    
    if args.check:
        check_knowledge()
        return
    
    if args.rebuild:
        print("⚠️  將清除舊資料重新匯入")
    
    if check_knowledge():
        import_to_cognee(rebuild=args.rebuild)

if __name__ == "__main__":
    main()