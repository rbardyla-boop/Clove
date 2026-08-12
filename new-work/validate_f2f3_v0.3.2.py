#!/usr/bin/env python3
"""Deterministic pre-score validator for CP-CDTT v0.3.2 semantics."""

import json
import csv
import sys
from pathlib import Path

FAMILIES = {
    "MAPPING_TYPE_RELATION",
    "FORMAL_METROLOGY",
    "ASSUMPTION_REGIME",
    "MECHANISM_CAUSALITY",
    "INVARIANT_PARAMETER",
    "EMPIRICAL",
    "ONTOLOGICAL_IDENTITY",
    "FALSIFICATION",
    "PROVENANCE_NOVELTY",
}
ACTIVITY = {"CLAIMED", "NEGATED", "NOT_CLAIMED"}
STATUS = {"PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"}
MODES = {"M", "C"}


def check(case):
    errors = []
    activity = case["claim_activity"]
    rows = case["rows"]
    if activity not in ACTIVITY:
        errors.append("invalid claim_activity")
    if len({row["obligation_id"] for row in rows}) != len(rows):
        errors.append("duplicate obligation_id")
    if activity == "NOT_CLAIMED":
        if rows:
            errors.append("inactive axis has obligation rows")
    elif not rows:
        errors.append("active axis has zero obligation rows")

    for row in rows:
        if row.get("requirement_mode") not in MODES:
            errors.append("invalid requirement_mode")
        if row.get("status") not in STATUS:
            errors.append("invalid status")
        family = row.get("failure_family", "")
        if family and family not in FAMILIES:
            errors.append("non-canonical failure family")
        if row.get("status") == "FAIL" and not family:
            errors.append("FAIL without failure family")
        if row.get("status") == "NOT_APPLICABLE":
            if row.get("requirement_mode") != "C":
                errors.append("N/A on mandatory obligation")
            if not row.get("applicability_reason", "").strip():
                errors.append("N/A without applicability reason")

    if errors:
        return "SCHEMA_ERROR", errors
    if activity == "NOT_CLAIMED":
        return "NOT_CLAIMED", []
    if any(row["status"] == "FAIL" for row in rows):
        return "FAILED", []
    if any(row["status"] == "UNKNOWN" for row in rows):
        return "BLOCKED", []
    return "SUPPORTED", []


def main(path):
    payload = json.loads(Path(path).read_text())
    failures = []
    for case in payload["cases"]:
        schema, errors = check(case)
        expected_schema = case["expected_schema"]
        expected = case.get("expected_axis")
        actual = "SCHEMA_ERROR" if schema == "SCHEMA_ERROR" else schema
        if (expected_schema == "SCHEMA_ERROR" and schema != "SCHEMA_ERROR") or (
            expected_schema == "VALID" and schema == "SCHEMA_ERROR"
        ) or (expected_schema == "VALID" and actual != expected):
            failures.append((case["id"], actual, expected_schema, expected, errors))
    print(f"cases={len(payload['cases'])} passed={len(payload['cases']) - len(failures)} failed={len(failures)}")
    for failure in failures:
        print("FAIL", failure)
    return 1 if failures else 0


def validate_response(response_path, summary_path, activity_path, template_path):
    def read_csv(path):
        with open(path, newline="") as handle:
            return list(csv.DictReader(handle))

    activity_rows = read_csv(activity_path)
    template_rows = read_csv(template_path)
    response_rows = read_csv(response_path)
    summary_rows = read_csv(summary_path)
    activity = {(row["blind_id"], row["axis"]): row["claim_activity"] for row in activity_rows}
    required = {(row["blind_id"], row["axis"], row["obligation_id"]): row for row in template_rows}
    response = {(row["blind_id"], row["axis"], row["obligation_id"]): row for row in response_rows}
    active = {(blind_id, axis) for (blind_id, axis), state in activity.items() if state != "NOT_CLAIMED"}
    errors = []

    if len(response) != len(response_rows):
        errors.append("duplicate response obligation key")
    if set(response) != set(required):
        errors.append("response obligation keys do not exactly match the canonical template")
    summary = {(row["blind_id"], row["axis"]): row for row in summary_rows}
    if len(summary) != len(summary_rows):
        errors.append("duplicate axis summary key")
    if set(summary) != active:
        errors.append("axis summary activity does not exactly match canonical claim activity")

    for key, template in required.items():
        row = response.get(key)
        if row is None:
            continue
        pair = key[:2]
        if activity.get(pair) == "NOT_CLAIMED":
            errors.append(f"inactive axis has response rows: {pair}")
        if row["requirement_mode"] != template["requirement_mode"]:
            errors.append(f"requirement mode changed: {key}")
        if row["evaluator_status"] not in STATUS:
            errors.append(f"invalid status: {key}")
        family = row["failure_family_if_blocking"]
        if family and any(value not in FAMILIES for value in family.split(";")):
            errors.append(f"non-canonical failure family: {key}")
        if row["evaluator_status"] == "FAIL" and not family:
            errors.append(f"FAIL without failure family: {key}")
        if row["evaluator_status"] == "NOT_APPLICABLE":
            if row["requirement_mode"] != "C" or not row["evaluator_rationale"].strip():
                errors.append(f"invalid N/A explanation: {key}")

    for pair, row in summary.items():
        if pair not in active:
            errors.append(f"summary for inactive axis: {pair}")
            continue
        disposition = row["axis_disposition"]
        if disposition not in {"SUPPORTED", "FAILED", "BLOCKED", "NOT_CLAIMED"}:
            errors.append(f"invalid axis disposition: {pair}")
            continue
        statuses = [value["evaluator_status"] for key, value in response.items() if key[:2] == pair]
        if disposition == "NOT_CLAIMED":
            errors.append(f"active axis marked NOT_CLAIMED: {pair}")
        if "FAIL" in statuses and disposition != "FAILED":
            errors.append(f"direct FAIL not reflected as FAILED: {pair}")
        if "FAIL" not in statuses and "UNKNOWN" in statuses and disposition == "SUPPORTED":
            errors.append(f"UNKNOWN promoted to SUPPORTED: {pair}")

    print(f"response={response_path} rows={len(response_rows)} summary_rows={len(summary_rows)} errors={len(errors)}")
    for error in errors:
        print("FAIL", error)
    return 1 if errors else 0


if __name__ == "__main__":
    if sys.argv[1] == "--response":
        raise SystemExit(validate_response(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]))
    raise SystemExit(main(sys.argv[1]))
