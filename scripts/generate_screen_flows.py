# -*- coding: utf-8 -*-
"""
generate_screen_flows.py
FC Benten チーム管理システム 各画面データフロー図画像一括生成スクリプト
ユーザー要望に基づき、全11画面（SCR01〜SCR11）について以下を完全網羅:
1. 画面初期表示時のテーブル参照 (SELECT)
2. 各種イベント（ボタン押下・タブ切替・フィルター）ごとのテーブル参照・更新 (UPSERT/DELETE)
3. ボタン押下による画面遷移 (Navigate)
4. Supabase Direct (PostgreSQL 17) と GAS (Calendar/OAuth) の処理エンジン判別
"""
import os
from playwright.sync_api import sync_playwright

FLOW_DEFINITIONS = {
    "SCR01": {
        "screen_id": "SCR01",
        "screen_name": "ログイン・Google連携",
        "flows": [
            {
                "screen_sub_card": "カードA: ログインカード (#loginCard)",
                "trigger": "「ログイン」ボタン押下",
                "flow_type": "read",
                "badge_text": "部員認証・セッション確立 (SELECT)",
                "arrow1_label": "認証要求 / 返却",
                "arrow2_label": "パスワード照合",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "supabase.from('members').select()",
                "storage_type": "db",
                "storage_name": "Supabase: members テーブル",
                "storage_detail": "メールアドレスとハッシュ化パスワードの照合 ＆ 役職ロール・権限の取得",
                "next_screen": "SCR02 ホーム画面へ遷移"
            },
            {
                "screen_sub_card": "カードA: ログインカード (#loginCard)",
                "trigger": "「初めての方はこちら」リンク押下",
                "flow_type": "navigate",
                "badge_text": "OAuth認可リダイレクト (画面遷移)",
                "arrow1_label": "リンククリック",
                "arrow2_label": "外部URL遷移",
                "engine": "client",
                "file_name": "js/main.js",
                "func_name": "startGoogleOAuthFlow()",
                "storage_type": "navigate",
                "target_badge": "外部URLリダイレクト",
                "storage_name": "Google アカウント認可画面",
                "storage_detail": "accounts.google.com へPWAから直接リダイレクトし公式同意画面を展開",
                "next_screen": None
            },
            {
                "screen_sub_card": "カードB: 連携処理中 (#oauthLoadingOverlay)",
                "trigger": "Google認可コールバック (?code=...)",
                "flow_type": "navigate",
                "badge_text": "連携完了・画面内カード切替 (Sub-View)",
                "arrow1_label": "コード交換要求",
                "arrow2_label": "カード切替展開",
                "engine": "gas",
                "file_name": "server/api_auth.js",
                "func_name": "apiExchangeOAuthCode(code)",
                "storage_type": "navigate",
                "target_badge": "画面内カード切替 (Sub-View)",
                "storage_name": "カードC: パスワード設定 (#oauthPasswordCard)",
                "storage_detail": "GASでトークンをmembersへ保管後、同一画面内でパスワード初期設定カードへ切替",
                "next_screen": None
            },
            {
                "screen_sub_card": "カードC: パスワード設定 (#oauthPasswordCard)",
                "trigger": "「設定完了してログイン」ボタン押下",
                "flow_type": "write",
                "badge_text": "初期パスワード登録 ＆ ログイン (UPSERT)",
                "arrow1_label": "パスワード送信",
                "arrow2_label": "ハッシュ永続化",
                "engine": "gas",
                "file_name": "server/api_members.js",
                "func_name": "apiRegisterMember(email, newPassword)",
                "storage_type": "db",
                "storage_name": "Supabase: members テーブル",
                "storage_detail": "初回パスワードをハッシュ化して members テーブルへ永続化 ＆ ログイン完了",
                "next_screen": "SCR02 ホーム画面へ遷移"
            },
            {
                "screen_sub_card": "起動時 自動判定",
                "trigger": "画面読み込み時 (起動時)",
                "flow_type": "read",
                "badge_text": "セッション保持チェック・スキップ判定",
                "arrow1_label": "セッション確認",
                "arrow2_label": "保持データ照合",
                "engine": "client",
                "file_name": "js/main.js",
                "func_name": "checkOAuthCallbackOnLoad()",
                "storage_type": "auth",
                "storage_name": "localStorage / 保持セッション",
                "storage_detail": "端末内 fcb_auth_user の有効期限・部員情報をチェックしログイン画面をバイパス",
                "next_screen": "セッション有効時 SCR02 ホームへ即時遷移"
            }
        ]
    },
    "SCR02": {
        "screen_id": "SCR02",
        "screen_name": "ホーム（ダッシュボード）",
        "flows": [
            {
                "trigger": "画面初期表示時 (ロード時)",
                "flow_type": "read",
                "badge_text": "初期データ一括参照 (SELECT)",
                "arrow1_label": "要求 / 一括返却",
                "arrow2_label": "5テーブル同時照合",
                "engine": "supabase",
                "file_name": "js/home.js",
                "func_name": "loadAppInitialData()",
                "storage_type": "db",
                "storage_name": "Supabase: 5テーブル ＋ カレンダー",
                "storage_detail": "予定出欠(attendance), 掲示板(bulletin_posts), 備品(equipment), 試合(matches), 得点(score_logs)",
                "next_screen": "ダッシュボード全カード即時描画"
            },
            {
                "trigger": "次回活動カード内 出欠ボタン押下",
                "flow_type": "write",
                "badge_text": "直近出欠ステータス更新 (UPSERT)",
                "arrow1_label": "出欠送信",
                "arrow2_label": "即座にUPSERT",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiSaveAttendanceDirect(eventId, status)",
                "storage_type": "db",
                "storage_name": "Supabase: attendance テーブル",
                "storage_detail": "部員の出欠回答（〇/△/×）を0.1秒で即時更新 ＆ GAS経由でカレンダー出席パッチ",
                "next_screen": None
            },
            {
                "trigger": "「活動記録を書く」ボタン押下",
                "flow_type": "navigate",
                "badge_text": "掲示板起票モーダル展開 (画面遷移)",
                "arrow1_label": "起票イベント",
                "arrow2_label": "モーダル起動",
                "engine": "client",
                "file_name": "js/bulletin.js",
                "func_name": "openNewBulletinModal(eventId)",
                "storage_type": "navigate",
                "storage_name": "SCR09 掲示板 (新規投稿モーダル)",
                "storage_detail": "直近活動イベント情報を自動セットした状態で掲示板作成フォームを展開",
                "next_screen": None
            },
            {
                "trigger": "「すべての試合結果を見る ➔」リンク押下",
                "flow_type": "navigate",
                "badge_text": "試合一覧タブ切替 (画面遷移)",
                "arrow1_label": "タブ切替要求",
                "arrow2_label": "画面描画切替",
                "engine": "client",
                "file_name": "js/main.js",
                "func_name": "switchTab('results')",
                "storage_type": "navigate",
                "storage_name": "SCR03 試合結果一覧画面",
                "storage_detail": "サイドバーおよびボトムナビゲーションを「結果」タブへ即座に切り替え",
                "next_screen": None
            }
        ]
    },
    "SCR03": {
        "screen_id": "SCR03",
        "screen_name": "試合結果一覧・詳細",
        "flows": [
            {
                "trigger": "画面初期表示時",
                "flow_type": "read",
                "badge_text": "全試合データ・選手名参照 (SELECT)",
                "arrow1_label": "一覧要求 / 返却",
                "arrow2_label": "全件照会・ソート",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiGetMatchesDirect()",
                "storage_type": "db",
                "storage_name": "Supabase: matches ＋ members",
                "storage_detail": "全公式戦・TRMのスコア、対戦相手、日時、会場、出場メンバー一覧を取得",
                "next_screen": "シーズン別試合カード一覧を描画"
            },
            {
                "trigger": "年度プルダウン / 大会種別チップ選択",
                "flow_type": "read",
                "badge_text": "試合カード条件絞り込み (Filter)",
                "arrow1_label": "フィルタ適用",
                "arrow2_label": "メモリ内高速抽出",
                "engine": "client",
                "file_name": "js/results.js",
                "func_name": "filterAndRenderMatches()",
                "storage_type": "auth",
                "storage_name": "クライアント内キャッシュ / matches",
                "storage_detail": "選択されたシーズン・大会種別・勝敗条件に合致する試合を0秒で抽出",
                "next_screen": "カード一覧を再描画"
            },
            {
                "trigger": "「+ 新規試合登録」ボタン押下",
                "flow_type": "navigate",
                "badge_text": "試合登録入力画面へ遷移 (画面遷移)",
                "arrow1_label": "遷移要求",
                "arrow2_label": "入力画面展開",
                "engine": "client",
                "file_name": "js/main.js",
                "func_name": "switchTab('input')",
                "storage_type": "navigate",
                "storage_name": "SCR04 試合結果入力・編集画面",
                "storage_detail": "新規登録モードでスコア・出場選手入力フォームを初期化して遷移",
                "next_screen": None
            },
            {
                "trigger": "詳細モーダル内「削除」ボタン押下",
                "flow_type": "delete",
                "badge_text": "試合レコード論理削除 (DELETE)",
                "arrow1_label": "削除送信",
                "arrow2_label": "論理削除フラグ更新",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiDeleteMatchDirect(matchId)",
                "storage_type": "db",
                "storage_name": "Supabase: matches ＆ score_logs",
                "storage_detail": "対象試合レコードおよび得点・アシストログの論理削除 (del_flag=1)",
                "next_screen": "モーダルを閉じ一覧から対象カードを除外"
            }
        ]
    },
    "SCR04": {
        "screen_id": "SCR04",
        "screen_name": "試合結果入力・編集",
        "flows": [
            {
                "trigger": "編集モードで画面起動時 (matchId指定)",
                "flow_type": "read",
                "badge_text": "既存試合データの初期参照 (SELECT)",
                "arrow1_label": "詳細要求 / 返却",
                "arrow2_label": "試合・スタッツ照会",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiGetMatchDetailDirect(matchId)",
                "storage_type": "db",
                "storage_name": "Supabase: matches ＋ score_logs",
                "storage_detail": "試合基本情報、得失点タイムライン、出場選手、MOMの初期値を読込バインド",
                "next_screen": "編集フォーム各項目へ値を展開"
            },
            {
                "trigger": "「カレンダー予定から引用」選択時",
                "flow_type": "read",
                "badge_text": "公式カレンダー予定引用 (SELECT)",
                "arrow1_label": "予定引用要求",
                "arrow2_label": "イベント照会",
                "engine": "gas",
                "file_name": "server/api_events.js",
                "func_name": "getCalendarEvents(memberMap)",
                "storage_type": "calendar",
                "storage_name": "Google カレンダー API v3",
                "storage_detail": "該当日時の予定（対戦相手、会場、出欠〇の部員名簿）を自動取得しフォーム反映",
                "next_screen": None
            },
            {
                "trigger": "「試合記録を保存する」ボタン押下",
                "flow_type": "write",
                "badge_text": "試合データ一括保存 (UPSERT)",
                "arrow1_label": "保存送信",
                "arrow2_label": "一括UPSERTコミット",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiSaveMatchDirect(payload)",
                "storage_type": "db",
                "storage_name": "Supabase: matches ＆ score_logs",
                "storage_detail": "試合スコア・出場記録・個人スタッツログの新規追記/上書き保存",
                "next_screen": "SCR03 試合結果一覧画面へ自動遷移"
            },
            {
                "trigger": "「キャンセル」または「戻る」ボタン押下",
                "flow_type": "navigate",
                "badge_text": "入力破棄・一覧へ戻る (画面遷移)",
                "arrow1_label": "戻る操作",
                "arrow2_label": "一覧タブ復帰",
                "engine": "client",
                "file_name": "js/main.js",
                "func_name": "switchTab('results')",
                "storage_type": "navigate",
                "storage_name": "SCR03 試合結果一覧画面",
                "storage_detail": "未保存の入力内容を破棄し、試合結果一覧画面へ復帰",
                "next_screen": None
            }
        ]
    },
    "SCR05": {
        "screen_id": "SCR05",
        "screen_name": "戦績記録・スタッツ",
        "flows": [
            {
                "trigger": "画面表示時 (戦績タブ選択)",
                "flow_type": "read",
                "badge_text": "通算戦績・勝率初期集計 (SELECT)",
                "arrow1_label": "集計要求 / 返却",
                "arrow2_label": "過去全試合集計",
                "engine": "supabase",
                "file_name": "js/results.js",
                "func_name": "calculateTeamStats(matches)",
                "storage_type": "db",
                "storage_name": "Supabase: matches テーブル",
                "storage_detail": "過去全公式戦・TRMデータから勝敗数、勝率、総得失点差をリアルタイム集計算出",
                "next_screen": "戦績サマリー ＆ レーダーチャート描画"
            },
            {
                "trigger": "年度プルダウン / 大会種別フィルター切替",
                "flow_type": "read",
                "badge_text": "特定シーズン戦績再集計 (Filter)",
                "arrow1_label": "条件送信 / 結果返却",
                "arrow2_label": "条件絞り込み集計",
                "engine": "client",
                "file_name": "js/results.js",
                "func_name": "updateStatsView(season, type)",
                "storage_type": "db",
                "storage_name": "Supabase: matches テーブル",
                "storage_detail": "特定シーズン（例: 2026年度）または特定大会に絞り込み、勝率推移グラフを再計算",
                "next_screen": "集計表および月別推移グラフを再描画"
            },
            {
                "trigger": "「フォーメーション別分析」タブ切替",
                "flow_type": "read",
                "badge_text": "布陣別勝率テーブル集計 (Aggregate)",
                "arrow1_label": "集計要求 / 表返却",
                "arrow2_label": "フォーメーション集計",
                "engine": "client",
                "file_name": "js/results.js",
                "func_name": "aggregateFormationStats()",
                "storage_type": "db",
                "storage_name": "Supabase: matches.formation",
                "storage_detail": "採用布陣（4-3-3, 4-2-3-1, 3-5-2等）ごとの試合数・勝敗・勝率をグループ算出",
                "next_screen": "フォーメーション別勝率ランキング表を表示"
            }
        ]
    },
    "SCR06": {
        "screen_id": "SCR06",
        "screen_name": "個人成績・出欠ランキング",
        "flows": [
            {
                "trigger": "画面表示時 (出欠ランキングタブ選択)",
                "flow_type": "read",
                "badge_text": "年間出欠ランキング参照 (SELECT)",
                "arrow1_label": "出欠集計要求 / 返却",
                "arrow2_label": "出席率算出・ソート",
                "engine": "supabase",
                "file_name": "js/ranking.js",
                "func_name": "loadAttendanceRanking(year)",
                "storage_type": "db",
                "storage_name": "Supabase: attendance ＋ members",
                "storage_detail": "現役部員の年間出欠データ（〇/△/×）を集計し、出席率順にランキングソート",
                "next_screen": "出欠率ランキングテーブル（順位・率・日数）を描画"
            },
            {
                "trigger": "「個人スタッツ」タブ切替時",
                "flow_type": "read",
                "badge_text": "得点王・アシスト王ランキング参照 (SELECT)",
                "arrow1_label": "スタッツ要求 / 返却",
                "arrow2_label": "得点・MOM集計",
                "engine": "supabase",
                "file_name": "js/ranking.js",
                "func_name": "loadPlayerStatsRanking()",
                "storage_type": "db",
                "storage_name": "Supabase: score_logs ＋ members",
                "storage_detail": "部員ごとのゴール数、アシスト数、MOM選出数をグループ集計してランキング化",
                "next_screen": "得点王TOP10 ＆ アシストランキングを描画"
            },
            {
                "trigger": "ランキング一覧内の部員行タップ",
                "flow_type": "navigate",
                "badge_text": "部員個人カルテ展開 (画面遷移)",
                "arrow1_label": "カルテ要求",
                "arrow2_label": "モーダル展開",
                "engine": "client",
                "file_name": "js/ranking.js",
                "func_name": "openPlayerDetailModal(memberId)",
                "storage_type": "navigate",
                "storage_name": "部員個人カルテ詳細モーダル",
                "storage_detail": "通算成績、シーズン別推移、過去全出場試合タイムラインを抽出して展開",
                "next_screen": None
            }
        ]
    },
    "SCR07": {
        "screen_id": "SCR07",
        "screen_name": "スケジュール・出欠管理",
        "flows": [
            {
                "trigger": "画面表示時 (スケジュールタブ選択)",
                "flow_type": "read",
                "badge_text": "月次予定 ＆ 出欠一覧参照 (SELECT)",
                "arrow1_label": "月次データ要求 / 返却",
                "arrow2_label": "原本取得 ＆ DB照合",
                "engine": "supabase",
                "file_name": "js/schedule.js",
                "func_name": "fetchCalendarAndAttendance(month)",
                "storage_type": "db",
                "storage_name": "Google カレンダー ＋ Supabase: attendance",
                "storage_detail": "Googleカレンダー予定原本と全部員の出欠登録状況をマージ取得",
                "next_screen": "月次カレンダーグリッドに出欠バッジを描画"
            },
            {
                "trigger": "出欠回答ボタン (〇/△/×) 押下",
                "flow_type": "write",
                "badge_text": "出欠登録 ＆ カレンダー同期 (UPSERT)",
                "arrow1_label": "回答送信",
                "arrow2_label": "即座にUPSERT",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiSaveAttendanceDirect(eventId, status)",
                "storage_type": "db",
                "storage_name": "Supabase: attendance ＆ Googleカレンダー",
                "storage_detail": "自身の出欠をSupabaseへ0.1秒保存 ＆ GAS経由でカレンダー出席パッチ更新",
                "next_screen": "オプティミスティックUIで出欠マーク即時反転"
            },
            {
                "trigger": "カレンダー日付または予定カードタップ",
                "flow_type": "navigate",
                "badge_text": "予定詳細モーダル展開 (画面遷移)",
                "arrow1_label": "詳細表示要求",
                "arrow2_label": "モーダル起動",
                "engine": "client",
                "file_name": "js/schedule.js",
                "func_name": "openEventDetailModal(eventId)",
                "storage_type": "navigate",
                "storage_name": "予定詳細モーダル",
                "storage_detail": "参加/不参加部員一覧チップ、会場マップ、持参備品担当を表示",
                "next_screen": None
            },
            {
                "trigger": "詳細モーダル内「+ 活動記録を書く」ボタン押下",
                "flow_type": "navigate",
                "badge_text": "掲示板活動記録起票へ遷移 (画面遷移)",
                "arrow1_label": "起票要求",
                "arrow2_label": "モーダル起動",
                "engine": "client",
                "file_name": "js/bulletin.js",
                "func_name": "openNewBulletinModal(eventId)",
                "storage_type": "navigate",
                "storage_name": "SCR09 チーム掲示板 (活動記録起票)",
                "storage_detail": "該当イベントを自動選択・紐付けした状態で活動記録投稿フォームを起動",
                "next_screen": None
            }
        ]
    },
    "SCR08": {
        "screen_id": "SCR08",
        "screen_name": "備品管理・当番アラート",
        "flows": [
            {
                "trigger": "画面初期表示時",
                "flow_type": "read",
                "badge_text": "備品台帳 ＆ 7日間不在判定参照 (SELECT)",
                "arrow1_label": "台帳要求 / 返却",
                "arrow2_label": "現物照合 ＆ 不在判定",
                "engine": "supabase",
                "file_name": "js/equipment.js",
                "func_name": "loadEquipmentDashboard()",
                "storage_type": "db",
                "storage_name": "Supabase: equipment_items ＋ master",
                "storage_detail": "現物台帳（EQ-001〜）と7日先予定の出欠を照合し保管者不在アラートを自動判定",
                "next_screen": "不在警告バナー ＆ 保管者台帳カードを描画"
            },
            {
                "trigger": "不在アラート内「代理解決」ボタン押下",
                "flow_type": "write",
                "badge_text": "代理持参割当登録 (INSERT)",
                "arrow1_label": "代理登録送信",
                "arrow2_label": "割当ログ追記",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiResolveEquipmentAlertDirect(payload)",
                "storage_type": "db",
                "storage_name": "Supabase: equipment_event_logs",
                "storage_detail": "対象活動日における代理持参者IDをINSERTし、不在アラートを即時解除",
                "next_screen": "画面から不在アラートカードを即座に消去"
            },
            {
                "trigger": "「+ 新規備品登録」モーダル内 保存押下",
                "flow_type": "write",
                "badge_text": "備品現物新規登録 (INSERT)",
                "arrow1_label": "新規保存送信",
                "arrow2_label": "アイテムINSERT",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiSaveEquipmentItemDirect(itemData)",
                "storage_type": "db",
                "storage_name": "Supabase: equipment_items テーブル",
                "storage_detail": "管理ID自動採番、備品コード、初期保管者メンバーID、備考を新規登録",
                "next_screen": "モーダルを閉じ備品台帳カードを再描画"
            },
            {
                "trigger": "備品カード内「保管者変更」プルダウン選択",
                "flow_type": "write",
                "badge_text": "保管者変更・引継ぎ (UPDATE)",
                "arrow1_label": "変更送信",
                "arrow2_label": "保管者ID更新",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiUpdateEquipmentHolderDirect(itemId, newHolderId)",
                "storage_type": "db",
                "storage_name": "Supabase: equipment_items.holder_member_id",
                "storage_detail": "現物アイテムの保管者を新部員IDへUPDATE ＆ 更新タイムスタンプを記録",
                "next_screen": "新保管者のアバターアイコンへ即座に更新"
            }
        ]
    },
    "SCR09": {
        "screen_id": "SCR09",
        "screen_name": "連絡板・チーム掲示板",
        "flows": [
            {
                "trigger": "画面初期表示時",
                "flow_type": "read",
                "badge_text": "投稿タイムライン ＆ 既読参照 (SELECT)",
                "arrow1_label": "タイムライン要求 / 返却",
                "arrow2_label": "投稿・既読一括取得",
                "engine": "supabase",
                "file_name": "js/bulletin.js",
                "func_name": "loadBulletinTimeline()",
                "storage_type": "db",
                "storage_name": "Supabase: bulletin_posts ＋ reads",
                "storage_detail": "全投稿（タイトル、本文、ピン留め）と自身の既読状態を一括取得",
                "next_screen": "フィード一覧描画 ＆ 未読バッジ集計反映"
            },
            {
                "trigger": "新規投稿モーダル内「投稿する」ボタン押下",
                "flow_type": "write",
                "badge_text": "新規投稿作成・保存 (INSERT)",
                "arrow1_label": "投稿データ送信",
                "arrow2_label": "レコードINSERT",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiSaveBulletinPostDirect(postData)",
                "storage_type": "db",
                "storage_name": "Supabase: bulletin_posts テーブル",
                "storage_detail": "タイトル、本文、カテゴリ、活動予定紐付け、ピン留め設定を新規コミット",
                "next_screen": "モーダルを閉じタイムライン最上部に新着カード展開"
            },
            {
                "trigger": "タイムライン上の投稿カードタップ",
                "flow_type": "write",
                "badge_text": "投稿詳細展開 ＆ 自動既読記録 (INSERT)",
                "arrow1_label": "閲覧通知送信",
                "arrow2_label": "既読日時INSERT",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiMarkPostReadDirect(postId)",
                "storage_type": "db",
                "storage_name": "Supabase: bulletin_reads テーブル",
                "storage_detail": "詳細モーダルを展開し、ログイン部員の閲覧日時を既読ログとして追記記録",
                "next_screen": "既読・未読者一覧チップ ＆ 返信欄を表示"
            },
            {
                "trigger": "詳細モーダル内「コメント送信」ボタン押下",
                "flow_type": "write",
                "badge_text": "返信コメント追記 (INSERT)",
                "arrow1_label": "コメント送信",
                "arrow2_label": "コメント追記",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiAddBulletinCommentDirect(postId, content)",
                "storage_type": "db",
                "storage_name": "Supabase: bulletin_comments テーブル",
                "storage_detail": "対象投稿に対する返信テキスト、投稿部員ID、投稿日時を追記保存",
                "next_screen": "コメントスレッドへ新着コメントを即時追加"
            }
        ]
    },
    "SCR10": {
        "screen_id": "SCR10",
        "screen_name": "メンバー管理（名簿・役員専用）",
        "flows": [
            {
                "trigger": "画面表示時 (役員権限チェック)",
                "flow_type": "read",
                "badge_text": "全部員名簿・権限データ参照 (SELECT)",
                "arrow1_label": "名簿要求 / 一括返却",
                "arrow2_label": "全部員照会",
                "engine": "supabase",
                "file_name": "js/members.js",
                "func_name": "loadMemberListForAdmin()",
                "storage_type": "db",
                "storage_name": "Supabase: members テーブル",
                "storage_detail": "現役・休部・OB全部員の氏名、学年、背番号、ポジション、ロール、連絡先を取得",
                "next_screen": "部員管理グリッドカード一覧を描画"
            },
            {
                "trigger": "在籍ステータスタブ (現役/休部/OB) 切替",
                "flow_type": "read",
                "badge_text": "在籍ステータス絞り込み (Filter)",
                "arrow1_label": "タブ切替適用",
                "arrow2_label": "ステータス抽出",
                "engine": "client",
                "file_name": "js/members.js",
                "func_name": "filterMembersByStatus(status)",
                "storage_type": "auth",
                "storage_name": "クライアント内キャッシュ / members",
                "storage_detail": "選択されたステータスに応じた部員カードの絞り込み ＆ 人数バッジ更新",
                "next_screen": "一覧を0秒フィルタリング切り替え"
            },
            {
                "trigger": "部員編集モーダル内「保存する」ボタン押下",
                "flow_type": "write",
                "badge_text": "部員情報登録・更新 (UPSERT)",
                "arrow1_label": "部員データ送信",
                "arrow2_label": "情報UPSERT",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiSaveMemberDirect(memberData)",
                "storage_type": "db",
                "storage_name": "Supabase: members テーブル",
                "storage_detail": "氏名、背番号、ポジション、学年、役職ロール、在籍ステータスをコミット",
                "next_screen": "モーダルを閉じ名簿一覧カードを再描画"
            },
            {
                "trigger": "編集モーダル内「退団（OB化）」ボタン押下",
                "flow_type": "delete",
                "badge_text": "部員退団・OBステータス更新 (DELETE)",
                "arrow1_label": "退団送信",
                "arrow2_label": "ステータス更新",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiDeleteMemberDirect(memberId)",
                "storage_type": "db",
                "storage_name": "Supabase: members ＆ equipment_items",
                "storage_detail": "所持備品の返却チェック後、在籍ステータスを OB (del_flag=1) に安全更新",
                "next_screen": "現役一覧から除外されOBタブへ自動移動"
            }
        ]
    },
    "SCR11": {
        "screen_id": "SCR11",
        "screen_name": "設定・プロフィール・通知",
        "flows": [
            {
                "trigger": "設定モーダル起動時 (アバタータップ)",
                "flow_type": "read",
                "badge_text": "自己情報・通知設定参照 (SELECT)",
                "arrow1_label": "プロフ要求 / 返却",
                "arrow2_label": "登録情報照会",
                "engine": "supabase",
                "file_name": "js/common.js",
                "func_name": "openProfileModal()",
                "storage_type": "db",
                "storage_name": "Supabase: members テーブル",
                "storage_detail": "ログイン部員の登録情報、アバター画像URL、通知受信先設定（LINE/Push等）を取得",
                "next_screen": "設定モーダル各項目へ初期値をバインド"
            },
            {
                "trigger": "アバター画像選択 ➔ クロップ「保存」押下",
                "flow_type": "write",
                "badge_text": "アバター画像CDN保存 ＆ URL更新 (Upload)",
                "arrow1_label": "画像バイナリ送信",
                "arrow2_label": "CDN保存・URL更新",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "uploadAvatarStorageDirect(file, memberId)",
                "storage_type": "storage",
                "storage_name": "Supabase Storage: member-avatars",
                "storage_detail": "256x256正方形JPEGをCDNへアップロードし、members.avatar_url を更新",
                "next_screen": "ヘッダーおよび全画面のアバターアイコンを即時更新"
            },
            {
                "trigger": "通知手段 (LINE/WebPush/両方/なし) 選択時",
                "flow_type": "write",
                "badge_text": "通知受信設定即時保存 (UPDATE)",
                "arrow1_label": "設定送信",
                "arrow2_label": "設定列UPDATE",
                "engine": "supabase",
                "file_name": "js/supabase.js",
                "func_name": "apiSaveNotifySettingsDirect(settings)",
                "storage_type": "db",
                "storage_name": "Supabase: members.notify_settings",
                "storage_detail": "雨天中止・出欠リマインド・掲示板通知の個別配信先設定を即座に更新",
                "next_screen": "保存完了フィードバックを表示"
            },
            {
                "trigger": "「ログアウト」ボタン押下 ➔ 確認OK",
                "flow_type": "navigate",
                "badge_text": "セッション消去・ログイン画面へ遷移 (画面遷移)",
                "arrow1_label": "ログアウト操作",
                "arrow2_label": "セッション破棄",
                "engine": "client",
                "file_name": "js/main.js",
                "func_name": "handleLogout()",
                "storage_type": "navigate",
                "storage_name": "SCR01 ログイン・Google連携画面",
                "storage_detail": "localStorage (fcb_auth_user) を完全消去し、認証前ログイン画面へリダイレクト",
                "next_screen": None
            }
        ]
    }
}

def render_all_screen_flows(output_dir="d:/app/TeamManagement/docs/flow_images"):
    os.makedirs(output_dir, exist_ok=True)
    generated_images = {}

    from render_screen_flow import generate_flow_html
    from render_swimlane_flow import build_scr01_swimlane_html

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        for scr_id, screen_info in FLOW_DEFINITIONS.items():
            html_path = os.path.join(output_dir, f"flow_{scr_id}.html")
            png_path = os.path.join(output_dir, f"flow_{scr_id}.png")

            if scr_id == "SCR01":
                html_content = build_scr01_swimlane_html()
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(html_content)
                try:
                    page.set_viewport_size({"width": 1620, "height": 1100})
                    page.goto(f"file:///{os.path.abspath(html_path)}")
                    page.wait_for_selector(".edge-label")
                    page.wait_for_timeout(200)
                    container = page.query_selector("#diagram-container")
                    container.screenshot(path=png_path)
                finally:
                    if os.path.exists(html_path):
                        os.remove(html_path)
            else:
                html_content = generate_flow_html(screen_info)
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(html_content)

                try:
                    page.set_viewport_size({"width": 1460, "height": 1400})
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
