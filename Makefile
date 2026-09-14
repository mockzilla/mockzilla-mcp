# mockzilla-mcp — pure JS. The only build step is the docs. Targets are thin
# wrappers around node/npm so common dev actions have one canonical command.

.PHONY: help build build-local smoke start clean publish-dry publish publish-mcp publish-all login-mcp sync-server-json version

help:
	@echo "Targets:"
	@echo "  build           Build docs/ and hosted-tools.json from the published bundle and the pinned engine docs"
	@echo "  build-local     Build from a bundle already saved at .docs-platform.json"
	@echo "  smoke           Run the stdio round-trip, login, docs and mock_endpoint smoke tests"
	@echo "  start           Run the bridge against stdio (node bin/cli.js)"
	@echo "  version         Print bridge version from package.json"
	@echo "  clean           Remove install_cli cache (~/.cache/mockzilla-mcp)"
	@echo "  publish-dry     npm pack to inspect the tarball without publishing"
	@echo "  publish         Build, smoke-test, then npm publish (uses package.json version)"
	@echo "  publish-mcp     Sync server.json then mcp-publisher publish"
	@echo "  publish-all     publish + publish-mcp (do this every release)"
	@echo "  login-mcp       Log mcp-publisher in with the GitHub token from Keychain"

smoke:
	node scripts/smoke.mjs
	node scripts/login-smoke.mjs
	node scripts/docs-smoke.mjs
	node scripts/mock-endpoint-smoke.mjs

start:
	node bin/cli.js

version:
	@node -p "require('./package.json').version"

clean:
	rm -rf $${HOME}/.cache/mockzilla-mcp

# Maintainers set DOCS_BUNDLE_CMD in local.mk, which git ignores: a command that prints the published bundle.
-include local.mk

build:
	@test -n "$(DOCS_BUNDLE_CMD)" || { echo "Set DOCS_BUNDLE_CMD in local.mk to fetch the published bundle." >&2; exit 1; }
	$(DOCS_BUNDLE_CMD) > .docs-platform.json
	node scripts/build.mjs .docs-platform.json docs
	rm -f .docs-platform.json

build-local:
	node scripts/build.mjs .docs-platform.json docs

publish-dry:
	npm pack --dry-run

# Mirror package.json's version into server.json's two version fields.
# Keeps the MCP registry record pinned to the npm tarball that just shipped.
sync-server-json:
	@node -e "const fs=require('fs');const pkg=require('./package.json');const p='./server.json';const s=JSON.parse(fs.readFileSync(p,'utf8'));s.version=pkg.version;for(const it of s.packages||[])it.version=pkg.version;fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n');console.log('server.json -> '+pkg.version);"

# Build first so the tarball carries today's docs, and gate on a green smoke test
# so a broken bridge can't reach the registry.
publish: build smoke
	npm publish

publish-mcp: sync-server-json login-mcp
	mcp-publisher publish

# The browser login can't publish to io.github.mockzilla, and a registry login
# lasts 5 minutes, so publish-mcp logs in with a Keychain token every time.
MCP_TOKEN_KEYCHAIN_SERVICE := mcp-publisher-github

login-mcp:
	@token="$$(security find-generic-password -s $(MCP_TOKEN_KEYCHAIN_SERVICE) -w 2>/dev/null)" || { \
		echo "No GitHub token in Keychain. Create a classic token with read:org and read:user:" >&2; \
		echo "  https://github.com/settings/tokens/new?scopes=read:org,read:user&description=mcp-publisher" >&2; \
		echo "then store it (the command prompts for it):" >&2; \
		echo '  security add-generic-password -a "$$USER" -s $(MCP_TOKEN_KEYCHAIN_SERVICE) -w' >&2; \
		exit 1; }; \
	MCP_GITHUB_TOKEN="$$token" mcp-publisher login github

publish-all: publish publish-mcp
