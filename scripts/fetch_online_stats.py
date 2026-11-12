#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""每小时抓取国服 balancer 状态接口并归档为分时数据。

用法：
    python scripts/fetch_online_stats.py              # 抓一次并落盘
    python scripts/fetch_online_stats.py --dry-run    # 只打印快照，不写文件
    python scripts/fetch_online_stats.py --date 2026-11-12 --hour 20  # 手动补录

数据目录（相对仓库根，独立文件夹 + 每天一个子文件夹 + 每小时一个文件）：
    data/online/
      ├── index.json                       日期索引 + 每日汇总 + 可用小时列表
      ├── latest.json                      最近一次快照
      └── 2026-11-12/                      ← 一天一个子文件夹
            ├── 00.json                    ← 每小时一个独立文件
            ├── 01.json
            └── ... 23.json

每个 HH.json 就是该小时的一次完整快照（含 total 与 nodes 数组），不与其他小时共享文件。
只依赖 Python 标准库，GitHub Actions 无需安装任何包。
时间统一按 Asia/Shanghai（UTC+8）归档，快照同时保留 UTC 与本地时间。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    LOCAL_TZ = ZoneInfo("Asia/Shanghai")
except Exception:  # pragma: no cover - 老版本 Python 兜底
    LOCAL_TZ = timezone(timedelta(hours=8))

API_URL = "https://balancer.3dtank.com/balancer"
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "online"
UA = "KostoHub-OnlineStats/1.0 (+https://github.com/Kosto179cn/Kosto179cn.github.io)"
TIMEZONE_NAME = "Asia/Shanghai"
DAY_DIR_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HOUR_FILE_RE = re.compile(r"^([01]\d|2[0-3])\.json$")


def fetch_snapshot(api_url: str, retries: int = 3, timeout: int = 15) -> dict:
    """抓取并规范化接口返回；失败重试，全失败则抛异常（让 Action 标红）。"""
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(api_url, headers={
                "User-Agent": UA,
                "Accept": "application/json",
                "Cache-Control": "no-cache",
            })
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            return normalize(raw)
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as e:
            last_err = e
            if attempt < retries:
                time.sleep(2 * attempt)
    raise RuntimeError(f"接口请求失败（重试 {retries} 次）: {last_err}")


def normalize(raw: dict) -> dict:
    """把官方 nodes 对象压成可长期存档的稳定结构。"""
    if not isinstance(raw, dict) or "nodes" not in raw:
        raise ValueError("返回结构缺少 nodes 字段")

    nodes = []
    total = {"online": 0, "inbattles": 0, "my_4399_com": 0}
    for node_id, node in (raw.get("nodes") or {}).items():
        if not isinstance(node, dict):
            continue
        endpoint = node.get("endpoint") or {}
        partners = node.get("partners") or {}
        online = int(node.get("online") or 0)
        inbattles = int(node.get("inbattles") or 0)
        p4399 = int(partners.get("my_4399_com") or 0)
        nodes.append({
            "id": node_id,
            "host": endpoint.get("host") or "",
            "status": endpoint.get("status") or "UNKNOWN",
            "online": online,
            "inbattles": inbattles,
            "my_4399_com": p4399,
        })
        total["online"] += online
        total["inbattles"] += inbattles
        total["my_4399_com"] += p4399

    nodes.sort(key=lambda n: n["id"])
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(LOCAL_TZ)
    return {
        "ts": now_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "ts_local": now_local.replace(microsecond=0).isoformat(),
        "date": now_local.strftime("%Y-%m-%d"),
        "hour": now_local.hour,
        "timezone": TIMEZONE_NAME,
        "serverNamespace": raw.get("serverNamespace") or "CN",
        "serverVersion": str(raw.get("serverVersion") or ""),
        "total": total,
        "nodes": nodes,
    }


def hour_path(date_str: str, hour: int) -> Path:
    """data/online/<YYYY-MM-DD>/<HH>.json —— 一天一个子文件夹，每小时一个文件。"""
    return DATA_DIR / date_str / f"{hour:02d}.json"


