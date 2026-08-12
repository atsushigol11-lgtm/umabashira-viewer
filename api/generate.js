// これはブラウザではなくVercelのサーバー側で実行される。
// ANTHROPIC_API_KEYはVercelの環境変数に設定し、ここでだけ読み込む。
// ブラウザ側のコードには一切キーを渡さない。

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POSTのみ対応しています" });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    res.status(400).json({ error: "promptが必要です" });
    return;
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
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    const data = await anthropicRes.json();
    res.status(anthropicRes.status).json(data);
  } catch (e) {
    res.status(500).json({ error: "Anthropic APIへの通信に失敗しました" });
  }
}
