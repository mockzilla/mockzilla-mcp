// The local tool registry. Descriptions matter: they're what the
// agent reads to decide which tool to call. Keep them imperative and
// specific about when to prefer this tool over a hosted one.

import { discoverSpecs } from "./discover.js";
import { readTopic, searchDocs, topicsList } from "./docs.js";
import { checkCli, installCli } from "./install.js";
import {
  callEndpoint,
  clearMockEndpoints,
  listMockEndpoints,
  mockEndpoint,
  peekOpenapi,
  serveLocally,
  stopLocally,
} from "./local.js";
import { bridgeStatus } from "./version.js";

export const LOCAL_TOOLS = {
  check_cli: {
    description:
      "Check whether the mockzilla CLI is available — either on the " +
      "system PATH, in the bridge's own cache (~/.cache/mockzilla-mcp/), " +
      "or via a `go run` invocation. Call FIRST when the user wants to " +
      "try mockzilla locally. If nothing resolves, the response carries " +
      "`install_options`; suggest `install_cli` to the user and ask them " +
      "which method (download / go-install / go-run) they prefer.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: checkCli,
  },

  install_cli: {
    description:
      "Install the mockzilla CLI for this user. Three methods — ASK the " +
      "user which one they want before calling:\n" +
      "  • download (recommended): fetch the prebuilt binary for this " +
      "OS/arch from github.com/mockzilla/mockzilla releases (~38MB). " +
      "Fast, no toolchain needed.\n" +
      "  • go-install: run `go install <module>@v<version>` to compile " +
      "from source. Needs Go on PATH.\n" +
      "  • go-run: don't install at all — the bridge stores a `go run " +
      "<module>@v<version>` invocation. First serve_locally compiles " +
      "into Go's module cache; later runs are instant. Needs Go.\n" +
      "Files land in the bridge's own cache, never on system PATH; " +
      "blow it away with `rm -rf ~/.cache/mockzilla-mcp`.",
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["download", "go-install", "go-run"],
          default: "download",
        },
      },
      additionalProperties: false,
    },
    handler: installCli,
  },

  serve_locally: {
    description:
      "Start ONE mockzilla portable mock server on this machine that " +
      "serves any number of APIs together — no mockzilla account " +
      "needed. Pass `input` as a single spec path / directory / public " +
      "https URL, OR an array of them to combine multiple APIs into the " +
      "same server (each becomes a service mounted at /<service>/...). " +
      "Returns {url, port, pid, services} once listening. Pair with " +
      "`stop_locally(pid)` to clean up. Prefer this over " +
      "`deploy_mock_from_*` whenever the user says 'try locally', " +
      "'experiment', or 'play with' — those tools create persistent " +
      "hosted bundles, this one is ephemeral. The bridge only runs ONE " +
      "local server at a time on purpose: if the user wants more APIs, " +
      "stop the current server and restart with all of them in `input`.\n\n" +
      "If the user names a well-known API (stripe, twilio, github, " +
      "openai, slack, etc.) WITHOUT providing a URL, recall the public " +
      "OpenAPI spec URL from your training knowledge and pass that. Do " +
      "NOT pass a catalog ID or slug from `list_catalog_products` — " +
      "that catalog is for the HOSTED `deploy_mock_from_catalog` flow, " +
      "its ids are not URLs. Examples of public OpenAPI URLs:\n" +
      "  • Stripe: https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json\n" +
      "  • Twilio: https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json\n" +
      "  • GitHub: https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json\n" +
      "  • Petstore: https://petstore3.swagger.io/api/v3/openapi.json",
    inputSchema: {
      type: "object",
      properties: {
        input: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" }, minItems: 1 },
          ],
          description:
            "Spec file path(s), directory, or public OpenAPI URL(s). " +
            "Pass an array to combine multiple APIs into one server.",
        },
        port: {
          type: "integer",
          minimum: 0,
          maximum: 65535,
          description:
            "Port to bind on. Omit or pass 0 to let the OS pick a free port.",
        },
      },
      required: ["input"],
      additionalProperties: false,
    },
    handler: serveLocally,
  },

  call_endpoint: {
    description:
      "Make an HTTP request to a URL and return {status, headers, body}. " +
      "Use this to demonstrate a mock by hitting it after `serve_locally` " +
      "(e.g. `http://localhost:PORT/openapi/pet/findByStatus`), to inspect " +
      "the admin API (`/.services` returns the registered services, " +
      "`/healthz` for liveness), or to verify a freshly-mocked endpoint " +
      "works. Default scope is localhost only; pass `allow_remote: true` " +
      "for arbitrary URLs (rare — the bridge isn't a general-purpose " +
      "HTTP client).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
          default: "GET",
        },
        headers: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        body: {},
        allow_remote: { type: "boolean", default: false },
      },
      required: ["url"],
      additionalProperties: false,
    },
    handler: callEndpoint,
  },

  mock_endpoint: {
    description:
      "Quickly mock a single HTTP endpoint without writing an OpenAPI " +
      "spec. Pass `method` (default GET), `path` (e.g. " +
      "`/foo/bar/{id}`), and the `response` body (object → JSON, " +
      "string → text). The bridge writes the response into a managed " +
      "static dir at ~/.cache/mockzilla-mcp/mocks/ and (re)starts a " +
      "single shared mockzilla server pointing at it.\n\n" +
      "The FIRST path segment becomes the service name (e.g. " +
      "/foo/bar → service `foo`, mounted at /foo/bar in the URL). " +
      "Path placeholders like `{id}` are stored as literal directory " +
      "names — by default ALL placeholder values share the same " +
      "response. To return different responses for specific values, " +
      "call mock_endpoint again with a literal value (e.g. /foo/bar/123).\n\n" +
      "Calling this multiple times accumulates endpoints in the same " +
      "server — adding `POST /foo/bar` after `GET /foo/bar/{id}` keeps " +
      "both. Mutually exclusive with `serve_locally`: stop any ad-hoc " +
      "server first. See `mockzilla_docs_search('static directory')` " +
      "for the underlying convention.",
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
          default: "GET",
        },
        path: {
          type: "string",
          description:
            "Path beginning with /. First segment is the service name.",
        },
        response: {
          description:
            "Response body. Object → JSON. String → text. Default {}.",
        },
        status: {
          type: "integer",
          minimum: 100,
          maximum: 599,
          default: 200,
        },
        content_type: {
          type: "string",
          description:
            "Override content type. Inferred from response type if omitted (object → application/json, string → text/plain).",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    handler: mockEndpoint,
  },

  list_mock_endpoints: {
    description:
      "List all endpoints currently mocked via `mock_endpoint`. Returns " +
      "{endpoints: [{method, service, path, file}], server_url, ui_url}. " +
      "If a managed server is running, `ui_url` is the mockzilla UI " +
      "(opens in a browser, shows endpoints grouped by service plus " +
      "request inspection). Suggest the UI to the user when they want " +
      "to explore beyond what the agent can show in chat.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: listMockEndpoints,
  },

  clear_mock_endpoints: {
    description:
      "Wipe ALL mocks created via `mock_endpoint` and stop the managed " +
      "server. Equivalent to `rm -rf ~/.cache/mockzilla-mcp/mocks` " +
      "plus `stop_locally`. Use when the user wants to start fresh. " +
      "Does not touch the mockzilla CLI binary or other bridge state.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: clearMockEndpoints,
  },

  stop_locally: {
    description:
      "Stop the mockzilla server started by `serve_locally`. Takes no " +
      "arguments — there's only ever one local server running. Returns " +
      "{stopped: bool, pid?, reason?}.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: stopLocally,
  },

  mockzilla_docs_topics: {
    description:
      "List the available mockzilla doc topics (e.g. 'usage/portable', " +
      "'middleware', 'config/service'). Call this once at the start " +
      "of a session involving non-trivial mockzilla usage to know what " +
      "knowledge is available; then call `mockzilla_docs_search` with " +
      "a query or `mockzilla_docs_read` for a specific topic.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => await topicsList(),
  },

  mockzilla_docs_read: {
    description:
      "Return the full markdown for one mockzilla doc topic. Use this " +
      "when the user asks a deep question about a specific area " +
      "(middleware, contexts, codegen, config) and you want full " +
      "context. For broader questions or when you don't know the " +
      "right topic, use `mockzilla_docs_search` first.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Topic name from `mockzilla_docs_topics` (e.g. 'middleware', 'usage/portable').",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
    handler: readTopic,
  },

  mockzilla_docs_search: {
    description:
      "Search the mockzilla docs by keyword. Returns the top-scoring " +
      "sections {topic, heading, snippet} so you can identify which " +
      "topic to read in full. Use this BEFORE answering questions about " +
      "mockzilla syntax, conventions, or features you're not 100% sure " +
      "of — the docs are the source of truth, your training is not.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text query, e.g. 'static directory layout'.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          default: 5,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    handler: searchDocs,
  },

  bridge_status: {
    description:
      "Report the bridge's own version and check whether a newer one " +
      "is on npm. Returns {bridge_version, bridge_latest, update_available, " +
      "upgrade_steps}. Call this when the user asks 'is mockzilla-mcp up " +
      "to date?', or proactively if a tool starts failing in a way that " +
      "could be a stale-bridge issue.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: bridgeStatus,
  },

  discover_specs: {
    description:
      "Scan a directory and report what mockzilla can do with it: top-" +
      "level OpenAPI spec files (with title and endpoint count) plus any " +
      "`static/` subdirs that mockzilla can auto-mock. Returns a " +
      "`suggested_input` the agent can hand directly to `serve_locally`. " +
      "Use this when the user says 'I have a folder of specs/files, " +
      "what's in it?' or 'mock this directory'.",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string" },
      },
      required: ["dir"],
      additionalProperties: false,
    },
    handler: discoverSpecs,
  },

  peek_openapi: {
    description:
      "Summarise an OpenAPI spec without serving it. Returns " +
      "{title, version, openapi_version, endpoint_count, paths}. " +
      "Pass `input` as a file path or a public https URL. Use this " +
      "when the user wants to know what's in a spec before deciding " +
      "whether to serve or deploy it.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" },
      },
      required: ["input"],
      additionalProperties: false,
    },
    handler: peekOpenapi,
  },
};
