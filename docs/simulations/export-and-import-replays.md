# Export and import replays

A good set of recordings is work worth keeping: the fixtures a test suite runs against, the captured answers of a backend that is hard to reach, the hand-tuned payloads of a demo. Export packs a service's replays into one file; import unpacks that file into any service, on any simulation.

> Export and import are part of plans that include bulk replay actions. On other plans the buttons point at the upgrade.

## What the file contains

One JSON document, `mockzilla.replays/v1`, gzipped on export. It carries both halves of a service's replay setup:

- the service's replay settings: on or off, TTL, auto-replay, upstream-only,
- every exported endpoint with its match key,
- the recordings, with status, content type and the response body in base64.

```json
{
  "format": "mockzilla.replays/v1",
  "replay": {
    "enabled": true,
    "duration": "24h",
    "endpoints": {
      "/pets/{petId}": {
        "GET": {
          "match": { "path": ["petId"], "query": [], "body": [] },
          "recordings": [
            {
              "match": { "path:petId": "42" },
              "source": "manual",
              "status": 200,
              "contentType": "application/json",
              "body": "eyJpZCI6NDIsIm5hbWUiOiJSZXgifQ=="
            }
          ]
        }
      }
    }
  }
}
```

The document names no simulation and no service: it imports into whichever service you point it at. **Download a sample file** in the import dialog hands out a small valid one to start from.

## Export

In **Replays**, pick the service, tick the endpoints to ship and click **Export** in the bar that appears. The count next to it is the number of recordings the selection carries.

(Image: The bulk bar over the endpoint table: 2 selected, Export with 3 recordings, Delete recordings and Clear config)

*Two endpoints selected, three recordings ready to export*

The download is named `<service>-replays.json.gz`. Up to 500 recordings go into one export; read access is enough to make one.

## Import

Click **Import** above the settings, then drop the file, browse for it, or paste a URL. `.json` and `.json.gz` both work, up to 10 MB.

(Image: The Import replays dialog with a picked file, the sample file link, a URL field and the Skip on conflict toggle)

*The import dialog with a file picked, the URL alternative and the conflict toggle*

- **Skip on conflict** decides what happens when the target already holds a recording under the same endpoint and match values: keep the existing one (the default) or overwrite it with the imported one.
- When it finishes, the dialog reports how many recordings were imported and how many skipped.

An import brings the configuration with it: the match keys and service settings from the file land in the simulation alongside the recordings. As everywhere in Replays, the recordings are served immediately, while the configuration ships with the next deploy. Importing changes the simulation, so it needs the editor role.

## Moving replays around

Because the file is service-agnostic, the same export seeds many places:

- **A teammate's simulation**: export from yours, they import into theirs, and both run against identical fixtures.
- **A fresh simulation**: recreate a sim, import, and the recordings and match keys are back without replaying any traffic.
- **A shared canonical set**: keep the exported file where your team keeps files, a wiki, a bucket or a repo, and let everyone import it from the URL. Updating the file updates what the next import brings.

See Record and browse replays (topic `simulations/record-and-browse-replays`) for how recordings are made and matched in the first place.
