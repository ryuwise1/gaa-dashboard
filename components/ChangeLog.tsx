"use client";

import { useEffect, useState } from "react";

interface CommitRow {
  sha: string;
  html_url: string;
  commit: { message: string; author: { date: string; name: string } };
}

/**
 * 보드 변경 로그 (팀 전용) — GitHub main 커밋을 그대로 보여준다.
 * 여러 기기·계정에서 번갈아 작업하므로, "다른 쪽에서 뭘 바꿨나"를
 * 보드 안에서 바로 확인하고 팔로업하기 위한 창. 커밋이 곧 로그라 유지 비용이 없다.
 * (api.github.com은 공개 리포 CORS 허용 — 서버 경유 불필요, 비로그인 시간당 60회 제한이면 충분)
 */
export default function ChangeLog() {
  const [rows, setRows] = useState<CommitRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("https://api.github.com/repos/ryuwise1/gaa-dashboard/commits?per_page=10")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => (Array.isArray(d) ? setRows(d) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null; // 레이트리밋 등 — 조용히 숨긴다 (핵심 기능 아님)

  const stamp = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });

  return (
    <details className="chlog">
      <summary>
        보드 변경 로그
        <span className="chlog-sub">GitHub main 커밋 — 다른 기기·계정에서 작업한 내용도 여기서 확인</span>
      </summary>
      {!rows && <p className="chlog-empty">불러오는 중…</p>}
      {rows && (
        <ul>
          {rows.map((c) => (
            <li key={c.sha}>
              <span className="d num">{stamp(c.commit.author.date)}</span>
              <a href={c.html_url} target="_blank" rel="noreferrer" title={c.commit.message}>
                {c.commit.message.split("\n")[0]}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="chlog-foot">
        인수인계 규칙·작업 로그 원본: 리포 <span className="mono">CLAUDE.md</span> ·
        상세 리서치: <span className="mono">research/</span>
      </p>
    </details>
  );
}
