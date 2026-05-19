# AFK Ready Check

A Foundry Virtual Tabletop module that lets a GM start a ready check and lets players answer whether they are ready or AFK.

This public fork modernizes Jeremiah Verba's original AFK Ready Check module for Foundry Virtual Tabletop V14. It preserves the original chat-command workflow while replacing deprecated Foundry APIs with V14-compatible application, chat command, socket, and player-list handling.

## Compatibility

- Foundry Virtual Tabletop: minimum `14`, verified `14.361`
- Module version: `1.2.1`
- System agnostic

## Features

- `/readycheck` starts a GM-issued ready check.
- `/ready` marks the current user ready.
- `/afk` marks the current user AFK.
- Player status badges appear in the Foundry player list.
- Ready check state is tracked by stable Foundry user IDs, so display names with spaces are supported.
- The ready check HUD uses Foundry V14 `ApplicationV2`.

## Installation

Use Foundry's **Install Module** dialog and paste this manifest URL:

```text
https://raw.githubusercontent.com/SpencerZPoole/afk-ready-check/main/src/module.json
```

After installing, enable **AFK Ready Check** in your world.

## Usage

The GM can type:

```text
/readycheck
```

Each player can respond from the HUD, or by typing:

```text
/ready
/afk
```

These commands update the ready-check UI and do not create chat messages.

## Validation

The V14 compatibility update was validated against Foundry `14.361` with:

- `/readycheck`, `/ready`, and `/afk` through the real V14 chat input path.
- V14 `ApplicationV2` HUD rendering.
- player-list badge rendering against `li.player[data-user-id]`.
- repeated ready checks and timer cleanup.
- socket receive-path handling by user ID, including stale ready-check rejection.
- Endor Labs MCP `secrets` and `sast` scans with no findings.

## Screenshots

<img src="https://raw.githubusercontent.com/SpencerZPoole/afk-ready-check/main/ready-check-afk.png" alt="Image of AFK Ready Check AFK state" width="400"/>

<img src="https://raw.githubusercontent.com/SpencerZPoole/afk-ready-check/main/ready-check-ready.png" alt="Image of AFK Ready Check ready state" width="400"/>
<img src="https://raw.githubusercontent.com/SpencerZPoole/afk-ready-check/main/ready-check-unknown.png" alt="Image of AFK Ready Check waiting state" width="400"/>
<img src="https://raw.githubusercontent.com/SpencerZPoole/afk-ready-check/main/ready-check-player-box.png" alt="Image of AFK Ready Check player list badge" width="400"/>

## Development

Install dependencies:

```bash
npm ci
```

Build the module into `dist/`:

```bash
npm run build
```

Create an installable zip in `package/`:

```bash
npm run package
```

Validate JavaScript syntax:

```bash
npm run validate
```

## Attribution

Original module by Jeremiah Verba: <https://github.com/jeremiahverba/afk-ready-check>

Created with help from: <https://gitlab.com/foundry-projects/foundry-pc/create-foundry-project/-/wikis/home>

Licensed under the MIT License. See [LICENSE.md](LICENSE.md) and [src/LICENSE](src/LICENSE).
