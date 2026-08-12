// これはブラウザではなくVercelのサーバー側で実行される。
// ANTHROPIC_API_KEYはVercelの環境変数に設定し、ここでだけ読み込む。
// ブラウザ側のコードには一切キーを渡さない。
//
// このAPIは検索・ページ取得を一切行わない。フロント側で人間が貼り付けた
// テキストを、そのままJSONに整形するだけ。ツール(web_search等)を使わないため、
// 費用は「貼り付けた文章の長さ」にほぼ比例する形で安定する。
//
// キャッシュについて:
// 同じ貼り付け内容を再度リクエストした場合、Anthropic APIを呼び出さずに
// 保存済みの結果をそのまま返す。KV_REST_API_URL と KV_REST_API_TOKEN が
// 環境変数に設定されていない場合、キャッシュ機能は自動的にスキップされる。

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
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
        // ツールなし。検索・ページ取得は一切行わない。
        // 貼り付けられたテキストをJSONに整形するだけなので、費用が安定して低い。
      }),
    });

    const data = await anthropicRes.json();

    // 成功した結果だけキャッシュに保存する。
    // stop_reasonがmax_tokens(途中で切れた失敗)の場合は、絶対にキャッシュしない。
    // ここでキャッシュしてしまうと、後でmax_tokensの上限を上げても
    // 同じ内容を貼った際に古い「失敗結果」がずっと返り続けてしまう。
    if (cacheKey && anthropicRes.ok && data.stop_reason !== "max_tokens") {
      await setCache(cacheKey, data);
    }

    res.status(anthropicRes.status).json(data);
  } catch (e) {
    res.status(500).json({ error: "Anthropic APIへの通信に失敗しました" });
  }
}
