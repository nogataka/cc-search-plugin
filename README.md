# cc-search-plugin

Claude Code の過去の会話履歴を検索し、コンパクション後にコンテキストを自動注入するプラグインです。

## このプラグインが解決する課題

Claude Code には `/compact` コマンドによるコンテキスト圧縮機能が組み込まれています。この機能は会話が長くなった際にAIが全体を要約し、コンテキストウィンドウを節約します。

しかし、デフォルトの compact には以下の限界があります:

- **AI要約に依存** — 要約の過程で細かいやり取りや具体的な指示が失われることがある
- **セッション間の引き継ぎなし** — 新しいセッションを開始すると、前回の会話内容は完全に失われる
- **過去の会話を検索できない** — 「前に話したあの件」を探す手段がない

cc-search-plugin はこれらを補完します:

| 観点 | デフォルト compact | cc-search-plugin |
|---|---|---|
| 情報源 | AIが会話全体を推論・要約 | JSONLファイルから直近N件を機械的に抽出 |
| カバー範囲 | 会話全体を要約 | 直近10件のメッセージ（設定可能） |
| 内容の忠実度 | 要約（意図・判断理由を含む） | 原文テキスト（500文字で切り詰め） |
| 判断理由・文脈 | 「なぜそうしたか」が保存される | 保存されない（生のやり取りのみ） |
| 情報量 | 多い（~200行の詳細サマリー） | 少ない（~50行のコンパクトな出力） |
| 生成コスト | 高い（AI推論が必要） | 低い（ファイル読み取りのみ） |
| 信頼性 | AIの要約精度に依存 | 原文そのまま（切り詰め以外は正確） |
| 過去セッション検索 | 不可 | キーワード検索可能 |

**両者は補完関係にあります。** デフォルト compact が「何をなぜやったか」の全体像を保持する一方、cc-search-plugin は「直近の実際のやり取り」を正確に保持します。併用することで、要約で失われた細部を補えます。

## 機能

- **自動コンテキスト注入** — `/compact` 実行後、SessionStart hook が自動的に直近のメッセージをコンテキストに注入します
- **手動検索** — `/history-recall` スキルで過去の会話をキーワード検索、プロジェクト一覧表示、セッション詳細表示ができます
- **CLI ツール** — 会話履歴の検索・取得用のスタンドアロン CLI

## インストール

### 前提条件

- Claude Code がインストール済みであること
- Node.js 18 以上

### GitHub からインストール

Claude Code のセッション内で以下のコマンドを実行します:

**Step 1: マーケットプレースを追加**

```
/plugin marketplace add nogataka/cc-search-plugin
```

このコマンドにより、GitHub リポジトリがマーケットプレースとして `~/.claude/plugins/marketplaces/` にクローンされます。

**Step 2: プラグインをインストール**

```
/plugin install cc-search-plugin
```

`~/.claude/plugins/cache/` にプラグインがコピーされ、hooks と skills が有効になります。

**Step 3: 動作確認**

```
/compact
```

を実行して、コンパクション後に「Previous session summary:」というコンテキストが注入されることを確認します。

### ローカルディレクトリからインストール

開発中やフォーク版を使う場合は、ローカルパスを指定できます:

```
/plugin marketplace add /path/to/cc-search-plugin
/plugin install cc-search-plugin
```

### アンインストール

```
/plugin uninstall cc-search-plugin
```

## 仕組み

### 自動コンテキスト注入（compact 後）

Claude Code で `/compact` を実行すると、プラグインの SessionStart hook が自動的に発火します:

1. stdin から hook 入力 JSON（`session_id` 等）を受け取る
2. `~/.claude/projects/` から該当セッションの JSONL ファイルを特定
3. 直近10件のメッセージを抽出
4. フォーマットしたテキストを stdout に出力 → Claude のコンテキストに自動注入

hook は `"matcher": "compact"` が設定されているため、compact 時のみ発火します（通常のセッション開始時には発火しません）。

```
/compact 実行
  ↓
Claude Code が会話を圧縮（デフォルト動作）
  ↓
SessionStart hook 発火（matcher: "compact"）
  ↓
cc-search-plugin が JSONL から直近メッセージを読み取り
  ↓
プレーンテキストを stdout に出力
  ↓
Claude のコンテキストに追加（デフォルト compact の要約 + 生メッセージ）
```

### 手動検索（skill）

`/history-recall` スキルを呼び出すと、Claude が CLI コマンドを使って過去の会話を検索します:

- 「前回の会話を呼び出して」 → `recent --offset 1` で前回セッションを取得
- 「認証について前に話したよね」 → `search "認証"` でキーワード検索
- 「どのプロジェクトがある？」 → `list-projects` でプロジェクト一覧

### データソース

すべてのデータは Claude Code のローカル JSONL ファイル（`~/.claude/projects/`）から直接読み取ります。外部サービスやデータベースは不要です。

## CLI リファレンス

```
cc-search search <query> [--limit N] [--project <filter>]
cc-search recent [--sessions N] [--messages N] [--offset N] [--project <filter>]
cc-search list-projects
cc-search session-detail <projectId> <sessionId>
cc-search inject-context [--count N]
```

| コマンド | 説明 |
|---|---|
| `search` | キーワードで会話を検索します。前後のコンテキスト付きで結果を返します |
| `recent` | 直近のセッションを取得します。`--offset 1` で現在のセッションをスキップします |
| `list-projects` | Claude Code の全プロジェクト一覧を返します |
| `session-detail` | 指定セッションの全メッセージ履歴を返します |
| `inject-context` | stdin から hook 入力を読み、コンテキストサマリーを stdout に出力します。SessionStart hook から呼ばれます |

### フラグ一覧

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--limit` | 20 | 検索結果の最大件数 |
| `--sessions` | 1 | 取得するセッション数 |
| `--messages` | 20 | セッションあたりのメッセージ数 |
| `--offset` | 0 | スキップするセッション数（`1` で現在のセッションをスキップ） |
| `--project` | ― | プロジェクト ID でフィルタ |
| `--count` | 10 | コンテキスト注入時のメッセージ数 |

## ソースからビルド

```bash
git clone https://github.com/nogataka/cc-search-plugin.git
cd cc-search-plugin
npm install
npm run build
```

## ライセンス

MIT
