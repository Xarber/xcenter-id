# apksigner prefixes vary across versions (Signer #1, V3.0 Signer, ...).
# Only certificate fingerprints are eligible; public-key digests are different.
tolower($0) ~ /certificate sha-256 digest:/ {
  sub(/^.*digest:[[:space:]]*/, "");
  gsub(/[^0-9a-fA-F]/, "");
  if (length($0) == 64) print tolower($0);
}
