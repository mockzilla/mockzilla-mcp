# Share links

A simulation lives in your organization; sharing hands it to someone outside it. The person on the other end needs no account and nothing installed on our side: they run your simulation on their own machine and get the same endpoints and behavior you built.

The **Share** button sits in the simulation's header, beside Deploy:

(Image: The simulation header with the Share button beside Deploy)

*The Share button in the simulation header*

It opens a dialog with the three ways to share:

(Image: The Share simulation dialog with link sharing on, collaborators and the .mockz download)

*The Share simulation dialog*

## Anyone with the link

Turn on **Anyone with the link** and you get a short URL. Anyone holding it can run the simulation locally:

```bash
mockzilla https://mockz.io/fxygibah
```

The link packages the simulation as it is right now, and no deploy is needed: even edits you have not deployed yet are captured. When you change the simulation later, the link keeps serving its snapshot until you press the refresh button beside it, which re-packages from the current state without changing the URL.

Turning the toggle off revokes the link, and it stops working immediately.

Codegen simulations cannot be shared this way: their packages ship compiled code.

## Download .mockz

**Download .mockz** gives you the same package as a file. Hand it over however you like; it runs from disk with the CLI or Docker. There is nothing to revoke later: once shared, the file is out of your hands.

## Collaborators

A link or a file carries a copy. **Collaborators** shares the simulation itself: invite a teammate by email as **Editor** or **Viewer**, and they work with the live simulation in the app, with access you can take back at any time.

## Running what you shared

The commands for the link and the file, CLI, Docker and Docker Compose, live in one place.

See Run a simulation locally (topic `simulations/run-locally`).
