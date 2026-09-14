# Factory

The Factory provides programmatic generation of mock requests and responses from Go code, without running the HTTP server.

## Standalone Usage

Use the `factory` package directly with any OpenAPI spec.

See the full runnable example at [`examples/api/factory/main.go`](https://github.com/mockzilla/mockzilla/blob/main/examples/api/factory/main.go).

### Create a factory

```go
f, err := factory.NewFactory(spec)
if err != nil {
	log.Fatalf("creating factory: %v", err)
}
```

### Generate response

```go
// Generate a full response (body + headers)
resp, err := f.Response("/pets/{petId}", "GET", nil)
if err != nil {
	log.Fatalf("generating response: %v", err)
}
fmt.Println("Response:", string(resp.Body))
```

### Generate response body

```go
// Generate just the response body bytes
body, err := f.ResponseBody("/pets/{petId}", "GET", nil)
if err != nil {
	log.Fatalf("generating response body: %v", err)
}
fmt.Println("Response body:", string(body))
```

### Generate request

```go
// Generate a full request (path with values, contentType, headers, body)
req, err := f.Request("/pets", "POST", nil)
if err != nil {
	log.Fatalf("generating request: %v", err)
}
fmt.Println("Request path:", req.Path)
fmt.Println("Request body:", string(req.Body))
```

### Generate request body

```go
// Generate just the request body bytes
reqBody, err := f.RequestBody("/pets", "POST", nil)
if err != nil {
	log.Fatalf("generating request body: %v", err)
}
fmt.Println("Request body:", string(reqBody))
```

### Generate response from http.Request

```go
// Generate response from an http.Request (path auto-matched)
r := httptest.NewRequest("GET", "/pets/42", nil)
respFromReq, err := f.ResponseBodyFromRequest(r, nil)
if err != nil {
	log.Fatalf("generating response from request: %v", err)
}
fmt.Println("Response from request:", string(respFromReq))
```

### Custom replacement context

```go
// Pass a custom replacement context to control generated values
customResp, err := f.ResponseBody("/pets/{petId}", "GET", map[string]any{
	"name":   "Buddy",
	"status": "available",
})
if err != nil {
	log.Fatalf("generating response with context: %v", err)
}
fmt.Println("Custom response:", string(customResp))
```

### Options

```go
// With custom service context YAML
f, _ := factory.NewFactory(spec,
    factory.WithServiceContext([]byte(`
        name: custom-name
        status: active
    `)),
)

// With custom codegen config
f, _ := factory.NewFactory(spec,
    factory.WithCodegenConfig(codegenCfg),
    factory.WithSpecOptions(&config.SpecOptions{Simplify: true}),
)
```

## Generated Service Usage

When you generate a service with `go generate`, each operation gets typed factory functions in `gen.go`:

```go
import "myapp/services/petstore"

// Singleton factory (initialized once)
f, _ := petstore.GetFactory()

// Or create a new one with custom options
f, _ = petstore.NewFactory()
```

### Per-Operation Functions

Every operation generates typed helper functions:

```go
// Full response (body + headers + status)
resp, _ := petstore.GenerateGetPetByIDResponse(nil)
resp.Body    // *GetPetByIDResponse (typed)
resp.Headers // http.Header

// Just the typed response body
body, _ := petstore.GenerateGetPetByIDResponseBody(nil)
// body is *GetPetByIDResponse

// Full request (path, contentType, headers, body)
req, _ := petstore.GenerateGetPetByIDRequest(nil)
req.Path        // "/pet/42" (with generated values)
req.ContentType // "application/json"

// Just the typed request body (only for operations with a body)
reqBody, _ := petstore.GenerateAddPetRequestBody(nil)
// reqBody is *AddPetBody
```

All Generate functions accept an optional replacement context:

```go
body, _ := petstore.GenerateGetPetByIDResponseBody(map[string]any{
    "name":   "Buddy",
    "status": "available",
})
```

## Factory API Reference

### `factory.Factory` Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `Response(path, method, ctx)` | `schema.ResponseData` | Full response with body + headers |
| `ResponseBody(path, method, ctx)` | `json.RawMessage` | Response body bytes |
| `Request(path, method, ctx)` | `schema.GeneratedRequest` | Full request with path, contentType, headers, body |
| `RequestBody(path, method, ctx)` | `json.RawMessage` | Request body bytes |
| `ResponseFromRequest(r, ctx)` | `schema.ResponseData` | Response matched from http.Request |
| `ResponseBodyFromRequest(r, ctx)` | `json.RawMessage` | Response body matched from http.Request |
| `Operations()` | `[]typedef.RouteInfo` | List all available operations |

### Per-Operation Generated Functions

| Function | Returns | When Generated |
|----------|---------|----------------|
| `Generate<OpID>Response(ctx)` | `*<OpID>ResponseData` | Has success response |
| `Generate<OpID>ResponseBody(ctx)` | `*<ResponseType>` | Has success response |
| `Generate<OpID>Request(ctx)` | `schema.GeneratedRequest` | Always |
| `Generate<OpID>RequestBody(ctx)` | `*<BodyType>` | Has request body |
