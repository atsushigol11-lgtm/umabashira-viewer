// これはブラウザではなくVercelのサーバー側で実行される。
// ANTHROPIC_API_KEYはVercelの環境変数に設定し、ここでだけ読み込む。
// ブラウザ側のコードには一切キーを渡さない。
//
// キャッシュについて:
// 同じレース(レース名+開催日)を再度リクエストした場合、Anthropic APIを
// 呼び出さずに保存済みの結果をそのまま返す。これにより、同じレースを
// 何度も試したり、複数人が同じレースを見に来た場合の費用を防ぐ。
//
// キャッシュにはVercel KV(Upstash Redis)を使う。KV_REST_API_URL と
// KV_REST_API_TOKEN が環境変数に設定されていない場合、キャッシュ機能は
// 自動的にスキップされ、毎回検索する従来の動作になる(エラーにはならない)。

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30日間キャッシュを保持

async function getCache(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch (e) {
    return null; // キャッシュ取得に失敗しても、通常の検索にフォールバックする
  }
}

async function setCache(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  try {
    await fetch(
      `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}?EX=${CACHE_TTL_SECONDS}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (e) {
    // 保存に失敗しても致命的ではないので無視する
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POSTのみ対応しています" });
    return;
  }

  const { prompt, cacheKey } = req.body || {};
  if (!prompt) {
    res.status(400).json({ error: "promptが必要です" });
    return;
  }

  // キャッシュ確認:同じレースなら検索せずに即座に返す
  if (cacheKey) {
    const cached = await getCache(cacheKey);
    if (cached) {
      res.status(200).json({ ...cached, _fromCache: true });
      return;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "サーバー側にAPIキーが設定されていません" });
    return;
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 15 }],
      }),
    });

    const data = await anthropicRes.json();

    // 成功した結果だけキャッシュに保存する
    if (cacheKey && anthropicRes.ok) {
      await setCache(cacheKey, data);
    }

    res.status(anthropicRes.status).json(data);
  } catch (e) {
    res.status(500).json({ error: "Anthropic APIへの通信に失敗しました" });
  }
}
