import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_GAS_ENDPOINT_URL =
  "https://script.google.com/macros/s/AKfycbwhp8W6iNNXy8kdZsIsT4RyPb6B7s9e0Q-plumcst0ChfjG8ck3XJ6irlGlx0c_GpLS/exec";
const DEFAULT_PWA_URL = "https://fcbenten.github.io/team-management/";

interface ReminderRequestBody {
  testOnly?: boolean;
  memberId?: string;
  forceRun?: boolean;
}

interface NotificationRuleRow {
  rule_key: string;
  category: string;
  action_label: string;
  announcement_enabled: boolean;
  external_enabled: boolean;
  days_before: number | null;
  notify_hour: number | null;
}

interface MemberRow {
  member_id: string;
  name: string;
  email: string | null;
  notification_type: string | null;
  line_user_id: string | null;
  push_subscription: string | null;
  notify_settings: string | null;
  is_past: boolean;
  member_type: string | null;
}

interface CalendarEventItem {
  id: string;
  title?: string;
  date?: string;
  timeRange?: string;
  category?: string;
  attendeesDetail?: {
    yesEmails?: string[];
    noEmails?: string[];
    maybeEmails?: string[];
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getJstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function formatJstSlashDate(daysOffset: number): string {
  const jst = getJstNow();
  const target = new Date(jst.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

function normalizeDateSlash(raw?: string | null): string {
  if (!raw) return "";
  const m = String(raw).trim().match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!m) return "";
  return `${m[1]}/${m[2].padStart(2, "0")}/${m[3].padStart(2, "0")}`;
}

function getDayPrefixLabel(daysBefore: number): string {
  if (daysBefore === 0) return "本日";
  if (daysBefore === 1) return "明日";
  return `${daysBefore}日後`;
}

function parsePrefs(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function dispatchToRecipients(
  supabaseUrl: string,
  serviceRoleKey: string,
  recipients: MemberRow[],
  prefKey: "attendance" | "equipment",
  title: string,
  body: string,
  targetTab: string,
  tag: string,
) {
  const lineMemberIds: string[] = [];
  const pushMemberIds: string[] = [];

  for (const m of recipients) {
    const nType = String(m.notification_type || "none").toLowerCase();
    if (nType === "none") continue;
    const prefs = parsePrefs(m.notify_settings);
    if (prefs[prefKey] === false) continue;

    if ((nType === "line" || nType === "both") && m.line_user_id) {
      lineMemberIds.push(m.member_id);
    }
    if ((nType === "push" || nType === "both") && m.push_subscription) {
      pushMemberIds.push(m.member_id);
    }
  }

  let lineSent = 0;
  let pushSent = 0;

  if (lineMemberIds.length > 0) {
    const lineUrl = `${DEFAULT_PWA_URL}?openExternalBrowser=1#${targetTab}`;
    const res = await fetch(`${supabaseUrl}/functions/v1/send-line-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        memberIds: lineMemberIds,
        title,
        body,
        appUrl: lineUrl,
      }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      lineSent = Number(json.sentCount || lineMemberIds.length);
    }
  }

  if (pushMemberIds.length > 0) {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        memberIds: pushMemberIds,
        title,
        body,
        url: `./#${targetTab}`,
        tag,
      }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      pushSent = Number(json.sentCount || pushMemberIds.length);
    }
  }

  return { lineSent, pushSent };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ success: false, error: "Supabase環境変数が不足しています。" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const reqBody = (await req.json().catch(() => ({}))) as ReminderRequestBody;

    // 1. 代表の自分宛てテスト配信モード
    if (reqBody.testOnly && reqBody.memberId) {
      const { data: mRows, error: mErr } = await supabaseAdmin
        .from("members")
        .select("member_id, name, email, notification_type, line_user_id, push_subscription, notify_settings, is_past, member_type")
        .eq("member_id", reqBody.memberId)
        .limit(1);

      if (mErr || !mRows || mRows.length === 0) {
        return jsonResponse({ success: false, error: "対象メンバーが見つかりません。" }, 404);
      }

      const target = mRows[0] as MemberRow;
      const annId = `ANN-TEST-${Date.now()}`;
      const testTitle = "【テスト】明日の活動の備品当番になっています";
      const testBody = "通知管理画面から送信されたリマインドのテスト通知です（前日9:00などにこのような形式で届きます）。";

      await supabaseAdmin.from("announcements").insert({
        announcement_id: annId,
        rule_key: "reminder_equipment_duty",
        title: testTitle,
        body: testBody,
        target_tab: "equipment",
        target_member_id: target.member_id,
      });

      const nType = String(target.notification_type || "none").toLowerCase();
      let lineSent = 0;
      let pushSent = 0;

      if ((nType === "line" || nType === "both") && target.line_user_id) {
        const r = await fetch(`${supabaseUrl}/functions/v1/send-line-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            memberIds: [target.member_id],
            title: testTitle,
            body: testBody,
            appUrl: `${DEFAULT_PWA_URL}?openExternalBrowser=1#equipment`,
          }),
        });
        if (r.ok) lineSent = 1;
      }

      if ((nType === "push" || nType === "both") && target.push_subscription) {
        const r = await fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            memberIds: [target.member_id],
            title: testTitle,
            body: testBody,
            url: "./#equipment",
            tag: "fcb-reminder-test",
          }),
        });
        if (r.ok) pushSent = 1;
      }

      return jsonResponse({
        success: true,
        message: `自分宛てテスト完了（お知らせ記録済み / LINE送信: ${lineSent}件, Push送信: ${pushSent}件）`,
        lineSent,
        pushSent,
      });
    }

    // 2. 定期実行モード（毎時00分に呼ばれ、設定時刻と一致するルールのみ実行）
    const jstNow = getJstNow();
    const currentHour = jstNow.getUTCHours();

    const { data: ruleRows, error: ruleErr } = await supabaseAdmin
      .from("notification_rules")
      .select("*")
      .in("rule_key", ["reminder_attendance", "reminder_equipment_duty"]);

    if (ruleErr) {
      return jsonResponse({ success: false, error: ruleErr.message }, 500);
    }

    const activeRules = ((ruleRows || []) as NotificationRuleRow[]).filter((r) =>
      r.announcement_enabled &&
      (reqBody.forceRun || (r.notify_hour !== null && Number(r.notify_hour) === currentHour))
    );

    if (activeRules.length === 0) {
      return jsonResponse({
        success: true,
        skipped: true,
        currentHourJst: currentHour,
        reason: "現在時刻と一致する有効なリマインドルールがありません。",
      });
    }

    // イベント一覧（GAS）＆ メンバー・出欠・備品データ（Supabase）を並列取得
    const gasUrl = Deno.env.get("GAS_ENDPOINT_URL") || DEFAULT_GAS_ENDPOINT_URL;
    const [eventsRes, membersRes, attRes, eqMasterRes, eqItemsRes, eqLogsRes] = await Promise.all([
      fetch(`${gasUrl}?action=getEvents`).then((r) => r.json()).catch(() => null),
      supabaseAdmin.from("members").select("*").eq("is_past", false).eq("member_type", "REGULAR"),
      supabaseAdmin.from("attendance").select("*"),
      supabaseAdmin.from("equipment_master").select("*"),
      supabaseAdmin.from("equipment_items").select("*"),
      supabaseAdmin.from("equipment_event_logs").select("*"),
    ]);

    const events = (eventsRes && eventsRes.success && Array.isArray(eventsRes.events) ? eventsRes.events : []) as CalendarEventItem[];
    const members = (membersRes.data || []) as MemberRow[];
    const attendanceRows = (attRes.data || []) as Array<{ event_id: string; member_id: string; status: string }>;
    const eqMasterRows = (eqMasterRes.data || []) as Array<{ equipment_code: string; name: string; req_tr: string; req_trm: string; req_official: string }>;
    const eqItemsRows = (eqItemsRes.data || []) as Array<{ item_id: string; equipment_code: string; item_name: string; member_id: string | null }>;
    const eqLogsRows = (eqLogsRes.data || []) as Array<{ event_id: string; item_id: string | null; assigned_member_id: string | null }>;

    const emailToMemberId = new Map<string, string>();
    const memberById = new Map<string, MemberRow>();
    for (const m of members) {
      memberById.set(m.member_id, m);
      if (m.email) emailToMemberId.set(m.email.trim().toLowerCase(), m.member_id);
    }

    const summary: Record<string, unknown> = { currentHourJst: currentHour, executed: [] as unknown[] };

    for (const rule of activeRules) {
      const daysBefore = rule.days_before !== null && rule.days_before !== undefined ? Number(rule.days_before) : 1;
      const targetDate = formatJstSlashDate(daysBefore);
      const dayLabel = getDayPrefixLabel(daysBefore);
      const targetEvents = events.filter((ev) => normalizeDateSlash(ev.date) === targetDate);

      if (targetEvents.length === 0) {
        (summary.executed as unknown[]).push({ ruleKey: rule.rule_key, targetDate, events: 0, sent: 0 });
        continue;
      }

      const { data: prevLogs } = await supabaseAdmin
        .from("reminder_dispatch_logs")
        .select("event_id, member_id")
        .eq("rule_key", rule.rule_key)
        .eq("target_date", targetDate);

      const sentKeySet = new Set(
        (prevLogs || []).map((l: { event_id: string; member_id: string }) => `${l.event_id}::${l.member_id}`),
      );

      let totalAnnouncements = 0;
      let totalLine = 0;
      let totalPush = 0;

      for (const ev of targetEvents) {
        const cleanEvId = String(ev.id || "").split("@")[0];
        if (!cleanEvId) continue;

        const yesMemberIds = new Set<string>();
        const answeredMemberIds = new Set<string>();

        for (const att of attendanceRows) {
          if (String(att.event_id || "").split("@")[0] === cleanEvId) {
            const st = String(att.status || "").toLowerCase();
            if (st === "yes" || st === "no" || st === "maybe") {
              answeredMemberIds.add(att.member_id);
              if (st === "yes") yesMemberIds.add(att.member_id);
            }
          }
        }
        const detail = ev.attendeesDetail || {};
        for (const em of detail.yesEmails || []) {
          const id = emailToMemberId.get(String(em).trim().toLowerCase());
          if (id) {
            answeredMemberIds.add(id);
            yesMemberIds.add(id);
          }
        }
        for (const em of [...(detail.noEmails || []), ...(detail.maybeEmails || [])]) {
          const id = emailToMemberId.get(String(em).trim().toLowerCase());
          if (id) answeredMemberIds.add(id);
        }

        if (rule.rule_key === "reminder_attendance") {
          const unansweredMembers = members.filter(
            (m) => !answeredMemberIds.has(m.member_id) && !sentKeySet.has(`${cleanEvId}::${m.member_id}`),
          );
          if (unansweredMembers.length === 0) continue;

          const title = `${dayLabel}の予定の出欠が未回答です`;
          const body = `${ev.date || targetDate} ${ev.title || "活動予定"} (${ev.timeRange || ""}) の出欠をアプリから回答してください。`.trim();

          const annInserts = unansweredMembers.map((m, idx) => ({
            announcement_id: `ANN-REM-${Date.now()}-${idx}-${Math.floor(100 + Math.random() * 900)}`,
            rule_key: rule.rule_key,
            title,
            body,
            target_tab: "schedule",
            target_member_id: m.member_id,
          }));
          await supabaseAdmin.from("announcements").insert(annInserts);
          totalAnnouncements += annInserts.length;

          if (rule.external_enabled) {
            const dRes = await dispatchToRecipients(
              supabaseUrl,
              serviceRoleKey,
              unansweredMembers,
              "attendance",
              title,
              body,
              "schedule",
              `fcb-att-${cleanEvId}`,
            );
            totalLine += dRes.lineSent;
            totalPush += dRes.pushSent;
          }

          const logInserts = unansweredMembers.map((m) => ({
            dispatch_id: `${rule.rule_key}__${cleanEvId}__${m.member_id}__${targetDate}`.slice(0, 160),
            rule_key: rule.rule_key,
            event_id: cleanEvId,
            member_id: m.member_id,
            target_date: targetDate,
          }));
          await supabaseAdmin.from("reminder_dispatch_logs").upsert(logInserts, {
            onConflict: "rule_key,event_id,member_id,target_date",
          });
        } else if (rule.rule_key === "reminder_equipment_duty") {
          const cat = String(ev.category || "");
          const reqCodes = new Set<string>();
          for (const master of eqMasterRows) {
            const reqVal =
              cat === "公式戦" ? master.req_official :
              cat === "TRM" ? master.req_trm :
              cat === "TR" ? master.req_tr : "NONE";
            if (reqVal && reqVal !== "NONE") {
              reqCodes.add(master.equipment_code);
            }
          }

          const memberItemsMap = new Map<string, Set<string>>();
          for (const item of eqItemsRows) {
            if (!reqCodes.has(item.equipment_code)) continue;
            if (!item.member_id || !yesMemberIds.has(item.member_id)) continue;
            if (!memberItemsMap.has(item.member_id)) memberItemsMap.set(item.member_id, new Set());
            memberItemsMap.get(item.member_id)!.add(item.item_name || item.equipment_code);
          }

          for (const eqLog of eqLogsRows) {
            if (String(eqLog.event_id || "").split("@")[0] !== cleanEvId) continue;
            if (!eqLog.assigned_member_id || !memberById.has(eqLog.assigned_member_id)) continue;
            const matchedItem = eqItemsRows.find((it) => it.item_id === eqLog.item_id);
            const itemName = matchedItem ? (matchedItem.item_name || matchedItem.equipment_code) : "備品";
            if (!memberItemsMap.has(eqLog.assigned_member_id)) memberItemsMap.set(eqLog.assigned_member_id, new Set());
            memberItemsMap.get(eqLog.assigned_member_id)!.add(itemName);
          }

          for (const [mId, itemNamesSet] of memberItemsMap.entries()) {
            if (sentKeySet.has(`${cleanEvId}::${mId}`)) continue;
            const member = memberById.get(mId);
            if (!member) continue;

            const itemListStr = Array.from(itemNamesSet).join("・");
            const title = `${dayLabel}の活動の備品当番になっています`;
            const body = `${ev.date || targetDate} ${ev.title || "活動"} (${ev.timeRange || ""}) の持参備品: ${itemListStr}`.trim();

            await supabaseAdmin.from("announcements").insert({
              announcement_id: `ANN-EQ-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
              rule_key: rule.rule_key,
              title,
              body,
              target_tab: "equipment",
              target_member_id: mId,
            });
            totalAnnouncements += 1;

            if (rule.external_enabled) {
              const dRes = await dispatchToRecipients(
                supabaseUrl,
                serviceRoleKey,
                [member],
                "equipment",
                title,
                body,
                "equipment",
                `fcb-eq-${cleanEvId}`,
              );
              totalLine += dRes.lineSent;
              totalPush += dRes.pushSent;
            }

            await supabaseAdmin.from("reminder_dispatch_logs").upsert({
              dispatch_id: `${rule.rule_key}__${cleanEvId}__${mId}__${targetDate}`.slice(0, 160),
              rule_key: rule.rule_key,
              event_id: cleanEvId,
              member_id: mId,
              target_date: targetDate,
            }, { onConflict: "rule_key,event_id,member_id,target_date" });
          }
        }
      }

      (summary.executed as unknown[]).push({
        ruleKey: rule.rule_key,
        targetDate,
        events: targetEvents.length,
        announcements: totalAnnouncements,
        lineSent: totalLine,
        pushSent: totalPush,
      });
    }

    return jsonResponse({ success: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ success: false, error: message }, 500);
  }
});

