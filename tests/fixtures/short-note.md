# pg_stat_statements で重いクエリを特定する

Postgres の運用で「最近なんとなく遅い」と感じたとき、最初に当たるべきは `pg_stat_statements` 拡張。
Supabase ではデフォルトで有効化されているので、追加インストールは不要。

## 使い方の基本

```sql
SELECT
  substring(query, 1, 80) AS q,
  calls,
  round(total_exec_time::numeric, 1) AS total_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

`total_exec_time` で並べると「累積で時間を食っているクエリ」が出てくる。
1 回の遅さよりも、回数 × 平均時間で支配的になっているものを優先して直すのがコツ。

## 落とし穴

- `pg_stat_statements.reset()` を打つと統計が消えるので、観測前に他人と相談する
- パラメータ違いの同一クエリは正規化されてまとまるが、`SET` を含むクエリ等は別物扱いされる
- `mean_exec_time` だけ見ると「呼ばれていないだけの遅いクエリ」に騙されるので、`calls` も必ず併読

メモ: Supabase Dashboard の Reports → Query Performance も裏側でこのビューを使っているだけ。
SQL で直接叩けば自分の好きな閾値で並べ替えられる。
