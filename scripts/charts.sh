#!/bin/sh
# Builds forgegate.io/charts, a classic Helm repo of Forge's chart: every
# forge-<version>.tgz attached to a release of showmino/forge (the same
# package as oci://ghcr.io/showmino/charts/forge), indexed by helm. Run in CI
# before the image build: Docusaurus copies static/ into the site. Needs gh
# (GH_TOKEN) and helm.
set -eu
out=static/charts
rm -rf "$out"
mkdir -p "$out"
for tag in $(gh release list --repo showmino/forge --limit 200 --json tagName --jq '.[].tagName'); do
  v=${tag#v}
  # Releases before v0.28.0 have no chart package: skip them.
  gh release download "$tag" --repo showmino/forge --pattern "forge-$v.tgz" --dir "$out" 2>/dev/null || true
done
n=$(find "$out" -name 'forge-*.tgz' | wc -l)
if [ "$n" -eq 0 ]; then
  echo "no chart packages found on showmino/forge's releases" >&2
  exit 1
fi
helm repo index "$out" --url https://forgegate.io/charts
echo "forgegate.io/charts: $n versions"
