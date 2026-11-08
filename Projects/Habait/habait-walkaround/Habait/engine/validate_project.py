#!/usr/bin/env python
"""validate_project.py <project.json> [--schema schema/project.schema.json] [--check-files] [--json]

Validates a Habait engine project.json against schema/project.schema.json (JSON Schema
draft 2020-12 subset) and runs the semantic checks the schema cannot express.

Hand-rolled validator (the venv has no `jsonschema`): supports type, required, properties,
additionalProperties, enum, const, items, minItems, maxItems, uniqueItems, minimum, maximum,
exclusiveMinimum, exclusiveMaximum, minLength, maxLength, pattern, $ref (#/$defs/... and #/...),
allOf/anyOf/oneOf. `default`, `description`, `format` are ignored. If `jsonschema` is installed it is
used instead (same result expected).

Exit codes: 0 clean (warnings allowed), 1 FAIL, 2 usage / parse error.
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SCHEMA = os.path.join(HERE, "schema", "project.schema.json")

TYPES = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "integer": lambda v: (isinstance(v, int) and not isinstance(v, bool)) or (isinstance(v, float) and v.is_integer()),
    "boolean": lambda v: isinstance(v, bool),
    "null": lambda v: v is None,
}


def _resolve_ref(root, ref):
    if not ref.startswith("#/"):
        raise ValueError(f"unsupported $ref {ref!r} (only local refs)")
    node = root
    for part in ref[2:].split("/"):
        part = part.replace("~1", "/").replace("~0", "~")
        node = node[part]
    return node


def _hashable(v):
    return json.dumps(v, sort_keys=True, ensure_ascii=False)


def validate_node(root, schema, value, path, errors):
    if "$ref" in schema:
        validate_node(root, _resolve_ref(root, schema["$ref"]), value, path, errors)
    t = schema.get("type")
    if t is not None:
        types = t if isinstance(t, list) else [t]
        if not any(TYPES[x](value) for x in types):
            errors.append(f"{path}: expected {'/'.join(types)}, got {type(value).__name__}")
            return
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in enum {schema['enum']}")
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']!r}")
    for key in ("allOf", "anyOf", "oneOf"):
        if key in schema:
            results = []
            for sub in schema[key]:
                sub_err = []
                validate_node(root, sub, value, path, sub_err)
                results.append(not sub_err)
            ok = all(results) if key == "allOf" else (any(results) if key == "anyOf" else results.count(True) == 1)
            if not ok:
                errors.append(f"{path}: fails {key}")
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: shorter than {schema['minLength']}")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.append(f"{path}: longer than {schema['maxLength']}")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: {value!r} does not match /{schema['pattern']}/")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value} < minimum {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {value} > maximum {schema['maximum']}")
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            errors.append(f"{path}: {value} <= exclusiveMinimum {schema['exclusiveMinimum']}")
        if "exclusiveMaximum" in schema and value >= schema["exclusiveMaximum"]:
            errors.append(f"{path}: {value} >= exclusiveMaximum {schema['exclusiveMaximum']}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: fewer than {schema['minItems']} items")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: more than {schema['maxItems']} items")
        if schema.get("uniqueItems"):
            seen = set()
            for i, v in enumerate(value):
                h = _hashable(v)
                if h in seen:
                    errors.append(f"{path}[{i}]: duplicate item {v!r}")
                seen.add(h)
        if "items" in schema:
            for i, v in enumerate(value):
                validate_node(root, schema["items"], v, f"{path}[{i}]", errors)
    if isinstance(value, dict):
        props = schema.get("properties", {})
        for req in schema.get("required", []):
            if req not in value:
                errors.append(f"{path}: missing required '{req}'")
        for k, v in value.items():
            if k in props:
                validate_node(root, props[k], v, f"{path}.{k}", errors)
            elif schema.get("additionalProperties") is False:
                errors.append(f"{path}: unexpected property '{k}'")
            elif isinstance(schema.get("additionalProperties"), dict):
                validate_node(root, schema["additionalProperties"], v, f"{path}.{k}", errors)


def schema_validate(schema, doc):
    errors = []
    try:
        import jsonschema  # type: ignore

        validator = jsonschema.Draft202012Validator(schema)
        for e in sorted(validator.iter_errors(doc), key=lambda e: list(e.path)):
            errors.append("$." + ".".join(str(p) for p in e.path) + ": " + e.message)
        return errors
    except ImportError:
        pass
    validate_node(schema, schema, doc, "$", errors)
    return errors


def semantic_checks(doc, project_dir, check_files):
    """Rules the schema cannot express. Returns (fails, warnings)."""
    fails, warns = [], []
    units = doc.get("units") or []
    ids = [u.get("id") for u in units]
    for i, uid in enumerate(ids):
        if ids.count(uid) > 1:
            fails.append(f"$.units[{i}]: duplicate unit id {uid!r}")
    floors_total = (doc.get("building") or {}).get("floors_total")
    for i, u in enumerate(units):
        files = u.get("files") or {}
        if not any(files.get(k) for k in ("plan_pdf", "plan_dwg", "plan_image", "ifc")):
            fails.append(f"$.units[{i}].files: needs one of plan_pdf / plan_dwg / plan_image / ifc")
        if isinstance(floors_total, int) and isinstance(u.get("floor"), int) and u["floor"] > floors_total:
            fails.append(f"$.units[{i}].floor {u['floor']} > building.floors_total {floors_total}")
        if u.get("status") == "available" and u.get("price_ils") is None:
            warns.append(f"$.units[{i}]: available with no price_ils")
    legal = doc.get("legal") or {}
    if legal.get("rights_state") == "unrecorded":
        warns.append("$.legal.rights_state is 'unrecorded': the gate will block every public output")
    if legal.get("publish_allowed") and not legal.get("consent_from_developer"):
        warns.append("$.legal: publish_allowed without consent_from_developer")
    site = doc.get("site") or {}
    if "origin" not in site and "plot" not in site:
        warns.append("$.site: neither origin nor plot; the site stage cannot place the building")
    if check_files:
        for rel in _iter_paths(doc):
            p = rel if os.path.isabs(rel) else os.path.join(project_dir, rel)
            if not os.path.exists(p):
                warns.append(f"file not found: {rel}")
    return fails, warns


def _iter_paths(doc):
    """Yield every relative path field in the document (keys named file/*_pdf/*_dwg/... )."""
    keys = {"file", "plan_pdf", "plan_dwg", "plan_image", "ifc", "plan_json", "intake_json", "logo",
            "material_board", "orthophoto", "cache_file", "polygon_file"}

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in keys and isinstance(v, str):
                    yield v
                else:
                    yield from walk(v)
        elif isinstance(node, list):
            for v in node:
                yield from walk(v)

    yield from walk(doc)


def validate_file(path, schema_path=DEFAULT_SCHEMA, check_files=False):
    with open(schema_path, encoding="utf-8") as f:
        schema = json.load(f)
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    errors = schema_validate(schema, doc)
    fails, warns = semantic_checks(doc, os.path.dirname(os.path.abspath(path)), check_files)
    return {"file": path, "schema_errors": errors, "fails": fails, "warnings": warns,
            "ok": not errors and not fails}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project_json", nargs="+")
    ap.add_argument("--schema", default=DEFAULT_SCHEMA)
    ap.add_argument("--check-files", action="store_true", help="warn on referenced files that do not exist")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args(argv)
    results = []
    rc = 0
    for p in args.project_json:
        try:
            r = validate_file(p, args.schema, args.check_files)
        except (OSError, ValueError, KeyError) as e:
            print(f"{p}: cannot read/parse: {e}", file=sys.stderr)
            return 2
        results.append(r)
        if not r["ok"]:
            rc = 1
        if not args.json:
            status = "OK" if r["ok"] else "FAIL"
            print(f"[{status}] {p}")
            for e in r["schema_errors"]:
                print(f"  schema: {e}")
            for e in r["fails"]:
                print(f"  fail:   {e}")
            for w in r["warnings"]:
                print(f"  warn:   {w}")
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=1))
    return rc


if __name__ == "__main__":
    sys.exit(main())
