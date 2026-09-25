#!/usr/bin/env python3
"""Транскрибирует записи собесов из inbox/ через Deepgram, параллельно.

Для каждой записи создаёт inbox/transcripts/<имя>/:
  deepgram.json   — сырой ответ API (кэш: повторный запуск не платит повторно)
  transcript.md   — все реплики с таймкодами и метками спикеров
  interviewer.md  — только реплики интервьюера(ов), без моего голоса
  me.json         — какой спикер «я» (автоугадывание или --me)

Примеры:
  python3 scripts/transcribe.py                    # все новые записи из inbox/
  python3 scripts/transcribe.py inbox/a.mp4 -j 8   # конкретные файлы, 8 потоков
  python3 scripts/transcribe.py inbox/a.mp4 --me 1 # «я» — спикер 1 (из кэша, без запроса к API)
  python3 scripts/transcribe.py --multichannel     # я и собеседники на разных дорожках
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "inbox"
OUT = INBOX / "transcripts"

MEDIA_EXT = {
    ".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v",
    ".mp3", ".m4a", ".wav", ".ogg", ".opus", ".flac", ".aac", ".wma",
}

API_URL = "https://api.deepgram.com/v1/listen"
PARAMS = {
    "model": "nova-3",
    "language": "ru",
    "diarize": "true",
    "utterances": "true",
    "smart_format": "true",
    "punctuate": "true",
}
# Подсказки модели, чтобы англоязычные термины писались латиницей и правильно.
KEYTERMS = [
    "machine learning", "gradient boosting", "XGBoost", "LightGBM", "CatBoost",
    "random forest", "logistic regression", "overfitting", "cross-validation",
    "ROC-AUC", "precision", "recall", "F1", "loss", "cross-entropy",
    "embedding", "transformer", "attention", "fine-tuning", "LLM", "RAG",
    "PyTorch", "pandas", "SQL", "A/B test", "p-value", "bias-variance",
    "L1", "L2", "dropout", "batch normalization", "backpropagation",
    "SFT", "RLHF", "DPO", "PEFT", "LoRA", "fine-tune", "KV cache", "grouped query attention",
    "tokenizer", "BERT", "retriever", "reranker", "chunk", "vLLM", "Hugging Face", "temperature",
]


def fmt_ts(seconds: float) -> str:
    s = int(seconds)
    h, m, s = s // 3600, s % 3600 // 60, s % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def find_media(paths: list[str]) -> list[Path]:
    if paths:
        files = [Path(p).resolve() for p in paths]
        missing = [f for f in files if not f.is_file()]
        if missing:
            sys.exit(f"Нет таких файлов: {', '.join(map(str, missing))}")
        return files
    return sorted(p for p in INBOX.iterdir() if p.is_file() and p.suffix.lower() in MEDIA_EXT)


def extract_audio(src: Path, dst: Path, multichannel: bool) -> None:
    """Выкидывает видео, сжимает звук в opus — чтобы не заливать в API гигабайты."""
    channels = ["-ac", "2", "-b:a", "48k"] if multichannel else ["-ac", "1", "-b:a", "32k"]
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vn",
         *channels, "-ar", "16000", "-c:a", "libopus", str(dst)],
        check=True,
    )


def call_deepgram(audio: Path, api_key: str, multichannel: bool) -> dict:
    params = list(PARAMS.items()) + [("keyterm", t) for t in KEYTERMS]
    if multichannel:
        params.append(("multichannel", "true"))
    headers = {"Authorization": f"Token {api_key}", "Content-Type": "audio/ogg"}

    for attempt in range(4):
        with audio.open("rb") as f:
            r = requests.post(API_URL, params=params, headers=headers, data=f, timeout=(30, 1800))
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(5 * 2 ** attempt)
            continue
        if not r.ok:
            raise RuntimeError(f"Deepgram {r.status_code}: {r.text[:500]}")
        return r.json()
    raise RuntimeError(f"Deepgram не ответил после ретраев: {r.status_code} {r.text[:300]}")


def build_turns(resp: dict, multichannel: bool) -> list[dict]:
    """Склеивает подряд идущие реплики одного спикера в один «ход»."""
    turns: list[dict] = []
    for u in resp["results"].get("utterances", []):
        speaker = u.get("channel", 0) if multichannel else u.get("speaker", 0)
        text = u["transcript"].strip()
        if not text:
            continue
        if turns and turns[-1]["speaker"] == speaker:
            turns[-1]["text"] += " " + text
            turns[-1]["end"] = u["end"]
        else:
            turns.append({"speaker": speaker, "start": u["start"], "end": u["end"], "text": text})
    return turns


def speaker_stats(turns: list[dict]) -> dict[int, dict]:
    stats: dict[int, dict] = {}
    for t in turns:
        s = stats.setdefault(t["speaker"], {"talk": 0.0, "turns": 0, "questions": 0})
        s["talk"] += t["end"] - t["start"]
        s["turns"] += 1
        s["questions"] += t["text"].count("?")
    return stats


def write_outputs(out_dir: Path, src_name: str, turns: list[dict], me: set[int], label: str) -> dict:
    stats = speaker_stats(turns)
    # По умолчанию «я» — тот, кто говорит дольше всех: кандидат обычно отвечает развёрнуто.
    if not me and stats:
        me = {max(stats, key=lambda k: stats[k]["talk"])}

    def name(sp: int) -> str:
        return f"{label} {sp}" + (" (я)" if sp in me else "")

    header = [f"# {src_name}", ""]
    for sp, s in sorted(stats.items()):
        header.append(
            f"- **{name(sp)}** — {fmt_ts(s['talk'])} речи, {s['turns']} реплик, {s['questions']} вопр. знаков"
        )
    header.append("")

    full = header + [f"**[{fmt_ts(t['start'])}] {name(t['speaker'])}:** {t['text']}\n" for t in turns]
    (out_dir / "transcript.md").write_text("\n".join(full), encoding="utf-8")

    others = [t for t in turns if t["speaker"] not in me]
    interviewer = header + [f"**[{fmt_ts(t['start'])}] {name(t['speaker'])}:** {t['text']}\n" for t in others]
    (out_dir / "interviewer.md").write_text("\n".join(interviewer), encoding="utf-8")

    return {"stats": stats, "me": sorted(me)}


def process(src: Path, api_key: str, args) -> str:
    out_dir = OUT / src.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_path = out_dir / "deepgram.json"

    t0 = time.time()
    if raw_path.exists() and not args.force:
        resp = json.loads(raw_path.read_text(encoding="utf-8"))
        source = "кэш"
    else:
        with tempfile.TemporaryDirectory() as tmp:
            audio = Path(tmp) / "audio.ogg"
            extract_audio(src, audio, args.multichannel)
            resp = call_deepgram(audio, api_key, args.multichannel)
        raw_path.write_text(json.dumps(resp, ensure_ascii=False, indent=1), encoding="utf-8")
        source = "Deepgram"

    # Кто «я» — запоминаем в me.json, чтобы ручная правка не терялась при перезапусках.
    me_path = out_dir / "me.json"
    if args.me:
        me_path.write_text(json.dumps(args.me), encoding="utf-8")
    me = set(args.me or (json.loads(me_path.read_text()) if me_path.exists() else []))

    turns = build_turns(resp, args.multichannel)
    label = "Канал" if args.multichannel else "Спикер"
    info = write_outputs(out_dir, src.name, turns, me, label)
    if not me:
        me_path.write_text(json.dumps(info["me"]), encoding="utf-8")

    duration = resp.get("metadata", {}).get("duration", 0)
    lines = [f"✓ {src.name} — {fmt_ts(duration)} записи, {source}, {time.time() - t0:.0f}с → {out_dir.relative_to(ROOT)}"]
    for sp, s in sorted(info["stats"].items()):
        mark = "  ← я" if sp in info["me"] else ""
        lines.append(f"    {label} {sp}: {fmt_ts(s['talk'])} речи, {s['turns']} реплик, {s['questions']} «?»{mark}")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*", help="файлы записей (по умолчанию — все из inbox/)")
    ap.add_argument("-j", "--jobs", type=int, default=4, help="сколько файлов обрабатывать параллельно")
    ap.add_argument("--me", type=int, nargs="+", help="номер(а) моего спикера/канала; запоминается в me.json")
    ap.add_argument("--multichannel", action="store_true", help="я и собеседники записаны на разных дорожках")
    ap.add_argument("--force", action="store_true", help="заново отправить в API, даже если есть кэш")
    ap.add_argument("--new-only", action="store_true", help="пропустить записи, у которых уже есть транскрипт")
    args = ap.parse_args()

    api_key = os.environ.get("DEEPGRAM_API_KEY")
    if not api_key:
        sys.exit("Нет DEEPGRAM_API_KEY в окружении. Запусти в новом терминале или сделай `source ~/.zshrc`.")

    files = find_media(args.files)
    if args.new_only:
        files = [f for f in files if not (OUT / f.stem / "deepgram.json").exists()]
    if not files:
        sys.exit("Нечего обрабатывать: в inbox/ нет новых записей.")

    print(f"Обрабатываю {len(files)} файл(ов), до {args.jobs} параллельно…", flush=True)
    failed = 0
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {pool.submit(process, f, api_key, args): f for f in files}
        for fut in as_completed(futures):
            try:
                print(fut.result(), flush=True)
            except Exception as e:
                failed += 1
                print(f"✗ {futures[fut].name}: {e}", file=sys.stderr, flush=True)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
