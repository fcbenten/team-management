import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: {
    type?: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
}

interface LineWebhookPayload {
  destination?: string;
  events?: LineWebhookEvent[];
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyLineSignature(
  rawBody: string,
  signatureHeader: string | null,
  channelSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !channelSecret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const bytes = new Uint8Array(sigBuf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const expectedBase64 = btoa(bin);
  return constantTimeEqual(expectedBase64, signatureHeader.trim());
}

function normalizeLinkCode(rawText: string): string | null {
  const half = rawText
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[－ー―‐]/g, "-")
    .trim()
    .toUpperCase();
  const match = half.match(/^(?:FCB[-\s]?)?(\d{4})$/);
  return match ? `FCB-${match[1]}` : null;
}

async function replyText(
  replyToken: string | undefined,
  text: string,
  accessToken: string,
): Promise<void> {
  if (!replyToken || !accessToken) return;
  if (
    replyToken === "00000000000000000000000000000000" ||
    replyToken === "ffffffffffffffffffffffffffffffff"
  ) {
    return;
  }

  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
  if (!res.ok) {
    console.error("LINE reply failed:", res.status, await res.text());
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET")?.trim() ?? "";
    const channelAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")?.trim() ?? "";
    if (!channelSecret || !channelAccessToken) {
      return new Response(
        JSON.stringify({
          error: "LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN が未設定です。",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature");
    const isValid = await verifyLineSignature(rawBody, signature, channelSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid LINE signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody) as LineWebhookPayload;
    const events = payload.events ?? [];
    if (events.length === 0) {
      return new Response(JSON.stringify({ success: true, verified: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    for (const ev of events) {
      const userId = ev.source?.userId;
      if (!userId) continue;

      if (ev.type === "follow") {
        await replyText(
          ev.replyToken,
          "FC Benten 通知連携アカウントを追加いただきありがとうございます。\nアプリ画面に表示された 4 桁の連携コード（例: FCB-1234）をこのトークへ送信するとアカウント連携が完了します。",
          channelAccessToken,
        );
        continue;
      }

      if (ev.type === "unfollow") {
        await supabaseAdmin
          .from("members")
          .update({ line_user_id: null, updated_at: new Date().toISOString() })
          .eq("line_user_id", userId);
        continue;
      }

      if (ev.type === "message" && ev.message?.type === "text") {
        if (ev.source?.type !== "user") {
          continue;
        }

        const candidateCode = normalizeLinkCode(ev.message.text ?? "");
        if (!candidateCode) {
          await replyText(
            ev.replyToken,
            "FC Benten 通知連携用ボットです。\n連携する場合は、アプリ画面に表示された連携コード（例: FCB-1234）をそのまま送信してください。",
            channelAccessToken,
          );
          continue;
        }

        const { data: rows, error } = await supabaseAdmin
          .from("members")
          .select("member_id, name, notify_settings")
          .ilike("notify_settings", `%${candidateCode}%`);

        if (error) {
          console.error("Supabase lookup error:", error);
          await replyText(
            ev.replyToken,
            "サーバー側で連携確認中にエラーが発生しました。時間をおいて再度お試しください。",
            channelAccessToken,
          );
          continue;
        }

        let matchedMember: {
          member_id: string;
          name: string;
          settings: Record<string, unknown>;
        } | null = null;
        let expiredFound = false;

        for (const row of rows ?? []) {
          if (!row.notify_settings) continue;
          try {
            const parsed = JSON.parse(row.notify_settings) as Record<string, unknown>;
            if (parsed.linkCode === candidateCode) {
              const exp = Number(parsed.linkCodeExpiresAt ?? 0);
              if (exp > Date.now()) {
                matchedMember = {
                  member_id: row.member_id,
                  name: row.name,
                  settings: parsed,
                };
                break;
              } else {
                expiredFound = true;
              }
            }
          } catch {
            // ignore malformed JSON
          }
        }

        if (!matchedMember) {
          const msg = expiredFound
            ? `連携コード「${candidateCode}」の有効期限が切れています。アプリ上で新しいコードを発行して送信してください。`
            : `連携コード「${candidateCode}」が見つかりませんでした。アプリ上のコードをご確認のうえ再送信してください。`;
          await replyText(ev.replyToken, msg, channelAccessToken);
          continue;
        }

        const cleanedSettings = { ...matchedMember.settings };
        delete cleanedSettings.linkCode;
        delete cleanedSettings.linkCodeExpiresAt;

        const { error: updateErr } = await supabaseAdmin
          .from("members")
          .update({
            line_user_id: userId,
            notify_settings: JSON.stringify(cleanedSettings),
            updated_at: new Date().toISOString(),
          })
          .eq("member_id", matchedMember.member_id);

        if (updateErr) {
          console.error("Supabase update error:", updateErr);
          await replyText(
            ev.replyToken,
            "LINE ID の保存に失敗しました。しばらくしてから再度お試しください。",
            channelAccessToken,
          );
          continue;
        }

        await replyText(
          ev.replyToken,
          `連携が完了しました。\n登録メンバー: ${matchedMember.name} さん\n今後はアプリからの通知がこのトークに届きます。`,
          channelAccessToken,
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("line-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
