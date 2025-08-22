# iira/app/ingest/parse_and_ingest_sops.py

import os
import json

DATA_DIR = "data/sops"


def parse_sops(filepath: str = None):
    sops = []

    def parse_file(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]

        if len(lines) < 2:
            return None

        title = lines[0]
        issue = lines[1]
        steps = []
        for line in lines[2:]:
            if "->" in line:
                description, script = map(str.strip, line.split("->", 1))
            else:
                description = line
                script = ""
            steps.append({"description": description, "script": script})

        return {
            "title": title,
            "issue": issue,
            "steps": steps
        }

    if filepath:
        sop = parse_file(filepath)
        if sop:
            sops.append(sop)
    else:
        for filename in os.listdir(DATA_DIR):
            if filename.endswith(".txt"):
                file_path = os.path.join(DATA_DIR, filename)
                sop = parse_file(file_path)
                if sop:
                    sops.append(sop)

    return sops