import React, { useState } from "react";

const WAKU_STYLES = {
  1: { bg: "#FFFFFF", fg: "#14201A", border: "#14201A" },
  2: { bg: "#14201A", fg: "#FFFFFF", border: "#14201A" },
  3: { bg: "#C6362B", fg: "#FFFFFF", border: "#C6362B" },
  4: { bg: "#1E5FA8", fg: "#FFFFFF", border: "#1E5FA8" },
  5: { bg: "#E8C13A", fg: "#14201A", border: "#E8C13A" },
  6: { bg: "#1C6B41", fg: "#FFFFFF", border: "#1C6B41" },
  7: { bg: "#D97B2B", fg: "#FFFFFF", border: "#D97B2B" },
  8: { bg: "#D96E9A", fg: "#FFFFFF", border: "#D96E9A" },
};

function Cell({ value, profileUrl }) {
  if (value) return <>{value}</>;
  if (profileUrl) {
    return (
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
        style={{ color: "#1E5FA8" }}
      >
        要確認 →
      </a>
    );
  }
  return <span style={{ color: "#C4C9C0" }}>—</span>;
}

function WakuBadge({ n }) {
  const s = WAKU_STYLES[n] || WAKU_STYLES[1];
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        border: `1.5px solid ${s.border}`,
      }}
      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold tabular-nums shrink-0"
    >
      {n}
    </span>
  );
}

