"""Independent acceptance check against the supplied official XLSX files; log counts only."""
import collections
import datetime
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import unicodedata
import zipfile

import openpyxl

ROOT = Path(__file__).resolve().parents[1]


def normalized(value):
    return "".join(unicodedata.normalize("NFKC", str(value or "")).split())


def filing_date(value):
    m = re.fullmatch(r"(昭和|平成|令和)(元|\d+)年(\d+)月(\d+)日", normalized(value))
    era, year, month, day = m.groups()
    year = {"昭和": 1925, "平成": 1988, "令和": 2018}[era] + (1 if year == "元" else int(year))
    return datetime.date(year, int(month), int(day)).strftime("%Y/%m/%d")


def verify(archive, name, meta):
    raw = (ROOT / meta["file"]).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == meta["checksum"]
    data = json.loads(raw)
    expected = collections.Counter()
    institutions = set()
    wb = openpyxl.load_workbook(io.BytesIO(archive.read(name)), read_only=True)
    rows = wb.active.values
    for row in rows:
        if "医療機関番号" in row:
            columns = {normalized(v): i for i, v in enumerate(row)}
            break
    for row in rows:
        def cell(label):
            return str(row[columns[label]] or "").strip()
        if not any(row):
            continue
        code = cell("医療機関番号")
        assert cell("都道府県コード") == meta["prefectureCode"] and len(code) == 7
        institutions.add(code)
        if cell("受理届出名称"):
            note = "：".join(v for v in (cell("備考(見出し)"),cell("備考(データ)")) if v)
            expected[(code,cell("受理届出名称"),cell("受理記号"),cell("受理番号"),filing_date(cell("算定開始年月日")),note)] += 1
    wb.close()
    actual = collections.Counter((c["medicalInstitutionNumber"], f["acceptedName"], f["acceptedCode"],
                                  f["acceptedNumber"], f["startDate"], f["remarks"])
                                 for c in data["recordsByClinic"] for f in c["facilities"])
    assert institutions == {c["medicalInstitutionNumber"] for c in data["recordsByClinic"]}
    assert actual == expected, "Official source/dataset multiset mismatch"
    print("PASS",meta["prefectureCode"],len(institutions),actual.total(),flush=True)


if __name__ == "__main__":
    manifest = json.loads((ROOT / "assets/data/manifest.json").read_bytes())
    with zipfile.ZipFile(sys.argv[1]) as archive:
        for name in archive.namelist():
            if name.endswith(".xlsx"):
                pref = Path(name).name[:2]
                verify(archive, name, next(m for m in manifest["datasets"] if m.get("active") and m["prefectureCode"] == pref))
