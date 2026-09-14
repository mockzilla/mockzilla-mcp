# Quickstart: your first simulation

In a few minutes you will have a hosted mock API at a URL your whole team can call. Everything happens in the browser; there is nothing to install.

## Create the simulation

Sign in and open **Simulations**. Click the arrow next to **New simulation** and pick **Sample simulation**.

(Image: The New simulation menu with Blank, Sample, Browse catalog and Backend sandbox options)

*The New simulation menu*

**The sample is the fastest way in**: it comes prefilled with the Petstore OpenAPI spec and a few static endpoints, so there is nothing to configure.

See Create a simulation (topic `simulations/create-a-simulation`) for the other options: start blank, pick an API from the catalog, or bring your own spec.

## Deploy it

The simulation opens on its Endpoints view, listing everything it will serve, grouped by service.

Click **Deploy**. After a few seconds the status pill turns **Active** and the simulation's URL appears under the header.

(Image: A deployed simulation with the Active status, its URL and the endpoint list)

*A deployed sample simulation and its endpoints*

## Explore it in the browser

Every deployed simulation serves a built-in API explorer at its URL. Open the URL in a browser to see the services and endpoints; clicking an endpoint fires a request and shows the generated response.

(Image: The API explorer with the petstore endpoints and a generated response for GET /pets)

*The API explorer of a deployed simulation*

The explorer can be switched off, and the whole simulation can be put behind credentials or an allowed IP range.

See Access control (topic `simulations/access-control`).

## Call it

Copy the URL and request one of the endpoints. Your path carries your own organization and simulation name:

```bash
curl "https://api.mockz.io/app/docs-shots/tidy-valley/petstore/pets?limit=1"
```

The response is generated from the spec's schemas, with fresh values on every call:

```json
{
  "nextPageToken": "cvdzxtlsan",
  "pets": [
    {
      "birthDate": "1994-08-09",
      "breed": "Labrador",
      "id": "6f5c3020-25f7-4617-86af-f2039c82e986",
      "name": "Marley",
      "ownerEmail": "charley@xbn.com",
      "ownerName": "Glen Streich",
      "species": "rabbit",
      "status": "sold",
      "weightKg": 48
    }
  ]
}
```

Requests are validated too: a body that breaks the spec is refused the way the real API would refuse it.

## See what happened

Open **History** in the simulation's sidebar, under Recordings, and pick the `petstore` service. Every call is listed with its method, path, status and timing. Click one to see the full request and response.

(Image: The History view with the petstore service selected, listing recorded requests)

*Recorded requests for the petstore service*

## Take it offline

When you are done experimenting, click the arrow next to **Deploy** and pick **Take offline**. The simulation stops serving and its URL goes dark; deploying again brings it back with everything intact.

## Where to go next

- Upload and update an OpenAPI spec (topic `simulations/upload-a-spec`)
- GitHub Action (topic `developer-tools/github-action`)
- Run a simulation locally (topic `simulations/run-locally`)
