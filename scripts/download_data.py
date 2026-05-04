"""Download all raw data: martj42 matches, Elo ratings, EA FC 25 player CSV."""
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from wc2026.config import DATA_RAW
from wc2026.data.elo import fetch_elo_ratings
from wc2026.data.goalscorers import download_raw as download_goalscorers, load_goalscorers
from wc2026.data.matches import download_raw, load_matches

SOFIFA_KAGGLE_DATASET = "aniss7/fifa-player-data-from-sofifa-2025-06-03"
SOFIFA_DEST = DATA_RAW / "sofifa_players.csv"


def download_sofifa() -> None:
    if SOFIFA_DEST.exists():
        print(f"  ✓ sofifa CSV already present at {SOFIFA_DEST}")
        return
    try:
        import kagglehub
    except ImportError:
        print("  ⚠ kagglehub not installed; install with: pip install kagglehub")
        return
    try:
        path = Path(kagglehub.dataset_download(SOFIFA_KAGGLE_DATASET))
    except Exception as e:
        print(f"  ⚠ kagglehub download failed: {e}")
        return
    csv = next(path.glob("*.csv"), None)
    if csv is None:
        print(f"  ⚠ no CSV found in downloaded archive at {path}")
        return
    shutil.copy(csv, SOFIFA_DEST)
    print(f"  ✓ sofifa players CSV at {SOFIFA_DEST}")


def main() -> None:
    print("Downloading martj42 international results...")
    download_raw()
    df = load_matches(refresh=True)
    print(f"  ✓ {len(df):,} matches, range {df['date'].min().date()} → {df['date'].max().date()}")

    print("Downloading martj42 goalscorers...")
    download_goalscorers()
    gs = load_goalscorers(refresh=True)
    print(f"  ✓ {len(gs):,} goal records, range {gs['date'].min().date()} → {gs['date'].max().date()}")

    print("Fetching Elo ratings...")
    try:
        elo = fetch_elo_ratings(refresh=True)
        print(f"  ✓ {len(elo)} teams in Elo snapshot")
    except Exception as e:
        print(f"  ⚠ Elo fetch failed ({e})")

    print("Fetching EA FC 25 player data (Kaggle public dataset)...")
    download_sofifa()


if __name__ == "__main__":
    main()
