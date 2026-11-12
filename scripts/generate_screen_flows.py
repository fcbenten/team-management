# -*- coding: utf-8 -*-
"""
generate_screen_flows.py
FC Benten チーム管理システム 各画面データフロー図画像一括生成スクリプト
- 参照・取得フロー: 双方向矢印 (◀──▶) で「要求 / 返却」「照会 / 抽出」を表現
- 保存・更新フロー: 片方向矢印 (──▶) で「呼出送信」「データ書込」を表現
"""
import os
from playwright.sync_api import sync_playwright

FLOW_DEFINITIONS = {
    "SCR01": {
        "screen_id": "SCR01",
        "screen_name": "ログイン・Google連携",
        "flows": [
            {
                "trigger": "ログインボタン押下",
                "flow_type": "read",
                "badge_text": "認証照合・ログイン (双方向)",
                "arrow1_label": "認証要求 / 判定返却",
                "arrow2_label": "照合 / 取得",
                "gas_file": "api_auth.js",
                "gas_func": "apiLoginUser(email, password)",
                "storage_type": "db",
                "storage_name": "名簿シート",
                "storage_detail": "登録部員の照合・認証 ＆ 最終ログイン日時の更新",
                "next_screen": "SCR02 ホーム"
            },
            {
                "trigger": "登録完了ボタン押下",
                "flow_type": "write",
                "badge_text": "初期パスワード登録 (片方向保存)",
                "arrow1_label": "登録送信",
                "arrow2_label": "ハッシュ書込",
                "gas_file": "api_auth.js",
                "gas_func": "apiRegisterMember(email, newPassword)",
                "storage_type": "db",
                "storage_name": "名簿シート",
                "storage_detail": "初回パスワード（SHA-256ハッシュ）の永続化",
                "next_screen": "ログインカードへ切替"
            },
            {
                "trigger": "Google連携ボタン押下",
                "flow_type": "read",
                "badge_text": "OAuth認可URL取得 (双方向)",
                "arrow1_label": "要求 / URL返却",
                "arrow2_label": "認可要求 / トークン取得",
                "gas_file": "api_auth.js",
                "gas_func": "apiGetOAuthAuthUrl(email)",
                "storage_type": "calendar",
                "storage_name": "Google OAuth 2.0",
                "storage_detail": "チームGoogleカレンダーの認可URL生成・連携トークン取得",
                "next_screen": None
            }
        ]
    },
    "SCR02": {
        "screen_id": "SCR02",
        "screen_name": "ホーム（ダッシュボード）",
        "flows": [
            {
                "trigger": "画面初期表示時",
                "flow_type": "read",
                "badge_text": "初期データ一括取得 (双方向)",
                "arrow1_label": "要求 / 一括返却",
                "arrow2_label": "全シート照会 / 抽出",
                "gas_file": "main.js",
                "gas_func": "getInitialData(forceRefresh)",
                "storage_type": "db",
                "storage_name": "試合記録 / 名簿 / 掲示板等",
                "storage_detail": "スプレッドシート全シートデータの一括読込・サーバーキャッシュ展開",
                "next_screen": None
            },
            {
                "trigger": "直近予定の出欠回答(〇△×)",
                "flow_type": "write",
                "badge_text": "出欠ステータス更新 (片方向保存)",
                "arrow1_label": "回答送信",
                "arrow2_label": "出欠ステータス書込",
                "gas_file": "api_events.js",
                "gas_func": "updateEventAttendance(payload)",
                "storage_type": "calendar",
                "storage_name": "Googleカレンダー",
                "storage_detail": "直近イベントのゲスト出席ステータス（Accepted/Declined）即時更新",
                "next_screen": None
            }
        ]
    },
    "SCR03": {
        "screen_id": "SCR03",
        "screen_name": "試合結果一覧・詳細",
        "flows": [
            {
                "trigger": "年度/大会変更・検索実行時",
                "flow_type": "read",
                "badge_text": "データ参照・検索 (双方向)",
                "arrow1_label": "検索要求 / 一覧返却",
                "arrow2_label": "照会 / 抽出",
                "gas_file": "api_history.js",
                "gas_func": "getMatchHistoryData(sheetsData)",
                "storage_type": "db",
                "storage_name": "試合記録シート",
                "storage_detail": "指定条件に合致する試合スコア・出場メンバー記録の抽出・ソート",
                "next_screen": None
            },
            {
                "trigger": "詳細モーダル内削除ボタン押下",
                "flow_type": "write",
                "badge_text": "データ削除更新 (片方向保存)",
                "arrow1_label": "削除送信",
                "arrow2_label": "論理削除更新",
                "gas_file": "api_history.js",
                "gas_func": "saveMatchData(payload)",
                "storage_type": "db",
                "storage_name": "試合記録シート",
                "storage_detail": "対象試合レコードの論理削除フラグ更新（delFlag=1）",
                "next_screen": "一覧を再描画"
            }
        ]
    },
    "SCR04": {
        "screen_id": "SCR04",
        "screen_name": "試合結果入力・編集",
        "flows": [
            {
                "trigger": "保存ボタン押下",
                "flow_type": "write",
                "badge_text": "試合データ保存 (片方向保存)",
                "arrow1_label": "保存送信",
                "arrow2_label": "新規・更新書込",
                "gas_file": "api_history.js",
                "gas_func": "saveMatchData(payload)",
                "storage_type": "db",
                "storage_name": "試合記録シート",
                "storage_detail": "試合スコア・出場記録・個人スタッツの新規レコード追記/更新",
                "next_screen": "SCR03 試合結果一覧"
            },
            {
                "trigger": "カレンダー予定選択時",
                "flow_type": "read",
                "badge_text": "予定データ参照・取得 (双方向)",
                "arrow1_label": "選択要求 / 予定返却",
                "arrow2_label": "照会 / 取得",
                "gas_file": "api_events.js",
                "gas_func": "getCalendarEvents(memberMap)",
                "storage_type": "calendar",
                "storage_name": "Googleカレンダー",
                "storage_detail": "日時・対戦相手・会場・登録メンバー情報の自動取得・フォーム反映",
                "next_screen": None
            }
        ]
    },
    "SCR05": {
        "screen_id": "SCR05",
        "screen_name": "戦績記録・スタッツ",
        "flows": [
            {
                "trigger": "集計年度・大会種別変更時",
                "flow_type": "read",
                "badge_text": "スタッツ集計取得 (双方向)",
                "arrow1_label": "集計要求 / 結果返却",
                "arrow2_label": "照会 / 集計算出",
                "gas_file": "api_stats.js",
                "gas_func": "getStatsData(sheetsData)",
                "storage_type": "db",
                "storage_name": "試合記録シート / 集計シート",
                "storage_detail": "通算戦績（勝敗数・勝率・得失点差）およびフォーメーション別勝率の集計算出",
                "next_screen": None
            }
        ]
    },
    "SCR06": {
        "screen_id": "SCR06",
        "screen_name": "個人成績・出欠ランキング",
        "flows": [
            {
                "trigger": "出欠タブ切替 / 年度選択時",
                "flow_type": "read",
                "badge_text": "出欠ランキング取得 (双方向)",
                "arrow1_label": "要求 / ランキング返却",
                "arrow2_label": "照会 / 抽出",
                "gas_file": "batch_attendance.js",
                "gas_func": "getCalendarAttendanceData(year)",
                "storage_type": "db",
                "storage_name": "出欠集計シート",
                "storage_detail": "年間出欠率・参加回数・ランキング一覧データの取得",
                "next_screen": None
            },
            {
                "trigger": "スタッツタブ切替時",
                "flow_type": "read",
                "badge_text": "個人スタッツ取得 (双方向)",
                "arrow1_label": "要求 / 個人成績返却",
                "arrow2_label": "照会 / 集計算出",
                "gas_file": "api_stats.js",
                "gas_func": "getStatsData(sheetsData)",
                "storage_type": "db",
                "storage_name": "試合記録シート",
                "storage_detail": "部員ごとの通算ゴール数・アシスト数・MVP獲得数の集計ランキング算出",
                "next_screen": None
            }
        ]
    },
    "SCR07": {
        "screen_id": "SCR07",
        "screen_name": "スケジュール・出欠管理",
        "flows": [
            {
                "trigger": "出欠回答ボタン(〇△×)押下",
                "flow_type": "write",
                "badge_text": "出欠ステータス更新 (片方向保存)",
                "arrow1_label": "回答送信",
                "arrow2_label": "ステータス書込",
                "gas_file": "api_events.js",
                "gas_func": "updateEventAttendance(payload)",
                "storage_type": "calendar",
                "storage_name": "Googleカレンダー",
                "storage_detail": "選択イベントの部員出欠ステータス（出席・未定・欠席）を即時書き込み",
                "next_screen": None
            },
            {
                "trigger": "予定保存ボタン押下",
                "flow_type": "write",
                "badge_text": "予定作成・更新 (片方向保存)",
                "arrow1_label": "予定保存送信",
                "arrow2_label": "イベント書込",
                "gas_file": "api_events.js",
                "gas_func": "saveCalendarEvent(payload)",
                "storage_type": "calendar",
                "storage_name": "Googleカレンダー",
                "storage_detail": "新規イベントの作成、または既存イベントのタイトル・会場・日時の更新",
                "next_screen": "モーダルを閉じカレンダー再描画"
            },
            {
                "trigger": "予定削除ボタン押下",
                "flow_type": "write",
                "badge_text": "予定削除 (片方向保存)",
                "arrow1_label": "削除送信",
                "arrow2_label": "イベント削除",
                "gas_file": "api_events.js",
                "gas_func": "deleteCalendarEvent(payload)",
                "storage_type": "calendar",
                "storage_name": "Googleカレンダー",
                "storage_detail": "対象イベントをGoogleカレンダーから完全に削除",
                "next_screen": "カレンダーを再描画"
            }
        ]
    },
    "SCR08": {
        "screen_id": "SCR08",
        "screen_name": "備品管理・当番アラート",
        "flows": [
            {
                "trigger": "アラート完了ボタン押下",
                "flow_type": "write",
                "badge_text": "当番アラート解決 (片方向保存)",
                "arrow1_label": "完了送信",
                "arrow2_label": "ログ更新",
                "gas_file": "api_equipment.js",
                "gas_func": "apiResolveEquipmentAlert(payload)",
                "storage_type": "db",
                "storage_name": "備品割当ログシート",
                "storage_detail": "未割当・要メンテ備品の対応完了フラグおよび対応部員名の記録",
                "next_screen": None
            },
            {
                "trigger": "備品保存ボタン押下",
                "flow_type": "write",
                "badge_text": "備品マスタ保存 (片方向保存)",
                "arrow1_label": "保存送信",
                "arrow2_label": "マスタ書込",
                "gas_file": "api_equipment.js",
                "gas_func": "apiSaveEquipmentItem(payload)",
                "storage_type": "db",
                "storage_name": "備品一覧シート",
                "storage_detail": "備品マスタ（品名・数量・保管場所・次回点検日）の新規追加/更新",
                "next_screen": "備品カード再描画"
            },
            {
                "trigger": "備品削除ボタン押下",
                "flow_type": "write",
                "badge_text": "備品削除 (片方向保存)",
                "arrow1_label": "削除送信",
                "arrow2_label": "レコード削除",
                "gas_file": "api_equipment.js",
                "gas_func": "apiDeleteEquipmentItem(itemId)",
                "storage_type": "db",
                "storage_name": "備品一覧シート",
                "storage_detail": "該当備品レコードの削除処理",
                "next_screen": "一覧から即時除外"
            }
        ]
    },
    "SCR09": {
        "screen_id": "SCR09",
        "screen_name": "連絡板・チーム掲示板",
        "flows": [
            {
                "trigger": "投稿保存ボタン押下",
                "flow_type": "write",
                "badge_text": "投稿新規・更新 (片方向保存)",
                "arrow1_label": "投稿送信",
                "arrow2_label": "投稿書込",
                "gas_file": "api_bulletin.js",
                "gas_func": "apiSaveBulletinPost(data)",
                "storage_type": "db",
                "storage_name": "掲示板投稿シート",
                "storage_detail": "投稿タイトル・本文・添付URL・対象学年カテゴリの新規追加/更新",
                "next_screen": "タイムライン再描画"
            },
            {
                "trigger": "コメント送信ボタン押下",
                "flow_type": "write",
                "badge_text": "コメント追記 (片方向保存)",
                "arrow1_label": "コメント送信",
                "arrow2_label": "コメント書込",
                "gas_file": "api_bulletin.js",
                "gas_func": "apiAddBulletinComment(postId, content)",
                "storage_type": "db",
                "storage_name": "掲示板コメントシート",
                "storage_detail": "対象投稿への返信コメントテキスト・投稿者部員IDの追記保存",
                "next_screen": "コメント一覧更新"
            },
            {
                "trigger": "投稿タップ・閲覧時",
                "flow_type": "write",
                "badge_text": "既読ログ追記 (片方向保存)",
                "arrow1_label": "閲覧通知",
                "arrow2_label": "既読ログ追記",
                "gas_file": "api_bulletin.js",
                "gas_func": "apiMarkBulletinPostRead(postId)",
                "storage_type": "db",
                "storage_name": "掲示板既読シート",
                "storage_detail": "ログイン部員の閲覧日時を既読ログとして追記記録",
                "next_screen": None
            }
        ]
    },
    "SCR10": {
        "screen_id": "SCR10",
        "screen_name": "メンバー管理（名簿）",
        "flows": [
            {
                "trigger": "部員保存ボタン押下",
                "flow_type": "write",
                "badge_text": "部員情報保存 (片方向保存)",
                "arrow1_label": "保存送信",
                "arrow2_label": "部員情報書込",
                "gas_file": "api_members.js",
                "gas_func": "apiSaveMember(payload)",
                "storage_type": "db",
                "storage_name": "名簿シート",
                "storage_detail": "氏名・背番号・学年・ポジション・連絡先の新規追加・上書き保存",
                "next_screen": "名簿一覧を再描画"
            },
            {
                "trigger": "部員削除ボタン押下",
                "flow_type": "write",
                "badge_text": "部員削除・退団 (片方向保存)",
                "arrow1_label": "削除送信",
                "arrow2_label": "ステータス更新",
                "gas_file": "api_members.js",
                "gas_func": "apiDeleteMember(payload)",
                "storage_type": "db",
                "storage_name": "名簿シート",
                "storage_detail": "対象部員のステータスを退団に変更、またはレコード削除",
                "next_screen": "名簿一覧を再描画"
            }
        ]
    },
    "SCR11": {
        "screen_id": "SCR11",
        "screen_name": "設定・プロフィール・通知",
        "flows": [
            {
                "trigger": "画像アップロードボタン押下",
                "flow_type": "write",
                "badge_text": "アバター画像保存 (片方向保存)",
                "arrow1_label": "画像アップロード",
                "arrow2_label": "Drive保存・URL発行",
                "gas_file": "api_profile.js",
                "gas_func": "apiSaveProfileImage(playerName, base64)",
                "storage_type": "drive",
                "storage_name": "Googleドライブ (Avatarフォルダ)",
                "storage_detail": "Base64画像ファイルをDriveへ保存し、公開アバターURLを発行",
                "next_screen": "ヘッダーアバター即時反映"
            },
            {
                "trigger": "通知設定保存時",
                "flow_type": "write",
                "badge_text": "通知設定保存 (片方向保存)",
                "arrow1_label": "設定送信",
                "arrow2_label": "設定値書込",
                "gas_file": "api_profile.js",
                "gas_func": "apiSaveNotificationSettings(settings)",
                "storage_type": "db",
                "storage_name": "名簿シート (通知設定列)",
                "storage_detail": "部員ごとの試合・連絡板・出欠通知の有効/無効設定を保存",
                "next_screen": None
            },
            {
                "trigger": "パスワード変更ボタン押下",
                "flow_type": "write",
                "badge_text": "パスワード変更 (片方向保存)",
                "arrow1_label": "新パスワード送信",
                "arrow2_label": "ハッシュ値更新",
                "gas_file": "api_auth.js",
                "gas_func": "apiChangePassword(email, oldPass, newPass)",
                "storage_type": "db",
                "storage_name": "名簿シート",
                "storage_detail": "現行パスワードを検証後、新パスワードのハッシュ値を上書き保存",
                "next_screen": None
            }
        ]
    }
}

def render_all_screen_flows(output_dir="d:/app/TeamManagement/docs/flow_images"):
    os.makedirs(output_dir, exist_ok=True)
    generated_images = {}

    from render_screen_flow import generate_flow_html

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        for scr_id, screen_info in FLOW_DEFINITIONS.items():
            html_content = generate_flow_html(screen_info)
            html_path = os.path.join(output_dir, f"flow_{scr_id}.html")
            png_path = os.path.join(output_dir, f"flow_{scr_id}.png")

            with open(html_path, "w", encoding="utf-8") as f:
                f.write(html_content)

            try:
                page.set_viewport_size({"width": 1440, "height": 1100})
                page.goto(f"file:///{os.path.abspath(html_path)}")
                page.wait_for_selector(".diagram-wrapper")
                wrapper = page.query_selector(".diagram-wrapper")
                wrapper.screenshot(path=png_path)
            finally:
                if os.path.exists(html_path):
                    os.remove(html_path)
            
            generated_images[scr_id] = png_path
            print(f"[{scr_id}] Generated: {png_path}")

        browser.close()

    return generated_images

if __name__ == "__main__":
    imgs = render_all_screen_flows()
    print("Done. Total images:", len(imgs))
