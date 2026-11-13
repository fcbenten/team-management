import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendLineRequestBody {
  memberId?: string;
  memberIds?: string[];
  lineUserId?: string;
  targetAll?: boolean;
  title?: string;
  body?: string;
  appUrl?: string;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildLineMessages(title: string, body: string, appUrl?: string) {
  const safeUrl = (appUrl && /^https:\/\//i.test(appUrl.trim())) ? appUrl.trim() : null;

  if (!safeUrl) {
    return [
      {
        type: "text",
        text: `【${title}】\n${body}`,
      },
    ];
  }

  return [
    {
      type: "flex",
      altText: `${title}: ${body}`,
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#2563EB",
          paddingAll: "12px",
          contents: [
            {
              type: "text",
              text: "FC Benten",
              color: "#DBEAFE",
              size: "xs",
              weight: "bold",
            },
            {
              type: "text",
              text: title,
              color: "#FFFFFF",
              size: "md",
              weight: "bold",
              wrap: true,
              margin: "xs",
            },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "14px",
          contents: [
            {
              type: "text",
              text: body,
              size: "sm",
              color: "#334155",
              wrap: true,
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          paddingAll: "12px",
          paddingTop: "0px",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#2563EB",
              height: "sm",
              action: {
                type: "uri",
                label: "アプリを開く",
                uri: safeUrl,
              },
            },
          ],
        },
      },
    },
  ];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const accessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")?.trim() ?? "";
    if (!accessToken) {
      return jsonResponse({
        success: false,
        error: "LINE_CHANNEL_ACCESS_TOKEN が未設定です。supabase secrets set で設定してください。",
      }, 500);
    }

    const reqBody = (await req.json()) as SendLineRequestBody;
    const title = (reqBody.title || "FC Benten テスト通知").trim();
    const messageBody = (reqBody.body || "LINE 個人通知の受信テストです。").trim();
    const messages = buildLineMessages(title, messageBody, reqBody.appUrl);

    const targets: Array<{ memberId?: string; name?: string; lineUserId: string }> = [];

    if (reqBody.lineUserId && reqBody.lineUserId.trim()) {
      targets.push({ lineUserId: reqBody.lineUserId.trim() });
    } else {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      let query = supabaseAdmin
        .from("members")
        .select("member_id, name, line_user_id")
        .not("line_user_id", "is", null)
        .neq("line_user_id", "");

      if (reqBody.memberId) {
        query = query.eq("member_id", reqBody.memberId);
      } else if (reqBody.memberIds && reqBody.memberIds.length > 0) {
        query = query.in("member_id", reqBody.memberIds);
      } else if (reqBody.targetAll) {
        query = query.eq("is_past", false);
      } else {
        return jsonResponse({
          success: false,
          error: "memberId, memberIds, lineUserId, または targetAll を指定してください。",
        }, 400);
      }

      const { data: rows, error } = await query;
      if (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
      for (const row of rows ?? []) {
        if (row.line_user_id) {
          targets.push({
            memberId: row.member_id,
            name: row.name,
            lineUserId: row.line_user_id,
          });
        }
      }
    }

    if (targets.length === 0) {
      return jsonResponse({
        success: false,
        error: "LINE連携済みの対象メンバーが見つかりませんでした。先に連携コードを公式LINEへ送信してください。",
        sentCount: 0,
      }, 404);
    }

    const userIds = Array.from(new Set(targets.map((t) => t.lineUserId)));

    if (userIds.length === 1) {
      const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to: userIds[0],
          messages,
        }),
      });

      if (!lineRes.ok) {
        const errText = await lineRes.text();
        return jsonResponse({
          success: false,
          error: `LINE Push API エラー (${lineRes.status}): ${errText}`,
        }, lineRes.status);
      }
    } else {
      for (let i = 0; i < userIds.length; i += 500) {
        const chunk = userIds.slice(i, i + 500);
        const lineRes = await fetch("https://api.line.me/v2/bot/message/multicast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            to: chunk,
            messages,
          }),
        });

        if (!lineRes.ok) {
          const errText = await lineRes.text();
          return jsonResponse({
            success: false,
            error: `LINE Multicast API エラー (${lineRes.status}): ${errText}`,
          }, lineRes.status);
        }
      }
    }

    return jsonResponse({
      success: true,
      sentCount: userIds.length,
      targets: targets.map((t) => ({ memberId: t.memberId ?? null, name: t.name ?? null })),
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ success: false, error: message }, 500);
  }
});

