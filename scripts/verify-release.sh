#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "${repo_root}/Scarb.toml" || ! -f "${repo_root}/config/release.json" ]]; then
  echo "release verifier could not resolve the Veilpass repository" >&2
  exit 1
fi

for command_name in jq node npm scarb shasum snforge starkli; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "missing required command: ${command_name}" >&2
    exit 1
  fi
done

cd "${repo_root}"
jq empty config/mainnet.json config/release.json strk20.json

expected_scarb="$(jq -r '.toolchain.scarb' config/release.json)"
expected_foundry="$(jq -r '.toolchain.starknet_foundry' config/release.json)"
expected_next="$(jq -r '.toolchain.next' config/release.json)"
expected_starknet_js="$(jq -r '.toolchain.starknet_js' config/release.json)"
actual_scarb="$(scarb --version | awk 'NR == 1 {print $2}')"
actual_foundry="$(snforge --version | awk '{print $2}')"
actual_next="$(jq -r '.dependencies.next' web/package.json)"
actual_starknet_js="$(jq -r '.dependencies.starknet' web/package.json)"

for version_check in \
  "scarb:${actual_scarb}:${expected_scarb}" \
  "starknet_foundry:${actual_foundry}:${expected_foundry}" \
  "next:${actual_next}:${expected_next}" \
  "starknet_js:${actual_starknet_js}:${expected_starknet_js}"; do
  IFS=: read -r version_name actual_version expected_version <<<"${version_check}"
  if [[ "${actual_version}" != "${expected_version}" ]]; then
    echo "toolchain mismatch: ${version_name}" >&2
    echo "expected ${expected_version}" >&2
    echo "actual   ${actual_version}" >&2
    exit 1
  fi
done

while IFS=$'\t' read -r source_path expected_sha; do
  if [[ "${source_path}" == /* || "${source_path}" == *".."* || ! -f "${source_path}" ]]; then
    echo "invalid release source path: ${source_path}" >&2
    exit 1
  fi
  actual_sha="$(shasum -a 256 "${source_path}" | awk '{print $1}')"
  if [[ "${actual_sha}" != "${expected_sha}" ]]; then
    echo "source hash mismatch: ${source_path}" >&2
    echo "expected ${expected_sha}" >&2
    echo "actual   ${actual_sha}" >&2
    exit 1
  fi
done < <(jq -r '.sources | to_entries[] | [.key, .value] | @tsv' config/release.json)

scarb fmt --check
scarb build
snforge test

for artifact_name in sierra compiled; do
  artifact_path="$(jq -r --arg name "${artifact_name}" '.artifacts[$name].path' config/release.json)"
  expected_sha="$(jq -r --arg name "${artifact_name}" '.artifacts[$name].sha256' config/release.json)"

  if [[ "${artifact_path}" == /* || "${artifact_path}" == *".."* || ! -f "${artifact_path}" ]]; then
    echo "invalid release artifact path: ${artifact_path}" >&2
    exit 1
  fi

  actual_sha="$(shasum -a 256 "${artifact_path}" | awk '{print $1}')"
  if [[ "${actual_sha}" != "${expected_sha}" ]]; then
    echo "artifact mismatch: ${artifact_name}" >&2
    echo "expected sha256 ${expected_sha}" >&2
    echo "actual   sha256 ${actual_sha}" >&2
    exit 1
  fi
done

sierra_hash="$(jq -r '.artifacts.sierra.class_hash' config/release.json)"
compiled_poseidon_hash="$(jq -r '.artifacts.compiled.legacy_poseidon_class_hash' config/release.json)"
compiled_blake_hash="$(jq -r '.artifacts.compiled.mainnet_blake_class_hash' config/release.json)"
actual_sierra_hash="$(starkli class-hash "$(jq -r '.artifacts.sierra.path' config/release.json)")"
actual_compiled_poseidon_hash="$(starkli class-hash "$(jq -r '.artifacts.compiled.path' config/release.json)")"
actual_compiled_blake_hash="$(node --input-type=module -e '
  import fs from "node:fs";
  import { hash } from "./web/node_modules/starknet/dist/index.mjs";
  const casm = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  console.log(hash.computeCompiledClassHashBlake(casm));
' "$(jq -r '.artifacts.compiled.path' config/release.json)")"

if [[ "${actual_sierra_hash}" != "${sierra_hash}" || \
      "${actual_compiled_poseidon_hash}" != "${compiled_poseidon_hash}" || \
      "${actual_compiled_blake_hash}" != "${compiled_blake_hash}" ]]; then
  echo "artifact class hash mismatch" >&2
  echo "expected Sierra           ${sierra_hash}" >&2
  echo "actual   Sierra           ${actual_sierra_hash}" >&2
  echo "expected legacy Poseidon  ${compiled_poseidon_hash}" >&2
  echo "actual   legacy Poseidon  ${actual_compiled_poseidon_hash}" >&2
  echo "expected mainnet Blake    ${compiled_blake_hash}" >&2
  echo "actual   mainnet Blake    ${actual_compiled_blake_hash}" >&2
  exit 1
fi

jq -e --arg value "${sierra_hash}" '.expected_veilpass_class_hash == $value' config/mainnet.json >/dev/null
jq -e --arg value "${compiled_blake_hash}" '.expected_veilpass_compiled_class_hash == $value' config/mainnet.json >/dev/null
jq -e --arg value "${compiled_poseidon_hash}" '.legacy_poseidon_compiled_class_hash == $value' config/mainnet.json >/dev/null

npm --prefix web ci
npm --prefix web audit --omit=dev
npm --prefix web run typecheck
npm --prefix web run test:actions
GITHUB_ACTIONS=true npm --prefix web run build

echo "RESULT release=PASS sierra=${sierra_hash} compiled_blake=${compiled_blake_hash} compiled_poseidon=${compiled_poseidon_hash}"
