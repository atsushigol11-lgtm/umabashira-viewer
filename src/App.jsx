import React, { useState } from "react";

export default function UmabashiraViewer() {
  // プロンプトやJSONの項目構成を変えたら、このバージョンを上げること。
  // こうしておくと、同じページを貼っても古いキャッシュが自動的に無効になり、
  // 毎回手動でUpstashのキャッシュを消す必要がなくなる。
  const PROMPT_VERSION = "v5";

  const [raceName, setRaceName] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [meta, setMeta] = useState(null);
  const [horses, setHorses] = useState([]);
  const [copyLabel, setCopyLabel] = useState("全頭コピー");

  const missingCount = horses.filter((h) => {
    const fields = [h.sire, h.dam, h.damSire, h.lastRace, h.corner, h.lastFurlong];
    return fields.some((f) => !f);
  }).length;

  function openSearch(site) {
    const q = raceName.trim() || "";
    if (site === "netkeiba") {
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(q + " 出馬表 netkeiba 馬柱")}`,
        "_blank"
      );
    } else {
      window.open("https://www.jra.go.jp/keiba/thisweek/", "_blank");
    }
  }

  function buildText() {
    const lines = [];
    lines.push(`${meta?.title || raceName}`);
    if (meta?.info) lines.push(meta.info);
    lines.push("");

    let lastWaku = null;
    horses
      .slice()
      .sort((a, b) => (a.waku - b.waku) || (a.umaban - b.umaban))
      .forEach((h) => {
        if (h.waku !== lastWaku) {
          lines.push(`【${h.waku}枠】`);
          lastWaku = h.waku;
        }
        lines.push(`${h.umaban}${h.name}`);
        const weightDiff =
          h.weight && h.lastWeight && !isNaN(parseFloat(h.weight)) && !isNaN(parseFloat(h.lastWeight))
            ? parseFloat(h.weight) - parseFloat(h.lastWeight)
            : null;
        const weightDiffText =
          weightDiff === null ? "" : weightDiff === 0 ? "(±0)" : weightDiff > 0 ? `(+${weightDiff})` : `(${weightDiff})`;
        lines.push(`斤量:${h.weight || "不明"}kg${weightDiffText}`);
        lines.push(`前走:${h.lastRace || "不明"}`);
        lines.push(`4角:${h.corner || "不明"}　上がり3F:${h.lastFurlong || "不明"}`);
        if (h.courseFit) lines.push(`同条件経験:${h.courseFit}`);
        lines.push(`騎手:${h.jockey || "不明"}`);
        lines.push(`父:${h.sire || "不明"}　母:${h.dam || "不明"}　母父:${h.damSire || "不明"}`);
        lines.push("");
      });

    return lines.join("\n").trim();
  }

  function handleCopy() {
    const text = buildText();

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyLabel("コピーしました");
        setTimeout(() => setCopyLabel("全頭コピー"), 2000);
      })
      .catch(() => {
        setCopyLabel("コピーに失敗しました");
        setTimeout(() => setCopyLabel("全頭コピー"), 2000);
      });
  }

  async function handleParse() {
    if (!pastedText.trim()) {
      setErrorMsg("ページの内容を貼り付けてください");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    setHorses([]);
    setMeta(null);

    // 貼り付けテキストのハッシュ的なものをキャッシュキーにする(先頭200文字+長さ)。
    // PROMPT_VERSIONも含めることで、プロンプトを変更した際に古いキャッシュが
    // 自動的に無効になる(同じキーにならない)。
    const cacheKey = `paste|${PROMPT_VERSION}|${pastedText.length}|${pastedText.slice(0, 200)}`;

    const prompt = `あなたはJRA(中央競馬)のレースデータ整理アシスタントです。
以下は、netkeibaまたはJRA公式サイトのページから人間がコピーして貼り付けた
テキストです。検索や外部アクセスは一切行わず、**この貼り付けられた内容だけを
根拠に**、出走馬全頭のデータをJSONで整理してください。

レース名(参考。貼り付け内容が正なら不要):${raceName || "(未入力)"}

---貼り付けられた内容---
${pastedText}
---ここまで---

ルール:
- 貼り付け内容に書かれていない情報は、絶対に推測や創作で埋めない。null にする
- 貼り付け内容の表記が崩れていても、可能な範囲で読み取る
- 血統(父・母・母父)、前走成績、コーナー通過順位、上がり3Fタイムなどが
  含まれていれば、それぞれ対応する項目に入れる。含まれていなければ null
- **出力は簡潔にすること。** lastRace(前走)は「日付・競馬場・レース名・
  距離・馬場状態・着順」を短く並べるだけにし、説明的な文章にしない
  (例:「26.7.5小倉 北九州記念(G3)芝1200重 6着」のように)
- 馬体重は今回不要。取得しない
- weight(今回の斤量)とlastWeight(前走の斤量)は、それぞれ独立して読み取ること
- **courseFitについて**:貼り付け内容には前走だけでなく、2走前・3走前など
  複数走分のデータが含まれていることがある。今回のレースの競馬場・距離
  (raceInfoやレース名から判断)と**同じ競馬場・同じ距離**を過去に走った
  記録が、表示されている範囲内(見える走数まで)にあれば、直近1件を
  「○走前:競馬場+距離 着順」のように簡潔にcourseFitへ入れる
  (例:「3走前:阪神1600 3着」)。該当がなければ null。無理に探さず、
  貼り付け内容に明確に載っている範囲でのみ判定すること

出力は以下のJSON形式のみ。説明文やマークダウンのコードフェンスは付けないこと。

{
  "raceTitle": "正式なレース名(グレードがあれば含む)。貼り付け内容から読み取る",
  "raceInfo": "開催日・競馬場・距離・馬場の簡潔な一行(分からなければ null)",
  "horses": [
    {
      "waku": 1,
      "umaban": 1,
      "name": "馬名",
      "sexAge": "牝5",
      "weight": "今回の斤量(数字のみ、例:53.0)",
      "lastWeight": "前走の斤量(数字のみ)。分からなければ null",
      "jockey": "騎手名(今回のレース)",
      "sire": "父",
      "dam": "母",
      "damSire": "母父",
      "lastRace": "前走の概要(日付・競馬場・レース名・距離・馬場状態・着順まで含める)。休養明けなら「休養明け」と明記。分からなければ null",
      "corner": "4コーナー通過時の順位(数字のみ)。「2-2」や「9-8」のように2つの数字が並んでいる場合は、後ろの数字(4コーナー)だけを使う。例:「2-2」なら2、「9-8」なら8。分からなければ null",
      "lastFurlong": "上がり3Fタイム(秒、例:34.5)。分からなければ null",
      "courseFit": "今回と同じ競馬場・同じ距離を過去に走った記録があれば「○走前:競馬場+距離 着順」の形で簡潔に。無ければ null"
    }
  ]
}

出走馬の情報が貼り付け内容から読み取れない場合は、代わりに
{ "error": "理由の説明" } の形式で返してください。`;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, cacheKey }),
      });

      if (!response.ok) {
        setErrorMsg(`サーバーとの通信でエラーが発生しました(status: ${response.status})。時間をおいてもう一度お試しください。`);
        setStatus("error");
        return;
      }

      const data = await response.json();

      if (data.stop_reason === "max_tokens") {
        setErrorMsg("出走頭数が多く、途中でデータが切れました。貼り付ける範囲を絞って、もう一度お試しください。");
        setStatus("error");
        return;
      }

      const textBlocks = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      if (!textBlocks) {
        setErrorMsg("応答が空でした。もう一度お試しください。");
        setStatus("error");
        return;
      }

      const cleaned = textBlocks.replace(/```json|```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        setErrorMsg("データの形式を読み取れませんでした。貼り付けた内容を確認して、もう一度お試しください。");
        setStatus("error");
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        setErrorMsg("データの読み取り中にエラーが発生しました。もう一度お試しください。");
        setStatus("error");
        return;
      }

      if (parsed.error) {
        setErrorMsg(parsed.error);
        setStatus("error");
        return;
      }

      if (!parsed.horses || parsed.horses.length === 0) {
        setErrorMsg("出走馬データが見つかりませんでした。貼り付けた内容を確認してください。");
        setStatus("error");
        return;
      }

      setMeta({ title: parsed.raceTitle || raceName, info: parsed.raceInfo, fromCache: !!data._fromCache });
      setHorses(parsed.horses || []);
      setStatus("done");
    } catch (e) {
      setErrorMsg("通信中にエラーが発生しました。ネットワーク接続を確認して、もう一度お試しください。");
      setStatus("error");
    }
  }

  return (
    <div
      style={{ background: "#EFF1EC", minHeight: "100vh", color: "#14201A" }}
      className="font-sans"
    >
      {/* Sticky copy bar - always visible once results exist */}
      {status === "done" && horses.length > 0 && (
        <div
          className="sticky top-0 z-20 px-4 py-2 flex items-center justify-between gap-3"
          style={{ background: "#14201A", borderBottom: "1px solid #2A362E" }}
        >
          <div className="min-w-0">
            <p className="text-white text-sm font-bold truncate">{meta?.title}</p>
            <p className="text-xs" style={{ color: missingCount > 0 ? "#E8C13A" : "#8FBFA0" }}>
              {horses.length}頭中
              {missingCount > 0 ? `${missingCount}頭に要確認あり` : "全頭データ揃い"}
            </p>
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 px-4 py-2 rounded text-sm font-bold transition-opacity active:opacity-70"
            style={{ background: "#1C6B41", color: "#FFFFFF" }}
          >
            {copyLabel === "全頭コピー" ? "📋 " : "✓ "}
            {copyLabel}
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="mb-8 border-l-4 pl-4" style={{ borderColor: "#1C6B41" }}>
          <div className="flex items-baseline gap-2">
            <h1
              className="text-4xl font-black tracking-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              馬柱
            </h1>
            <span className="text-lg font-medium" style={{ color: "#5B6B60" }}>
              ビューアー
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "#5B6B60" }}>
            レース名を入れる → ページを開く → コピー&貼り付け → 表になる。3ステップだけ。
          </p>
        </div>

        {/* Step 1: find the page */}
        <div
          className="rounded-lg p-5 mb-4"
          style={{ background: "#FFFFFF", border: "1px solid #D8DCD4" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold text-white shrink-0"
              style={{ background: "#1C6B41" }}
            >
              1
            </span>
            <label className="text-sm font-bold" style={{ color: "#14201A" }}>
              レース名を入れて、ボタンでページを開く
            </label>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={raceName}
              onChange={(e) => setRaceName(e.target.value)}
              placeholder="例:CBC賞"
              className="flex-1 px-4 py-3 rounded border text-base"
              style={{ borderColor: "#D8DCD4" }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => openSearch("netkeiba")}
                className="flex-1 sm:flex-none px-4 py-3 rounded text-sm font-bold border whitespace-nowrap"
                style={{ borderColor: "#1C6B41", color: "#1C6B41", background: "#FFFFFF" }}
              >
                netkeibaを開く
              </button>
              <button
                onClick={() => openSearch("jra")}
                className="flex-1 sm:flex-none px-4 py-3 rounded text-sm font-bold border whitespace-nowrap"
                style={{ borderColor: "#5B6B60", color: "#5B6B60", background: "#FFFFFF" }}
              >
                JRA公式を開く
              </button>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8A9088" }}>
            迷ったら「netkeibaを開く」でOK。情報が一番多い(血統・前走・
            コーナー通過・上がり3Fが全部載っている)。
          </p>
          <div
            className="rounded-md p-3 mt-3 text-xs leading-relaxed"
            style={{ background: "#FBF3E4", border: "1px solid #E8D5A8", color: "#7A5C1E" }}
          >
            <p className="font-bold mb-1">⚠️ 開いた後、タブに注意</p>
            <p>
              netkeibaのページには上部にたくさんタブが並んでいます(出走馬・競馬新聞・
              馬柱(5走)・血統・など)。<span className="font-bold">「馬柱(5走)」というタブを
              クリックしてから</span>コピーしてください。
            </p>
            <p className="mt-1">
              「<span className="font-bold">血統</span>」タブは課金しないと途中までしか
              見られないので、使わないでください。
            </p>
          </div>
        </div>

        {/* Step 2: paste */}
        <div
          className="rounded-lg p-5 mb-8"
          style={{ background: "#FFFFFF", border: "1px solid #D8DCD4" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold text-white shrink-0"
              style={{ background: "#1C6B41" }}
            >
              2
            </span>
            <label className="text-sm font-bold" style={{ color: "#14201A" }}>
              「馬柱(5走)」タブの中身を全部コピーして、下に貼り付ける
            </label>
          </div>

          <div
            className="rounded-md p-3 mb-3 text-xs leading-relaxed"
            style={{ background: "#F7F8F5", border: "1px solid #EAEBE7", color: "#5B6B60" }}
          >
            <p className="font-bold mb-1" style={{ color: "#14201A" }}>
              コピーのしかた
            </p>
            <p>
              <span className="font-bold">パソコン:</span> 開いたページ上で
              右クリック(またはCtrl+クリック)→「すべて選択」→もう一度右クリック→
              「コピー」
            </p>
            <p>
              <span className="font-bold">スマホ:</span> 開いたページの文字を
              長押し→「すべて選択」→「コピー」
            </p>
          </div>

          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="ここを長押し(またはクリック)して「貼り付け」を選ぶ"
            className="w-full px-3 py-3 rounded border text-sm font-mono"
            style={{ borderColor: "#D8DCD4", minHeight: "160px" }}
          />

          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <p className="text-xs" style={{ color: pastedText ? "#1C6B41" : "#C4C9C0" }}>
              {pastedText ? "✓ 貼り付け済み" : "まだ何も貼り付けられていません"}
            </p>
            <button
              onClick={handleParse}
              disabled={status === "loading"}
              className="px-8 py-3 rounded font-bold text-white text-base transition-opacity disabled:opacity-60"
              style={{ background: "#1C6B41" }}
            >
              {status === "loading" ? "整形中…" : "表にする"}
            </button>
          </div>
        </div>

        {/* Status */}
        {status === "loading" && (
          <div className="text-sm mb-6 animate-pulse" style={{ color: "#5B6B60" }}>
            貼り付けた内容を読み取っています…
          </div>
        )}
        {status === "error" && (
          <div
            className="rounded-lg p-4 mb-6 text-sm"
            style={{ background: "#FBEAE8", color: "#8A2E24", border: "1px solid #E3B4AC" }}
          >
            <p className="font-bold mb-1">うまくいきませんでした</p>
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Results */}
        {status === "done" && horses.length > 0 && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-bold">{meta?.title}</h2>
              {meta?.fromCache && (
                <p className="text-xs" style={{ color: "#1C6B41" }}>
                  ⚡ 保存済みデータから即座に表示
                </p>
              )}
              {meta?.info && (
                <p className="text-sm" style={{ color: "#5B6B60" }}>
                  {meta.info}
                </p>
              )}
            </div>

            {/* 出走馬リスト:カードに区切らず、1つのテキストの塊として表示 */}
            <div
              className="rounded-lg p-5 whitespace-pre-wrap text-sm leading-relaxed"
              style={{ background: "#FFFFFF", border: "1px solid #D8DCD4" }}
            >
              {buildText()}
            </div>
          </div>
        )}

        {/* Footnote */}
        <div className="mt-10 pt-4 text-xs leading-relaxed" style={{ borderTop: "1px solid #D8DCD4", color: "#8A9088" }}>
          <p>・このツールは検索やページ取得を一切行いません。貼り付けた内容だけを整形します。</p>
          <p>・「上がり3F」は同レース内の順位ではなく、そのレースでのタイム(秒)です。</p>
          <p>・貼り付け内容に無い項目は空欄(「要確認」ではなく「—」)になります。元のページで確認してください。</p>
          <p>・「全頭コピー」で、LINEやメモにそのまま貼れる読みやすい形式でコピーできます。</p>
        </div>
      </div>
    </div>
  );
}
