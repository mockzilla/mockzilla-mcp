# Codegen simulations

A codegen simulation is a generated Go server: the engine reads your spec and writes typed handlers for every operation. Out of the box each handler returns the same generated mock every other simulation type serves - the difference is that you can open the file and take over, one operation at a time, wherever a response needs real logic, state or arithmetic. The spec never leaves your repository, which also frees it from any upload limit.

## From spec to service

One command generates a service package from a spec:

```bash
go run github.com/mockzilla/mockzilla/v2/cmd/gen/service@latest \
  -name petstore \
  https://petstore3.swagger.io/api/v3/openapi.json
```

```text
petstore/
  gen.go           # generated types, handlers, registration - never edit
  service.go       # your business logic - never overwritten
  middleware.go    # your middleware - never overwritten
  setup/
    codegen.yml    # what gets generated
    config.yml     # runtime behavior
    context.yml    # values for generated data
    openapi.json   # the spec
```

The split is the contract: `gen.go` is regenerated whenever the spec changes, `service.go` and `middleware.go` are written once and stay yours. Updating the API means updating the spec and running `go generate ./...` - your logic survives every regeneration.

## A handler when you need one

Every operation gets a method in `service.go`. Return `nil, nil` and the generated mock answers, which is why a fresh codegen service behaves like any other simulation. Take over where it matters:

```go
func (s *service) GetPetByID(ctx context.Context, opts *GetPetByIDServiceRequestOptions) (*GetPetByIDResponseData, error) {
    resp, err := opts.GenerateResponse()   // start from the generated mock
    if err != nil {
        return nil, err
    }
    resp.Body.ID = opts.PathParams.PetId   // then make it behave
    resp.Body.Name = "Custom Pet"
    return resp, nil
}
```

Requests and responses are typed from the spec, so the compiler catches what a hand-written mock would get wrong silently. `middleware.go` is the same idea one level up: authentication, logging, request rewriting across the whole service.

## Configuration

Everything configurable lives in `setup/`:

- **`codegen.yml`** controls generation itself: which handlers exist, whether `middleware.go` is generated, filtering.
- **`config.yml`** is the same runtime configuration every simulation type uses - latency, error injection, an upstream with mock fallback, caching, replay. The options match the Service settings (topic `simulations/service-settings`) page.
- **`context.yml`** shapes the generated data, exactly as everywhere else.

The full references live with the engine: codegen mode (topic `engine/usage/codegen`) and codegen configuration (topic `engine/config/codegen`).

## Running and deploying

`go build` produces one self-contained binary: run it locally, in CI, or on any machine with no runtime dependencies. For a hosted URL, the GitHub Action (topic `simulations/github-simulations`)'s codegen mode builds and deploys the project on every push, branch URLs included.

Start from the template, which ships CI, the API explorer and example services ready to go: [mockzilla-codegen-template](https://github.com/mockzilla/mockzilla-codegen-template)

## When codegen is the right kind

Reach for it when the mock has to behave: validate a signature, keep a counter, echo request fields back with arithmetic applied, enforce auth. For everything short of that, portable (topic `simulations/portable-simulations`) gets there with no code at all - and the two share their configuration, so starting portable and generating later loses nothing.