def load_json(path: Path, default):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def read_day_hours(day_dir: Path) -> dict:
    """读取某个日期子文件夹下的全部 HH.json，返回 {'00': snap, ...}。"""
    hours = {}
    for path in sorted(day_dir.glob("*.json")):
        m = HOUR_FILE_RE.match(path.name)
        if not m:
            continue
        snap = load_json(path, {})
        if isinstance(snap, dict) and snap.get("total"):
            hours[m.group(1)] = snap
    return hours


def day_summary(date_str: str, hours: dict) -> dict:
    keys = sorted(hours)
    onlines = [int(hours[k]["total"].get("online", 0)) for k in keys]
    battles = [int(hours[k]["total"].get("inbattles", 0)) for k in keys]
    if not onlines:
        return {"date": date_str, "samples": 0, "hours": []}
    peak = max(onlines)
    return {
        "date": date_str,
        "samples": len(onlines),
        "hours": [int(k) for k in keys],          # 页面据此并行拉取小时文件
        "peak_online": peak,
        "peak_hour": int(keys[onlines.index(peak)]),
        "low_online": min(onlines),
        "avg_online": round(sum(onlines) / len(onlines), 1),
        "avg_inbattles": round(sum(battles) / len(battles), 1),
        "dir": f"data/online/{date_str}",
    }


def rebuild_index() -> dict:
    """扫描所有日期子文件夹，重建索引（页面据此做日期选择与小时文件定位）。"""
    summaries = []
    for day_dir in sorted(DATA_DIR.iterdir()):
        if not day_dir.is_dir() or not DAY_DIR_RE.match(day_dir.name):
            continue
        hours = read_day_hours(day_dir)
        if not hours:
            continue
        summaries.append(day_summary(day_dir.name, hours))
    summaries.sort(key=lambda x: x["date"])
    index = {
        "timezone": TIMEZONE_NAME,
        "source": API_URL,
        "granularity": "hourly",
        "layout": "data/online/<YYYY-MM-DD>/<HH>.json",
        "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "days": summaries,
        "latestDate": summaries[-1]["date"] if summaries else None,
    }
    write_json(DATA_DIR / "index.json", index)
    return index


def main() -> int:
    global DATA_DIR
    parser = argparse.ArgumentParser(description="采集国服每时段在线人数")
    parser.add_argument("--api", default=os.environ.get("ONLINE_STATS_API", API_URL), help="状态接口地址")
    parser.add_argument("--out", default=str(DATA_DIR), help="数据输出目录")
    parser.add_argument("--dry-run", action="store_true", help="只打印快照，不写文件")
    parser.add_argument("--date", help="手动补录：指定本地日期 YYYY-MM-DD")
    parser.add_argument("--hour", type=int, help="手动补录：指定本地小时 0-23")
    args = parser.parse_args()

    DATA_DIR = Path(args.out).resolve()

    snap = fetch_snapshot(args.api)
    if args.date:
        if not DAY_DIR_RE.match(args.date):
            print("--date 必须是 YYYY-MM-DD", file=sys.stderr)
            return 2
        snap["date"] = args.date
    if args.hour is not None:
        if not 0 <= args.hour <= 23:
            print("--hour 必须在 0-23 之间", file=sys.stderr)
            return 2
        snap["hour"] = args.hour

    print(json.dumps(snap, ensure_ascii=False, indent=2))
    if args.dry_run:
        return 0

    hpath = hour_path(snap["date"], snap["hour"])
    previous = load_json(hpath, None)
    if (isinstance(previous, dict)
            and previous.get("total") == snap["total"]
            and previous.get("nodes") == snap["nodes"]):
        print(f"[skip] {snap['date']}/{snap['hour']:02d}.json 数据未变化，跳过写入")
        return 0

    write_json(hpath, snap)
    # 手动补录历史小时时不要让 latest.json 倒退成旧数据
    prev_latest = load_json(DATA_DIR / "latest.json", None)
    if (not isinstance(prev_latest, dict)
            or (snap["date"], snap["hour"]) >= (prev_latest.get("date", ""), prev_latest.get("hour", -1))):
        write_json(DATA_DIR / "latest.json", snap)
    index = rebuild_index()
    rel = hpath.relative_to(ROOT) if hpath.is_relative_to(ROOT) else hpath
    print(f"[ok] 已写入 {rel} · 索引共 {len(index['days'])} 天")
    return 0


if __name__ == "__main__":
    sys.exit(main())