export default function UmabashiraViewer() {
  const [raceName, setRaceName] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [meta, setMeta] = useState(null);
  const [horses, setHorses] = useState([]);
  const [copyLabel, setCopyLabel] = useState("全頭コピー");

  const missingCount = horses.filter((h) => {
    const fields = [h.sire, h.dam, h.damSire, h.lastRace, h.finish, h.corner, h.lastFurlong, h.weightChange];
    return fields.some((f) => !f);
  }).length;

  function handleCopy() {
    const lines = [];
    lines.push(`【${meta?.title || raceName}】`);
    if (meta?.info) lines.push(meta.info);
    lines.push("");

    horses.forEach((h) => {
      lines.push(`${h.waku}-${h.umaban} ${h.name}(${h.sexAge || "?"}/${h.weight || "?"}kg)`);
      lines.push(`騎手:${h.jockey || "不明"}`);
      const ped = [h.sire, h.dam, h.damSire].filter(Boolean).join(" / ");
      lines.push(`血統:${ped || "要確認"}`);
      lines.push(`前走:${h.lastRace || "要確認"}`);
      const finishLine = [
        h.finish ? `着順${h.finish}` : null,
        h.corner ? `通過${h.corner}` : null,
        h.lastFurlong ? `上がり${h.lastFurlong}` : null,
        h.weightChange ? `体重${h.weightChange}` : null,
      ]
        .filter(Boolean)
        .join(" / ");
      if (finishLine) lines.push(finishLine);
      lines.push("");
    });

    const text = lines.join("\n").trim();

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

  async function handleFetch() {
    if (!raceName.trim()) {
      setErrorMsg("レース名を入力してください");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    setHorses([]);
    setMeta(null);

    const dateHint = raceDate ? `開催日:${raceDate}` : "開催日:指定なし(直近の該当開催と推定してよい)";

    const prompt = `あなたはJRA(中央競馬)のレースデータ整理アシスタントです。
以下のレースについて、netkeibaの「馬柱(5走表示)」ページ(shutuba_past.html)を
web_searchで調べて、出走馬全頭のデータをJSONで返してください。

レース名:${raceName}
${dateHint}

手順:
1. web_searchで「${raceName} 出馬表 netkeiba」のように検索し、該当レースのnetkeiba race_idを特定する
2. 「馬柱(5走表示)」に相当する情報(血統・前走成績・コーナー通過順位・上がり3Fタイム)を検索結果から集める
3. **手順2で埋まらない馬・項目があれば、諦めずに「[馬名] netkeiba」のように
   馬単位で再検索し、個別の馬ページから血統・近走成績を補う。これを全馬に対して行う**
4. それでも見つからない項目だけ、無理に埋めず null にする
5. 各馬について、可能であればnetkeibaの馬個別ページのURL(db.netkeiba.com/horse/で
   始まるURL)を profileUrl として取得する。これは値が null の項目があるかどうかに
   関わらず、分かる範囲で必ず入れる(人が後で確認できるようにするため)

出力は以下のJSON形式のみ。説明文やマークダウンのコードフェンスは付けないこと。

{
  "raceTitle": "正式なレース名(グレードがあれば含む)",
  "raceInfo": "開催日・競馬場・距離・馬場の簡潔な一行(分からなければ null)",
  "horses": [
    {
      "waku": 1,
      "umaban": 1,
      "name": "馬名",
      "sexAge": "牝5",
      "weight": "53.0",
      "jockey": "騎手名",
      "sire": "父",
      "dam": "母",
      "damSire": "母父",
      "lastRace": "前走の概要(日付・競馬場・レース名・距離・馬場状態など)。休養明けなら「休養明け」と明記",
      "finish": "着順/頭数/人気(例:3着/12頭/1人)。分からなければ null",
      "corner": "コーナー通過順位(例:9-8)。分からなければ null",
      "lastFurlong": "上がり3Fタイム(秒、例:34.5)。分からなければ null",
      "weightChange": "馬体重(増減)。分からなければ null",
      "profileUrl": "netkeibaの馬個別ページURL。分からなければ null"
    }
  ]
}

情報が見つからない・レースが特定できない場合は、代わりに
{ "error": "理由の説明" } の形式で返してください。`;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, cacheKey: `${raceName}|${raceDate}` }),
      });

      if (!response.ok) {
        setErrorMsg(`サーバーとの通信でエラーが発生しました(status: ${response.status})。時間をおいてもう一度お試しください。`);
        setStatus("error");
        return;
      }

      const data = await response.json();

      if (data.stop_reason === "max_tokens") {
        setErrorMsg("出走頭数が多く、途中でデータが切れました。開催日を絞って、もう一度お試しください。");
        setStatus("error");
        return;
      }

      const textBlocks = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      if (!textBlocks) {
        setErrorMsg("応答が空でした。レース名の表記(正式名称)を確認して、もう一度お試しください。");
        setStatus("error");
        return;
      }

      const cleaned = textBlocks.replace(/```json|```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        setErrorMsg("データの形式を読み取れませんでした。レースが見つからなかった可能性があります。レース名の表記を変えて、もう一度お試しください。");
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
        setErrorMsg("該当するレースの出走馬データが見つかりませんでした。レース名や開催日を確認してください。");
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
            レース名を入れると、出走馬の血統・前走成績を自動でまとめます
          </p>
        </div>

        {/* Form */}
        <div
          className="rounded-lg p-5 mb-8"
          style={{ background: "#FFFFFF", border: "1px solid #D8DCD4" }}
        >
          <div className="grid sm:grid-cols-[2fr_1fr_auto] gap-3">
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: "#5B6B60" }}>
                レース名
              </label>
              <input
                type="text"
                value={raceName}
                onChange={(e) => setRaceName(e.target.value)}
                placeholder="例:CBC賞"
                className="w-full px-3 py-2 rounded border text-base"
                style={{ borderColor: "#D8DCD4" }}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: "#5B6B60" }}>
                開催日(任意)
              </label>
              <input
                type="text"
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
                placeholder="例:2026年8月9日"
                className="w-full px-3 py-2 rounded border text-base"
                style={{ borderColor: "#D8DCD4" }}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleFetch}
                disabled={status === "loading"}
                className="w-full sm:w-auto px-6 py-2 rounded font-bold text-white transition-opacity disabled:opacity-60"
                style={{ background: "#1C6B41" }}
              >
                {status === "loading" ? "取得中…" : "取得する"}
              </button>
            </div>
          </div>
        </div>

        {/* Status */}
        {status === "loading" && (
          <div className="text-sm mb-6 animate-pulse" style={{ color: "#5B6B60" }}>
            出馬表を検索しています…(数十秒かかることがあります)
          </div>
        )}
        {status === "error" && (
          <div
            className="rounded-lg p-4 mb-6 text-sm"
            style={{ background: "#FBEAE8", color: "#8A2E24", border: "1px solid #E3B4AC" }}
          >
            {errorMsg}
          </div>
        )}

        {/* Results */}
        {status === "done" && horses.length > 0 && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-bold">{meta?.title}</h2>
              {meta?.fromCache && (
                <p className="text-xs" style={{ color: "#1C6B41" }}>
                  ⚡ 保存済みデータから即座に表示(検索なし)
                </p>
              )}
              {meta?.info && (
                <p className="text-sm" style={{ color: "#5B6B60" }}>
                  {meta.info}
                </p>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-lg" style={{ border: "1px solid #D8DCD4" }}>
              <table className="w-full text-sm bg-white">
                <thead>
                  <tr style={{ background: "#14201A", color: "#FFFFFF" }}>
                    <th className="px-3 py-2 text-left font-bold">枠</th>
                    <th className="px-3 py-2 text-left font-bold">馬名</th>
                    <th className="px-3 py-2 text-left font-bold">性齢/斤量</th>
                    <th className="px-3 py-2 text-left font-bold">騎手</th>
                    <th className="px-3 py-2 text-left font-bold">血統(父/母/母父)</th>
                    <th className="px-3 py-2 text-left font-bold">前走</th>
                    <th className="px-3 py-2 text-left font-bold">着順</th>
                    <th className="px-3 py-2 text-left font-bold">通過</th>
                    <th className="px-3 py-2 text-left font-bold">上がり3F</th>
                    <th className="px-3 py-2 text-left font-bold">体重</th>
                  </tr>
                </thead>
                <tbody>
                  {horses.map((h, i) => (
                    <tr
                      key={i}
                      style={{
                        borderTop: "1px solid #EAEBE7",
                        background: i % 2 === 0 ? "#FFFFFF" : "#F7F8F5",
                      }}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <WakuBadge n={h.waku} />
                          <span className="tabular-nums font-bold">{h.umaban}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-bold whitespace-nowrap">
                        {h.profileUrl ? (
                          <a
                            href={h.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {h.name}
                          </a>
                        ) : (
                          h.name
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {h.sexAge} / {h.weight}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{h.jockey}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#5B6B60" }}>
                        <Cell value={h.sire && h.dam && h.damSire ? `${h.sire} / ${h.dam} / ${h.damSire}` : null} profileUrl={h.profileUrl} />
                      </td>
                      <td className="px-3 py-2" style={{ minWidth: "220px" }}>
                        <Cell value={h.lastRace} profileUrl={h.profileUrl} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        <Cell value={h.finish} profileUrl={h.profileUrl} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        <Cell value={h.corner} profileUrl={h.profileUrl} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        <Cell value={h.lastFurlong} profileUrl={h.profileUrl} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        <Cell value={h.weightChange} profileUrl={h.profileUrl} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {horses.map((h, i) => (
                <div
                  key={i}
                  className="rounded-lg p-4"
                  style={{ background: "#FFFFFF", border: "1px solid #D8DCD4" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <WakuBadge n={h.waku} />
                    <span className="tabular-nums font-bold text-sm">{h.umaban}</span>
                    {h.profileUrl ? (
                      <a
                        href={h.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold hover:underline"
                      >
                        {h.name}
                      </a>
                    ) : (
                      <span className="font-bold">{h.name}</span>
                    )}
                  </div>
                  <div className="text-xs grid grid-cols-2 gap-x-3 gap-y-1" style={{ color: "#5B6B60" }}>
                    <div>{h.sexAge} / {h.weight}kg</div>
                    <div>騎手:{h.jockey}</div>
                    <div className="col-span-2">
                      血統:<Cell value={h.sire && h.dam && h.damSire ? `${h.sire} / ${h.dam} / ${h.damSire}` : null} profileUrl={h.profileUrl} />
                    </div>
                    <div className="col-span-2">
                      前走:<Cell value={h.lastRace} profileUrl={h.profileUrl} />
                    </div>
                    <div>着順:<Cell value={h.finish} profileUrl={h.profileUrl} /></div>
                    <div>通過:<Cell value={h.corner} profileUrl={h.profileUrl} /></div>
                    <div>上がり3F:<Cell value={h.lastFurlong} profileUrl={h.profileUrl} /></div>
                    <div>体重:<Cell value={h.weightChange} profileUrl={h.profileUrl} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footnote */}
        <div className="mt-10 pt-4 text-xs leading-relaxed" style={{ borderTop: "1px solid #D8DCD4", color: "#8A9088" }}>
          <p>
            ・「上がり3F」は同レース内の順位ではなく、そのレースでのタイム(秒)です。
          </p>
          <p>
            ・休養明けの馬は「前走」欄が空くことがあります。その場合は直近の実走レースを表示します。
          </p>
          <p>
            ・データは検索結果をもとに自動整理したものです。重要な用途に使う前に一度確認してください。
          </p>
          <p>
            ・空欄になった項目は「要確認」のリンクから、その馬のnetkeibaページを直接開いて確認できます。
          </p>
          <p>
            ・「全頭コピー」で、LINEやメモにそのまま貼れる読みやすい形式でコピーできます。
          </p>
        </div>
      </div>
    </div>
  );
}
