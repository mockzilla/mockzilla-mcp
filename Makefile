# mockzilla-mcp — pure-JS, no build step. Targets are thin wrappers
# around node/npm so common dev actions have one canonical command.

.PHONY: help smoke start clean publish-dry publish publish-mcp publish-all login-mcp sync-server-json version

help:
	@echo "Targets:"
	@echo "  smoke           Run scripts/smoke.mjs (stdio MCP round-trip)"
	@echo "  start           Run the bridge against stdio (node bin/cli.js)"
	@echo "  version         Print bridge version from package.json"
	@echo "  clean           Remove install_cli cache (~/.cache/mockzilla-mcp)"
	@echo "  publish-dry     npm pack to inspect the tarball without publishing"
	@echo "  publish         Smoke-test then npm publish (uses package.json version)"
	@echo "  publish-mcp     Sync server.json then mcp-publisher publish"
	@echo "  publish-all     publish + publish-mcp (do this every release)"
	@echo "  login-mcp       Log mcp-publisher in with the GitHub token from Keychain"

smoke:
	node scripts/smoke.mjs

start:
	node bin/cli.js

version:
	@node -p "require('./package.json').version"

clean:
	rm -rf $${HOME}/.cache/mockzilla-mcp

publish-dry:
	npm pack --dry-run

# Mirror package.json's version into server.json's two version fields.
# Keeps the MCP registry record pinned to the npm tarball that just shipped.
sync-server-json:
	@node -e "const fs=require('fs');const pkg=require('./package.json');const p='./server.json';const s=JSON.parse(fs.readFileSync(p,'utf8'));s.version=pkg.version;for(const it of s.packages||[])it.version=pkg.version;fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n');console.log('server.json -> '+pkg.version);"

# Gate publish on a green smoke test so a broken bridge can't reach the registry.
publish: smoke
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
