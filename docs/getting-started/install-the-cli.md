# Install the CLI

> You do not need the CLI to use mockzilla.org. Creating simulations, browsing the catalog and calling your simulation URLs all work in the browser.

Install the CLI when you want to run a simulation on your own machine: from a share link, from a downloaded `.mockz` file, or straight from an OpenAPI spec. It is the open source Mockzilla server, MIT licensed. It runs offline and needs no account.

## Install with Homebrew

On macOS and Linux:

```bash
brew tap mockzilla/tap
brew install mockzilla
```

## Download a binary

Every release ships prebuilt binaries for macOS, Linux and Windows. Get the latest from the [releases page](https://github.com/mockzilla/mockzilla/releases/latest), rename the file to `mockzilla`, make it executable and put it on your `PATH`.

There are more ways to install, including Windows (Scoop) and Ubuntu or Debian (apt).

See the [installation page](https://mockzilla.org/install) for complete examples.

## Check it works

```bash
mockzilla --version
```

To see it serve something, point it at any OpenAPI spec, by URL or file path:

```bash
mockzilla https://petstore3.swagger.io/api/v3/openapi.json
```

Your mock is now running on port 2200.

## Where to go next

- Quickstart: your first simulation (topic `getting-started/quickstart`)
- Run a simulation locally (topic `simulations/run-locally`)
